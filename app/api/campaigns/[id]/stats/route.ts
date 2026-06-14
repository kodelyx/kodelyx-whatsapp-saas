import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { campaigns, campaignLeads, messageStatusEvents } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Delivery report for a campaign — the transparency view clients can be shown.
 *
 * Two layers of truth:
 *  - lead level (campaign_leads.status): whether WhatsApp ACCEPTED the send.
 *  - delivery level (message_status_events log, written by Meta status webhooks):
 *    whether the message was actually delivered / read / failed downstream. Linked
 *    by the Meta message id (campaign_leads.message_id === message_status_events.message_id).
 *
 * Reading from the append-only event log (not messages.status) makes this race-proof:
 * a delivered/read receipt that arrived before the send path wrote its messages row is
 * still counted. See lib/db/schema.ts messageStatusEvents.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const campaignId = parseInt(id);

    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, campaignId), eq(campaigns.teamId, team.id)),
      columns: { id: true, name: true, status: true },
    });
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    // Lead-level counts.
    const leadRows = await db
      .select({ status: campaignLeads.status, n: sql<number>`count(*)::int` })
      .from(campaignLeads)
      .where(eq(campaignLeads.campaignId, campaignId))
      .groupBy(campaignLeads.status);

    const lc: Record<string, number> = {};
    for (const r of leadRows) lc[r.status ?? 'UNKNOWN'] = Number(r.n);

    const total = Object.values(lc).reduce((a, b) => a + b, 0);
    const sent = lc['SENT'] ?? 0;                                   // accepted by WhatsApp
    const sendFailed = lc['FAILED'] ?? 0;                          // rejected at send time
    const queued = (lc['PENDING'] ?? 0) + (lc['SENDING'] ?? 0);    // not sent yet

    // Delivery-level counts, derived from the append-only status-event log. Per message,
    // collapse all logged events to the best status (read > delivered > failed > sent),
    // then count those per campaign lead.
    const bestStatus = db
      .select({
        messageId: messageStatusEvents.messageId,
        best: sql<string>`CASE
          WHEN bool_or(${messageStatusEvents.status} = 'read') THEN 'read'
          WHEN bool_or(${messageStatusEvents.status} = 'delivered') THEN 'delivered'
          WHEN bool_or(${messageStatusEvents.status} = 'failed') THEN 'failed'
          ELSE 'sent' END`.as('best'),
      })
      .from(messageStatusEvents)
      .groupBy(messageStatusEvents.messageId)
      .as('best_status');

    const deliveryRows = await db
      .select({ status: bestStatus.best, n: sql<number>`count(*)::int` })
      .from(campaignLeads)
      .innerJoin(bestStatus, eq(bestStatus.messageId, campaignLeads.messageId))
      .where(eq(campaignLeads.campaignId, campaignId))
      .groupBy(bestStatus.best);

    const dc: Record<string, number> = {};
    for (const r of deliveryRows) dc[r.status ?? 'unknown'] = Number(r.n);

    const read = dc['read'] ?? 0;
    const delivered = (dc['delivered'] ?? 0) + read;   // a read message was also delivered
    const deliveryFailed = dc['failed'] ?? 0;
    const awaitingReceipt = dc['sent'] ?? 0;           // accepted, no delivery receipt yet

    return NextResponse.json({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      total,
      sent,
      queued,
      delivery: {
        available: deliveryRows.length > 0,
        delivered,
        read,
        failed: sendFailed + deliveryFailed,
        pending: awaitingReceipt,
      },
    });
  } catch (error: any) {
    console.error('[Campaign Stats]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
