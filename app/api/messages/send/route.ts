import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { chats, messages, evolutionInstances } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { formatMessageForFrontend } from '@/lib/db/messages';
import { sendTextViaProvider } from '@/lib/whatsapp/send-helpers';
import { enforceMessaging } from '@/lib/limits';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipientJid, text, quotedMessageData, isInternal, instanceId } = body;

    if (!recipientJid || !text) {
      return NextResponse.json({ error: 'recipientJid and text are required' }, { status: 400 });
    }

    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Internal notes skip plan checks
    if (isInternal) {
      let chatConditions = [
        eq(chats.teamId, team.id),
        eq(chats.remoteJid, recipientJid)
      ];
      if (instanceId) {
        chatConditions.push(eq(chats.instanceId, Number(instanceId)));
      }

      const chat = await db.query.chats.findFirst({
        where: and(...chatConditions),
        columns: { id: true }
      });

      if (!chat) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
      }

      const internalId = `internal_${Date.now()}`;
      const internalMessageData = {
        id: internalId,
        chatId: chat.id,
        fromMe: true,
        messageType: 'conversation',
        text: text,
        timestamp: new Date(),
        status: 'read' as const,
        isInternal: true,
        mediaUrl: null, mediaMimetype: null, mediaCaption: null,
        mediaFileLength: null, mediaSeconds: null, mediaIsPtt: null,
        quotedMessageId: null, quotedMessageText: null,
        contactName: null, contactVcard: null,
        locationLatitude: null, locationLongitude: null,
        locationName: null, locationAddress: null,
      };

      await db.insert(messages).values(internalMessageData);
      return NextResponse.json(formatMessageForFrontend(internalMessageData));
    }

    // Enforce messaging plan gate (free users can't send)
    await enforceMessaging(team.id);

    // Find instance
    let activeInstance = null;
    let targetChat = null;

    if (instanceId) {
      activeInstance = await db.query.evolutionInstances.findFirst({
        where: and(eq(evolutionInstances.id, Number(instanceId)), eq(evolutionInstances.teamId, team.id))
      });
      if (activeInstance) {
        targetChat = await db.query.chats.findFirst({
          where: and(eq(chats.teamId, team.id), eq(chats.remoteJid, recipientJid), eq(chats.instanceId, activeInstance.id))
        });
      }
    }

    if (!activeInstance) {
      targetChat = await db.query.chats.findFirst({
        where: and(eq(chats.teamId, team.id), eq(chats.remoteJid, recipientJid)),
        with: { instance: true }
      });
      if (targetChat && targetChat.instance) {
        activeInstance = targetChat.instance;
      }
    }

    if (!activeInstance) {
      activeInstance = await db.query.evolutionInstances.findFirst({
        where: eq(evolutionInstances.teamId, team.id)
      });
    }

    if (!activeInstance) {
      return NextResponse.json({ error: 'No connected instance found.' }, { status: 404 });
    }

    const currentUser = await getUser();
    let finalText = text;
    if (currentUser?.enableSignature && currentUser?.name) {
      finalText = `*${currentUser.name}:*\n${text}`;
    }

    // Always use Meta Cloud API provider
    const result = await sendTextViaProvider({
      instance: {
        id: activeInstance.id,
        instanceName: activeInstance.instanceName,
        accessToken: activeInstance.accessToken || '',
        integration: activeInstance.integration || 'WHATSAPP-BUSINESS',
        metaToken: activeInstance.metaToken,
        metaPhoneNumberId: activeInstance.metaPhoneNumberId,
      },
      recipientJid,
      text: finalText,
      teamId: team.id,
      chatId: targetChat?.id,
      instanceId: activeInstance.id,
      quotedMessageData: quotedMessageData || null,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send' }, { status: 500 });
    }

    return NextResponse.json(formatMessageForFrontend({
      id: result.messageId,
      chatId: result.chatId,
      fromMe: true,
      messageType: 'conversation',
      text: finalText,
      timestamp: new Date(),
      status: 'sent',
      isInternal: false,
    }));

  } catch (error: any) {
    console.error('Error in /api/messages/send:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}