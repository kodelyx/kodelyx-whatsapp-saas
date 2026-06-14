import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { campaigns, campaignLeads, messageStatusEvents } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = await context.params;
    const campaignId = parseInt(params.id);

    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, campaignId), eq(campaigns.teamId, team.id)),
      with: {
        template: true,
        instance: true
      }
    });

    if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Best (highest-confidence) delivery status per Meta message id, derived from the
    // append-only message_status_events log — the race-proof source of truth. Precedence:
    // read > delivered > failed > sent (if Meta ever confirmed delivery/read, that wins
    // over a stray failure). See lib/db/schema.ts messageStatusEvents.
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

    const leads = await db
      .select({
        id: campaignLeads.id,
        phone: campaignLeads.phone,
        status: campaignLeads.status,
        error: campaignLeads.error,
        messageId: campaignLeads.messageId,
        deliveryStatus: bestStatus.best,
      })
      .from(campaignLeads)
      .leftJoin(bestStatus, eq(bestStatus.messageId, campaignLeads.messageId))
      .where(eq(campaignLeads.campaignId, campaignId))
      .orderBy(desc(campaignLeads.status));

    // Aggregate delivery counts for the report cards.
    const delivery = { delivered: 0, read: 0, failed: 0, pending: 0, available: false };
    for (const l of leads) {
      const d = l.deliveryStatus;
      if (!d) continue;
      delivery.available = true;
      if (d === 'read') { delivery.read++; delivery.delivered++; }
      else if (d === 'delivered') { delivery.delivered++; }
      else if (d === 'failed') { delivery.failed++; }
      else if (d === 'sent') { delivery.pending++; }
    }

    return NextResponse.json({ ...campaign, leads, delivery });

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
