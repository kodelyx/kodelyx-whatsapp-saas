import { db } from '@/lib/db/drizzle';
import { chats, messages, evolutionInstances, webhookEvents, contacts, autoReplySettings, autoReplyLogs, scheduledFollowups } from '@/lib/db/schema';
import { eq, and, sql, desc, lte } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher-server';
import fs from 'fs/promises';
import path from 'path';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { processAutomation } from '@/lib/automation/engine';
import { scheduleAIProcessing } from '@/lib/plugins/ai-chat/service';
import { sendPushNotification, sendPushToTeam } from '@/lib/push-notifications';

async function safePusherTrigger(channel: string, event: string, data: any): Promise<void> {
  try {
    await pusherServer.trigger(channel, event, data);
  } catch (err: any) {
    console.error(`[Pusher Error] ${channel}/${event}:`, err.message);
  }
}

async function logWebhookEvent(
  teamId: number, instanceName: string, event: string,
  messageId: string | null, remoteJid: string | null,
  status: 'processed' | 'duplicate' | 'ignored' | 'error', error?: string
): Promise<void> {
  try {
    await db.insert(webhookEvents).values({
      teamId, instanceName, event, messageId, remoteJid, status,
      error: error || null,
      processedAt: status !== 'error' ? new Date() : null,
    });
  } catch (_) {}
}

function getExtensionFromMimetype(mimetype: string | null): string | null {
  if (!mimetype) return null;
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/3gpp': '3gp',
    'audio/aac': 'aac', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/amr': 'amr',
    'audio/ogg': 'ogg',
    'application/pdf': 'pdf', 'text/plain': 'txt',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };
  if (mimeMap[mimetype]) return mimeMap[mimetype];
  const sub = mimetype.split('/')[1]?.split(';')[0];
  return sub || null;
}

function getStatusWeight(status: string | null): number {
  if (!status) return 0;
  const s = status.toLowerCase();
  if (s === 'error') return -1;
  if (s === 'pending') return 1;
  if (s === 'sent') return 2;
  if (s === 'delivered') return 3;
  if (s === 'read') return 4;
  return 0;
}

/**
 * Download media from Meta's CDN using the media ID
 */
