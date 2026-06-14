import { NextResponse, after } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { campaigns, campaignLeads, chats, contacts, messages } from '@/lib/db/schema';
import { eq, and, sql, lte, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { buildTemplateComponents } from '@/lib/whatsapp/template-params';
import { getMessageAllowance } from '@/lib/limits';

// Allow this function up to 60s (the max on Vercel Hobby). We stop sending
// before TIME_BUDGET_MS and hand the remaining leads to the next invocation.
export const maxDuration = 60;

const BATCH_SIZE = 100;            // max leads pulled from the DB per invocation
const DELAY_BETWEEN_SENDS_MS = 50; // small gap between sends — fast but gentle on Meta's rate limits
const TIME_BUDGET_MS = 45000;     // stop sending past this point, then self-retrigger
const CRON_SECRET = process.env.CRON_SECRET;

// Resolve the public origin to self-call. Prefer the incoming request's own
// origin (always correct on Vercel — no env var needed), and only fall back to
// BASE_URL / app-url envs if that somehow isn't a usable https origin. This is
// what makes the self-chain work in production: NEXT_PUBLIC_APP_URL is empty
// there, so the old env-only logic pointed at http://localhost:3000 and the
// chain silently died after the first batch.
function resolveBaseUrl(request: Request): string {
    try {
        const origin = new URL(request.url).origin;
        if (origin && !origin.includes('localhost')) return origin;
    } catch { /* fall through to env */ }
    return process.env.BASE_URL
        || process.env.NEXTAUTH_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || 'http://localhost:3000';
}

function triggerNextBatch(baseUrl: string) {
    // Vercel Hobby has no per-minute cron, so a campaign drives itself forward
    // by chaining one batch to the next. after() guarantees this runs even
    // though the handler has already returned its response. The short abort is
    // enough to deliver the request (which spawns a fresh invocation) without
    // blocking on the whole chain completing.
    after(async () => {
        try {
            await fetch(`${baseUrl}/api/campaigns/process`, {
                headers: CRON_SECRET ? { 'Authorization': `Bearer ${CRON_SECRET}` } : {},
                signal: AbortSignal.timeout(5000),
            });
        } catch {
            // A timeout/abort here is expected — the next invocation has already started.
        }
    });
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const now = new Date();

        await db.update(campaigns)
            .set({ status: 'PROCESSING' })
            .where(and(
                eq(campaigns.status, 'SCHEDULED'),
                lte(campaigns.scheduledAt, now)
            ));

        const activeCampaigns = await db.query.campaigns.findMany({
            where: eq(campaigns.status, 'PROCESSING'),
            with: { template: true, instance: true }
        });

        if (activeCampaigns.length === 0) {
            return NextResponse.json({ message: 'No campaigns to process' });
        }

        const results = [];
        const startedAt = Date.now();
        let anyRemaining = false;

        for (const campaign of activeCampaigns) {
            if (!campaign.template || !campaign.instance) {
                await db.update(campaigns)
                    .set({ status: 'COMPLETED' })
                    .where(eq(campaigns.id, campaign.id));
                continue;
            }

            const pendingLeads = await db.query.campaignLeads.findMany({
                where: and(
                    eq(campaignLeads.campaignId, campaign.id),
                    eq(campaignLeads.status, 'PENDING')
                ),
                limit: BATCH_SIZE,
                columns: { id: true }
            });

            if (pendingLeads.length > 0) {
                await db.update(campaignLeads)
                    .set({ status: 'SENDING' })
                    .where(inArray(campaignLeads.id, pendingLeads.map(l => l.id)));
            }

            // Always pull SENDING leads — this includes the batch we just promoted
            // AND any leads a previous invocation left stuck in SENDING because it
            // was killed mid-flight (Vercel timeout). Without this, a campaign whose
            // only remaining leads were stuck in SENDING would be wrongly COMPLETED.
            const leads = await db.query.campaignLeads.findMany({
                where: and(
                    eq(campaignLeads.campaignId, campaign.id),
                    eq(campaignLeads.status, 'SENDING')
                ),
                limit: BATCH_SIZE
            });

            if (leads.length === 0) {
                await db.update(campaigns)
                    .set({ status: 'COMPLETED' })
                    .where(eq(campaigns.id, campaign.id));
                results.push({ campaignId: campaign.id, status: 'completed' });
                continue;
            }

            // Plan gate: cap this batch to the team's remaining monthly quota.
            // If the quota is fully used we pause the campaign (the leads we just
            // claimed go back to PENDING so none are lost); it can resume after an
            // upgrade or next month. If only part of the batch fits, send that
            // much and pause for the rest.
            let batchLeads = leads;
            let limitHit = false;
            const allowance = await getMessageAllowance(campaign.teamId);
            if (!allowance.unlimited) {
                if (allowance.remaining <= 0) {
                    await db.update(campaignLeads)
                        .set({ status: 'PENDING' })
                        .where(inArray(campaignLeads.id, leads.map(l => l.id)));
                    await db.update(campaigns)
                        .set({ status: 'PAUSED' })
                        .where(eq(campaigns.id, campaign.id));
                    results.push({ campaignId: campaign.id, status: 'paused_limit', used: allowance.used, limit: allowance.limit });
                    continue;
                }
                if (allowance.remaining < leads.length) {
                    batchLeads = leads.slice(0, allowance.remaining);
                    const overflow = leads.slice(allowance.remaining);
                    await db.update(campaignLeads)
                        .set({ status: 'PENDING' })
                        .where(inArray(campaignLeads.id, overflow.map(l => l.id)));
                    limitHit = true;
                }
            }

            let sentCount = 0;
            let failedCount = 0;

            for (const lead of batchLeads) {
                // Stop before the function times out. Any leads we don't reach
                // stay in SENDING and get picked up by the next self-triggered
                // invocation, so nothing is lost.
                if (Date.now() - startedAt > TIME_BUDGET_MS) break;
                try {
                    const dbComponents = campaign.template.components as any[];

                    // Build the Meta template payload (body + header + url buttons).
                    // If any required variable is empty, fail the lead cleanly
                    // instead of letting Meta reject it with error 131008.
                    const built = buildTemplateComponents(
                        dbComponents,
                        lead.variables as Record<string, string> | null
                    );
                    if (built.error) {
                        await db.update(campaignLeads)
                            .set({
                                status: 'FAILED',
                                error: JSON.stringify({ error: { message: built.error, code: 'MISSING_VARIABLE' } })
                            })
                            .where(eq(campaignLeads.id, lead.id));
                        failedCount++;
                        continue;
                    }
                    const payloadComponents = built.components || [];

                    const metaPayload = {
                        messaging_product: "whatsapp",
                        to: lead.phone,
                        type: "template",
                        template: {
                            name: campaign.template.name,
                            language: { code: campaign.template.language },
                            components: payloadComponents.length > 0 ? payloadComponents : undefined
                        }
                    };

                    const response = await fetch(
                        `https://graph.facebook.com/v25.0/${campaign.instance.metaPhoneNumberId}/messages`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${campaign.instance.metaToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(metaPayload),
                            signal: AbortSignal.timeout(10000),
                        }
                    );

                    if (response.ok) {
                        const metaResult = await response.json();
                        const messageId = metaResult?.messages?.[0]?.id || `campaign_${campaign.id}_${randomUUID()}`;
                        
                        await db.update(campaignLeads)
                            .set({ status: 'SENT', messageId })
                            .where(eq(campaignLeads.id, lead.id));
                        sentCount++;
                        console.log(`[Campaign ${campaign.id}] Sent to ${lead.phone} (msgId: ${messageId}) | createContacts=${campaign.createContacts}`);

                        // Only create a chat/conversation + contact when the campaign
                        // was created with "Create contacts and start conversations"
                        // checked. Otherwise the send stays silent (no chat list entry).
                        if (campaign.createContacts) {
                            try {
                                const cleanPhone = lead.phone.replace(/[^\d]/g, '');
                                const remoteJid = `${cleanPhone}@s.whatsapp.net`;
                                const contactName = (lead.variables as Record<string, string>)?.['1'] || lead.phone;
 
                                let chat = await db.query.chats.findFirst({
                                    where: and(
                                        eq(chats.teamId, campaign.teamId),
                                        eq(chats.remoteJid, remoteJid),
                                        eq(chats.instanceId, campaign.instanceId)
                                    )
                                });
 
                                let templateText = '';
                                for (const comp of dbComponents) {
                                    if (comp.type === 'BODY' && comp.text) {
                                        templateText = comp.text;
                                        if (lead.variables) {
                                            const vars = lead.variables as Record<string, string>;
                                            templateText = templateText.replace(/\{\{(\d+)\}\}/g, (_: string, num: string) => {
                                                return vars[num] || vars[Object.keys(vars)[parseInt(num) - 1]] || `{{${num}}}`;
                                            });
                                        }
                                    }
                                }
 
                                const now = new Date();
 
                                if (!chat) {
                                    const [newChat] = await db.insert(chats).values({
                                        teamId: campaign.teamId,
                                        instanceId: campaign.instanceId,
                                        remoteJid,
                                        name: contactName,
                                        lastMessageText: templateText || `[Template: ${campaign.template.name}]`,
                                        lastMessageTimestamp: now,
                                        lastMessageFromMe: true,
                                        lastMessageStatus: 'sent',
                                        unreadCount: 0
                                    }).returning();
                                    chat = newChat;
                                } else {
                                    await db.update(chats).set({
                                        lastMessageText: templateText || `[Template: ${campaign.template.name}]`,
                                        lastMessageTimestamp: now,
                                        lastMessageFromMe: true,
                                        lastMessageStatus: 'sent'
                                    }).where(eq(chats.id, chat.id));
                                }

                                const existingContact = await db.query.contacts.findFirst({
                                    where: and(
                                        eq(contacts.teamId, campaign.teamId),
                                        eq(contacts.chatId, chat.id)
                                    )
                                });

                                if (!existingContact) {
                                    await db.insert(contacts).values({
                                        teamId: campaign.teamId,
                                        chatId: chat.id,
                                        name: contactName
                                    });
                                }

                                // Extract header media URL from template components
                                let headerMediaUrl: string | null = null;
                                let headerMediaType: string | null = null;
                                let msgType = 'campaign';
                                for (const comp of dbComponents) {
                                    if (comp.type === 'HEADER') {
                                        if (comp.format === 'IMAGE') {
                                            headerMediaUrl = comp.example?.header_handle?.[0] || null;
                                            headerMediaType = 'image/jpeg';
                                            msgType = 'imageMessage';
                                        } else if (comp.format === 'VIDEO') {
                                            headerMediaUrl = comp.example?.header_handle?.[0] || null;
                                            headerMediaType = 'video/mp4';
                                            msgType = 'videoMessage';
                                        } else if (comp.format === 'DOCUMENT') {
                                            headerMediaUrl = comp.example?.header_handle?.[0] || null;
                                            headerMediaType = 'application/pdf';
                                            msgType = 'documentMessage';
                                        }
                                    }
                                }

                                await db.insert(messages).values({
                                    id: messageId,
                                    chatId: chat.id,
                                    fromMe: true,
                                    messageType: msgType,
                                    text: templateText || `[Template: ${campaign.template.name}]`,
                                    mediaUrl: headerMediaUrl,
                                    mediaMimetype: headerMediaType,
                                    timestamp: now,
                                    status: 'sent'
                                }).onConflictDoNothing();
                            } catch (contactErr: any) {
                                console.error('[Campaign Contact Create]', contactErr.message);
                            }
                        }
                    } else {
                        const err = await response.json();
                        console.error(`[Campaign ${campaign.id}] Send FAILED for ${lead.phone}:`, JSON.stringify(err?.error || err));
                        await db.update(campaignLeads)
                            .set({ status: 'FAILED', error: JSON.stringify(err) })
                            .where(eq(campaignLeads.id, lead.id));
                        failedCount++;
                    }

                    await new Promise(r => setTimeout(r, DELAY_BETWEEN_SENDS_MS));

                } catch (e: any) {
                    console.error(`[Campaign ${campaign.id}] Exception sending to ${lead.phone}:`, e.message);
                    await db.update(campaignLeads)
                        .set({ status: 'FAILED', error: e.message })
                        .where(eq(campaignLeads.id, lead.id));
                    failedCount++;
                }
            }

            await db.update(campaigns).set({
                sentCount: sql`${campaigns.sentCount} + ${sentCount}`,
                failedCount: sql`${campaigns.failedCount} + ${failedCount}`
            }).where(eq(campaigns.id, campaign.id));

            if (limitHit) {
                // Sent everything the quota allowed this run; the rest is back in
                // PENDING. Pause so the chain doesn't keep retriggering against an
                // exhausted quota. A fresh "Send" (after upgrade / next month)
                // resumes it.
                await db.update(campaigns)
                    .set({ status: 'PAUSED' })
                    .where(eq(campaigns.id, campaign.id));
                results.push({ campaignId: campaign.id, processed: batchLeads.length, sent: sentCount, failed: failedCount, status: 'paused_limit' });
                continue;
            }

            const remaining = await db.query.campaignLeads.findFirst({
                where: and(
                    eq(campaignLeads.campaignId, campaign.id),
                    sql`${campaignLeads.status} IN ('PENDING', 'SENDING')`
                )
            });

            if (!remaining) {
                await db.update(campaigns)
                    .set({ status: 'COMPLETED' })
                    .where(eq(campaigns.id, campaign.id));
            } else {
                anyRemaining = true;
            }

            results.push({
                campaignId: campaign.id,
                processed: batchLeads.length,
                sent: sentCount,
                failed: failedCount,
                status: remaining ? 'processing' : 'completed'
            });
        }

        // If any campaign still has PENDING/SENDING leads, kick off the next
        // batch. This is what carries a large campaign past the first 50 — the
        // chain continues until every lead is sent.
        if (anyRemaining) {
            triggerNextBatch(resolveBaseUrl(request));
        }

        return NextResponse.json({ success: true, results, anyRemaining });

    } catch (error: any) {
        console.error('[Campaign Process]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