async function downloadMetaMedia(mediaId: string, metaToken: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    // Step 1: Get the download URL
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${metaToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!metaRes.ok) return null;
    const metaData = await metaRes.json();
    const downloadUrl = metaData.url;
    const mimeType = metaData.mime_type || 'application/octet-stream';
    if (!downloadUrl) return null;

    // Step 2: Download the actual file
    const fileRes = await fetch(downloadUrl, {
      headers: { 'Authorization': `Bearer ${metaToken}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!fileRes.ok) return null;

    const contentLength = fileRes.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) return null;

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    return { buffer, mimeType };
  } catch (err: any) {
    console.error('[Meta Media Download Error]', err.message);
    return null;
  }
}

/**
 * Process incoming Meta Cloud API webhook entries
 */
export async function processMetaWebhook(entries: any[]): Promise<void> {
  for (const entry of entries) {
    const changes = entry.changes || [];

    for (const change of changes) {
      // --- Message Template Status Updates ---
      if (change.field === 'message_template_status_update') {
        console.log('[Meta Cloud] Template status update:', change.value);
        continue;
      }

      if (change.field !== 'messages') continue;

      const value = change.value;
      if (!value) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      const displayPhoneNumber = value.metadata?.display_phone_number;

      if (!phoneNumberId) continue;

      // Find our instance by phone number ID
      const instance = await db.query.evolutionInstances.findFirst({
        where: eq(evolutionInstances.metaPhoneNumberId, phoneNumberId),
        columns: {
          id: true, teamId: true, instanceName: true,
          metaToken: true, accessToken: true,
        },
      });

      if (!instance || !instance.teamId) {
        console.warn(`[Meta Cloud] No instance found for phoneNumberId: ${phoneNumberId}`);
        continue;
      }

      const { id: instanceId, teamId, instanceName, metaToken } = instance;
      const pusherChannel = `team-${teamId}`;

      // --- Process Status Updates ---
      const statuses = value.statuses || [];
      for (const statusUpdate of statuses) {
        const metaMessageId = statusUpdate.id;
        const rawStatus = statusUpdate.status; // sent, delivered, read, failed

        let dbStatus: 'sent' | 'delivered' | 'read' | 'failed' | null = null;
        if (rawStatus === 'sent') dbStatus = 'sent';
        else if (rawStatus === 'delivered') dbStatus = 'delivered';
        else if (rawStatus === 'read') dbStatus = 'read';
        else if (rawStatus === 'failed') dbStatus = 'failed';

        if (dbStatus && metaMessageId) {
          const pusherEvents: { event: string; data: any }[] = [];

          await db.transaction(async (tx) => {
            const currentMessage = await tx.query.messages.findFirst({
              where: and(eq(messages.id, metaMessageId), eq(messages.fromMe, true)),
              columns: { id: true, status: true, chatId: true },
            });
            if (!currentMessage) return;

            const currentWeight = getStatusWeight(currentMessage.status);
            const newWeight = getStatusWeight(dbStatus!);
            
            // Allow 'failed' to always override current status
            const isFailure = dbStatus === 'failed';
            
            if (newWeight <= currentWeight && !isFailure) return;

            const errorMessage = statusUpdate.errors?.[0]?.title || statusUpdate.errors?.[0]?.message || null;

            await tx.update(messages)
              .set({ 
                status: dbStatus!,
                ...(errorMessage ? { errorMessage } : {})
              })
              .where(eq(messages.id, metaMessageId));

            pusherEvents.push({
              event: 'message-status-update',
              data: { messageId: metaMessageId, status: dbStatus, error: errorMessage, instance: instanceName }
            });

            // Update chat's last message status if this is the latest message
            const latestMsg = await tx.query.messages.findFirst({
              where: eq(messages.chatId, currentMessage.chatId),
              orderBy: [desc(messages.timestamp)],
              columns: { id: true },
            });

            if (latestMsg && latestMsg.id === metaMessageId) {
              const chat = await tx.query.chats.findFirst({
                where: eq(chats.id, currentMessage.chatId),
                columns: { id: true, lastMessageStatus: true, remoteJid: true, instanceId: true },
              });

              if (chat) {
                const chatWeight = getStatusWeight(chat.lastMessageStatus);
                if (newWeight > chatWeight || isFailure) {
                  await tx.update(chats).set({ lastMessageStatus: dbStatus! }).where(eq(chats.id, chat.id));
                  pusherEvents.push({
                    event: 'chat-list-update',
                    data: { id: chat.id, lastMessageStatus: dbStatus, remoteJid: chat.remoteJid, instanceId: chat.instanceId }
                  });
                }
              }
            }
          });

          for (const evt of pusherEvents) {
            await safePusherTrigger(pusherChannel, evt.event, evt.data);
          }
        }
      }

      // --- Process Incoming Messages ---
      const incomingMessages = value.messages || [];
      const metaContacts = value.contacts || [];

      for (const msg of incomingMessages) {
        const fromNumber = msg.from; // sender's phone number
        if (!fromNumber) continue;

        const remoteJid = `${fromNumber}@s.whatsapp.net`;
        const metaMessageId = msg.id;
        const messageTimestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

        // Get sender name from contacts array
        const senderContact = metaContacts.find((c: any) => c.wa_id === fromNumber);
        const senderName = senderContact?.profile?.name || fromNumber;

        // Determine message type and extract content
        let messageType = 'conversation';
        let textContent: string | null = null;
        let rawMessagePreview = 'New message';
        let mediaDetails: any = {};

        if (msg.type === 'text') {
          messageType = 'conversation';
          textContent = msg.text?.body || '';
          rawMessagePreview = textContent || 'New message';

        } else if (msg.type === 'image') {
          messageType = 'imageMessage';
          textContent = msg.image?.caption || null;
          rawMessagePreview = textContent ? `📷 ${textContent}` : '📷 Image';

          if (msg.image?.id && metaToken) {
            const media = await downloadMetaMedia(msg.image.id, metaToken);
            if (media) {
              const ext = getExtensionFromMimetype(media.mimeType) || 'jpg';
              const filename = `${Date.now()}-${uuidv4()}.${ext}`;
              const dirPath = path.join(process.cwd(), 'public', 'uploads', 'image');
              await fs.mkdir(dirPath, { recursive: true });
              await fs.writeFile(path.join(dirPath, filename), media.buffer);
              mediaDetails = {
                mediaUrl: `/uploads/image/${filename}`,
                mediaMimetype: media.mimeType,
                mediaCaption: msg.image?.caption || null,
              };
            }
          }

        } else if (msg.type === 'video') {
          messageType = 'videoMessage';
          textContent = msg.video?.caption || null;
          rawMessagePreview = textContent ? `📹 ${textContent}` : '📹 Video';

          if (msg.video?.id && metaToken) {
            const media = await downloadMetaMedia(msg.video.id, metaToken);
            if (media) {
              const ext = getExtensionFromMimetype(media.mimeType) || 'mp4';
              const filename = `${Date.now()}-${uuidv4()}.${ext}`;
              const dirPath = path.join(process.cwd(), 'public', 'uploads', 'video');
              await fs.mkdir(dirPath, { recursive: true });
              await fs.writeFile(path.join(dirPath, filename), media.buffer);
              mediaDetails = {
                mediaUrl: `/uploads/video/${filename}`,
                mediaMimetype: media.mimeType,
                mediaCaption: msg.video?.caption || null,
              };
            }
          }

        } else if (msg.type === 'audio') {
          messageType = 'audioMessage';
          rawMessagePreview = '🎤 Audio';

          if (msg.audio?.id && metaToken) {
            const media = await downloadMetaMedia(msg.audio.id, metaToken);
            if (media) {
              const ext = getExtensionFromMimetype(media.mimeType) || 'ogg';
              const filename = `${Date.now()}-${uuidv4()}.${ext}`;
              const dirPath = path.join(process.cwd(), 'public', 'uploads', 'audio');
              await fs.mkdir(dirPath, { recursive: true });
              await fs.writeFile(path.join(dirPath, filename), media.buffer);
              mediaDetails = {
                mediaUrl: `/uploads/audio/${filename}`,
                mediaMimetype: media.mimeType,
                mediaIsPtt: msg.audio?.voice || false,
              };
            }
          }

        } else if (msg.type === 'document') {
          messageType = 'documentMessage';
          const docName = msg.document?.filename || 'Document';
          textContent = docName;
          rawMessagePreview = `📄 ${docName}`;

          if (msg.document?.id && metaToken) {
            const media = await downloadMetaMedia(msg.document.id, metaToken);
            if (media) {
              const ext = getExtensionFromMimetype(media.mimeType) || 'pdf';
              const filename = `${Date.now()}-${uuidv4()}.${ext}`;
              const dirPath = path.join(process.cwd(), 'public', 'uploads', 'document');
              await fs.mkdir(dirPath, { recursive: true });
              await fs.writeFile(path.join(dirPath, filename), media.buffer);
              mediaDetails = {
                mediaUrl: `/uploads/document/${filename}`,
                mediaMimetype: media.mimeType,
                mediaCaption: msg.document?.caption || null,
              };
            }
          }

        } else if (msg.type === 'sticker') {
          messageType = 'stickerMessage';
          rawMessagePreview = 'Sticker';

          if (msg.sticker?.id && metaToken) {
            const media = await downloadMetaMedia(msg.sticker.id, metaToken);
            if (media) {
              const filename = `${Date.now()}-${uuidv4()}.webp`;
              const dirPath = path.join(process.cwd(), 'public', 'uploads', 'sticker');
              await fs.mkdir(dirPath, { recursive: true });
              await fs.writeFile(path.join(dirPath, filename), media.buffer);
              mediaDetails = {
                mediaUrl: `/uploads/sticker/${filename}`,
                mediaMimetype: 'image/webp',
              };
            }
          }

        } else if (msg.type === 'location') {
          messageType = 'locationMessage';
          const locName = msg.location?.name || msg.location?.address || 'Location';
          rawMessagePreview = `📍 ${locName}`;
          mediaDetails = {
            locationLatitude: msg.location?.latitude?.toString(),
            locationLongitude: msg.location?.longitude?.toString(),
            locationName: msg.location?.name || null,
            locationAddress: msg.location?.address || null,
          };

        } else if (msg.type === 'contacts') {
          messageType = 'contactMessage';
          const contactName = msg.contacts?.[0]?.name?.formatted_name || 'Contact';
          rawMessagePreview = `👤 ${contactName}`;
          const phones = msg.contacts?.[0]?.phones || [];
          const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\n${phones.map((p: any) => `TEL:${p.phone}`).join('\n')}\nEND:VCARD`;
          mediaDetails = {
            contactName: contactName,
            contactVcard: vcard,
          };

        } else if (msg.type === 'reaction') {
          // Handle reactions
          const targetMsgId = msg.reaction?.message_id;
          const emoji = msg.reaction?.emoji || '';
          if (targetMsgId) {
            const targetMsg = await db.query.messages.findFirst({
              where: eq(messages.id, targetMsgId),
              columns: { id: true, chatId: true },
            });
            if (targetMsg) {
              const { messageReactions } = await import('@/lib/db/schema');
              if (emoji) {
                await db.insert(messageReactions).values({
                  messageId: targetMsgId,
                  chatId: targetMsg.chatId,
                  emoji,
                  fromMe: false,
                  remoteJid: remoteJid,
                  participantName: senderName,
                  timestamp: new Date(),
                }).onConflictDoUpdate({
                  target: [messageReactions.messageId, messageReactions.remoteJid, messageReactions.fromMe],
                  set: { emoji, timestamp: new Date() },
                });
              } else {
                await db.delete(messageReactions).where(
                  and(eq(messageReactions.messageId, targetMsgId), eq(messageReactions.remoteJid, remoteJid))
                );
              }
              await safePusherTrigger(pusherChannel, 'message-reaction', {
                messageId: targetMsgId, chatId: targetMsg.chatId,
                emoji: emoji || null, fromMe: false,
                remoteJid, participantName: senderName,
                action: emoji ? 'add' : 'remove',
              });
            }
          }
          continue; // Don't save reaction as a message

        } else if (msg.type === 'button') {
          messageType = 'conversation';
          textContent = msg.button?.text || msg.button?.payload || 'Button Reply';
          rawMessagePreview = `🔘 ${textContent}`;

        } else if (msg.type === 'interactive') {
          messageType = 'conversation';
          const reply = msg.interactive?.button_reply || msg.interactive?.list_reply;
          textContent = reply?.title || reply?.id || 'Interactive Reply';
          rawMessagePreview = `🔘 ${textContent}`;

        } else {
          // Unknown type, log and skip
          console.log(`[Meta Cloud] Unknown message type: ${msg.type}`, msg);
          continue;
        }

        // --- Save to DB ---
        let chatIdForAutomation: number | null = null;
        let newMessageData: any = null;
        let chatUpdateData: any = null;

        await db.transaction(async (tx) => {
          const messagePreview = rawMessagePreview;

          const updateData: any = {
            lastMessageText: messagePreview,
            lastMessageTimestamp: messageTimestamp,
            unreadCount: sql`${chats.unreadCount} + 1`,
            lastMessageFromMe: false,
            lastMessageStatus: null,
            lastCustomerInteraction: messageTimestamp,
          };

          if (senderName && senderName !== fromNumber) {
            updateData.name = senderName;
            updateData.pushName = senderName;
          }

          const [chat] = await tx.insert(chats).values({
            teamId, remoteJid, instanceId,
            name: senderName || fromNumber,
            pushName: senderName,
            lastMessageText: messagePreview,
            lastMessageTimestamp: messageTimestamp,
            unreadCount: 1,
            lastMessageFromMe: false,
            lastMessageStatus: null,
            lastCustomerInteraction: messageTimestamp,
          }).onConflictDoUpdate({
            target: [chats.teamId, chats.remoteJid, chats.instanceId],
            set: updateData,
          }).returning({
            id: chats.id, remoteJid: chats.remoteJid,
            unreadCount: chats.unreadCount, instanceId: chats.instanceId,
            name: chats.name, profilePicUrl: chats.profilePicUrl,
          });

          chatIdForAutomation = chat.id;

          // Auto-create contact if not exists (needed for Sales Pipeline)
          const existingContact = await tx.query.contacts.findFirst({
            where: eq(contacts.chatId, chat.id),
            columns: { id: true },
          });
          if (!existingContact) {
            await tx.insert(contacts).values({
              teamId,
              chatId: chat.id,
              name: senderName || fromNumber,
            }).onConflictDoNothing();
          }

          const newMessage: any = {
            id: metaMessageId,
            chatId: chat.id,
            fromMe: false,
            messageType,
            text: textContent,
            timestamp: messageTimestamp,
            status: 'delivered',
            ...mediaDetails,
          };

          // Handle quoted/context messages
          if (msg.context?.id) {
            newMessage.quotedMessageId = msg.context.id;
          }

          const [insertedMessage] = await tx.insert(messages).values(newMessage).onConflictDoNothing().returning({ id: messages.id });

          if (!insertedMessage) return; // Duplicate

          newMessageData = {
            ...newMessage,
            remoteJid, instance: instanceName, instanceId,
            lastMessageTextPreview: messagePreview,
          };

          chatUpdateData = {
            id: chat.id,
            lastMessageFromMe: false,
            unreadCount: chat.unreadCount,
            remoteJid: chat.remoteJid,
            lastMessageText: messagePreview,
            lastMessageTimestamp: messageTimestamp.toISOString(),
            instanceId: chat.instanceId,
            name: chat.name,
            profilePicUrl: chat.profilePicUrl,
          };
        });

        // --- Real-time updates ---
        if (newMessageData) {
          await safePusherTrigger(pusherChannel, 'new-message', newMessageData);
        }
        if (chatUpdateData) {
          await safePusherTrigger(pusherChannel, 'chat-list-update', chatUpdateData);
        }

        if (newMessageData) {
          await logWebhookEvent(teamId, instanceName, 'meta.messages', metaMessageId, remoteJid, 'processed');
        } else {
          await logWebhookEvent(teamId, instanceName, 'meta.messages', metaMessageId, remoteJid, 'duplicate');
        }

        // --- Push Notifications ---
        if (newMessageData && chatIdForAutomation) {
          try {
            const chatName = chatUpdateData?.name || fromNumber;
            const pushBody = (rawMessagePreview || 'New message').substring(0, 100);
            const pushData = {
              chatId: chatIdForAutomation,
              jid: remoteJid,
              name: chatName,
              instanceId: String(instanceId),
            };

            const contact = await db.query.contacts.findFirst({
              where: eq(contacts.chatId, chatIdForAutomation),
              columns: { assignedUserId: true },
            });

            if (contact?.assignedUserId) {
              await sendPushNotification(contact.assignedUserId, chatName, pushBody, pushData);
            } else {
              await sendPushToTeam(teamId, 0, chatName, pushBody, pushData);
            }
          } catch (pushError: any) {
            console.error('[Meta Cloud Push] Error:', pushError.message);
          }
        }

        // --- Automation & AI ---
        if (chatIdForAutomation && textContent) {
          let automationProcessed = false;
          const fullInstance = await db.query.evolutionInstances.findFirst({
            where: eq(evolutionInstances.id, instanceId),
            columns: { instanceName: true, accessToken: true },
          });

          if (fullInstance?.accessToken) {
            automationProcessed = await processAutomation(
              teamId, chatIdForAutomation, remoteJid, textContent,
              { instanceName: fullInstance.instanceName, accessToken: fullInstance.accessToken },
              instanceId
            );
          }

          if (!automationProcessed) {
            scheduleAIProcessing(teamId, chatIdForAutomation, instanceId);
          }
        } else if (chatIdForAutomation && !textContent) {
          // For media-only messages, still trigger AI if configured
          scheduleAIProcessing(teamId, chatIdForAutomation, instanceId);
        }

        // --- Auto-Reply Processing ---
        if (newMessageData && msg.type !== 'reaction') {
          processAutoReply(teamId, instanceId, fromNumber, metaToken || '').catch((e) => {
            console.error('[Auto-Reply Error]', e.message);
          });
        }
      }
    }
  }
}

/**
 * Process auto-reply for incoming message
 * Mirrors auto.go logic: cooldown check → delay → send → schedule follow-ups
 */
async function processAutoReply(teamId: number, instanceId: number, phone: string, metaToken: string): Promise<void> {
  try {
    // Get auto-reply settings for this instance
    const settings = await db.query.autoReplySettings.findFirst({
      where: and(
        eq(autoReplySettings.teamId, teamId),
        eq(autoReplySettings.instanceId, instanceId)
      )
    });

    if (!settings?.autoReplyEnabled) return;

    // Get instance for phone number ID
    const instance = await db.query.evolutionInstances.findFirst({
      where: eq(evolutionInstances.id, instanceId),
      columns: { metaPhoneNumberId: true, metaToken: true }
    });

    if (!instance?.metaPhoneNumberId || !instance?.metaToken) return;

    // Check cooldown: has this person been replied to recently?
    const cooldownHours = settings.autoReplyIntervalHours || 12;
    const cooldownCutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);

    const existingLog = await db.query.autoReplyLogs.findFirst({
      where: and(
        eq(autoReplyLogs.instanceId, instanceId),
        eq(autoReplyLogs.phone, phone)
      )
    });

    if (existingLog && existingLog.lastSentAt > cooldownCutoff) {
      // Within cooldown period, skip
      return;
    }

    // Update/insert cooldown log FIRST (prevent race condition)
    if (existingLog) {
      await db.update(autoReplyLogs)
        .set({ lastSentAt: new Date() })
        .where(eq(autoReplyLogs.id, existingLog.id));
    } else {
      await db.insert(autoReplyLogs).values({
        teamId,
        instanceId,
        phone,
        lastSentAt: new Date(),
      }).onConflictDoNothing();
    }

    // Send auto-reply after delay
    const delaySec = settings.autoReplyDelaySeconds || 300;
    const replyMessage = settings.autoReplyMessage || '';

    if (!replyMessage) return;

    console.log(`[Auto-Reply] Scheduled for ${phone} in ${delaySec}s`);

    setTimeout(async () => {
      try {
        await fetch(
          `https://graph.facebook.com/v25.0/${instance.metaPhoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${instance.metaToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phone,
              type: 'text',
              text: { body: replyMessage },
            }),
            signal: AbortSignal.timeout(10000),
          }
        );
        console.log(`[Auto-Reply] ✅ Sent to ${phone}`);
      } catch (e: any) {
        console.error(`[Auto-Reply] ❌ Failed to send to ${phone}:`, e.message);
      }
    }, delaySec * 1000);

    // Clear old pending follow-ups for this phone
    await db.delete(scheduledFollowups).where(
      and(
        eq(scheduledFollowups.instanceId, instanceId),
        eq(scheduledFollowups.phone, phone),
        eq(scheduledFollowups.sent, false)
      )
    );

    // Schedule Follow-Up #1
    if (settings.followup1Enabled && settings.followup1Message) {
      const delay1 = settings.followup1DelayMinutes || 480;
      const scheduledAt1 = new Date(Date.now() + delay1 * 60 * 1000);
      await db.insert(scheduledFollowups).values({
        teamId, instanceId, phone,
        message: settings.followup1Message,
        scheduledAt: scheduledAt1,
      });
      console.log(`[Auto-Reply] Follow-up #1 scheduled for ${phone} at ${scheduledAt1.toISOString()}`);
    }

    // Schedule Follow-Up #2
    if (settings.followup2Enabled && settings.followup2Message) {
      const delay2 = settings.followup2DelayMinutes || 720;
      const scheduledAt2 = new Date(Date.now() + delay2 * 60 * 1000);
      await db.insert(scheduledFollowups).values({
        teamId, instanceId, phone,
        message: settings.followup2Message,
        scheduledAt: scheduledAt2,
      });
      console.log(`[Auto-Reply] Follow-up #2 scheduled for ${phone} at ${scheduledAt2.toISOString()}`);
    }
  } catch (e: any) {
    console.error('[Auto-Reply Process]', e.message);
  }
}
