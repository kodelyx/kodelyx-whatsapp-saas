import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { campaigns, campaignLeads, messages } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

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

    // Pull leads together with their downstream delivery status. messages.status is
    // updated by Meta status webhooks (sent → delivered → read, or failed), linked
    // by campaign_leads.message_id === messages.id. Left join so leads without a
    // message row (silent sends / not yet sent) still appear.
    const leadRows = await db
      .select({
        id: campaignLeads.id,
        phone: campaignLeads.phone,
        status: campaignLeads.status,
        error: campaignLeads.error,
        messageId: campaignLeads.messageId,
        deliveryStatus: messages.status,
      })
      .from(campaignLeads)
      .leftJoin(messages, eq(messages.id, campaignLeads.messageId))
      .where(eq(campaignLeads.campaignId, campaignId))
      .orderBy(desc(campaignLeads.status));

    // Aggregate delivery counts from the webhook-updated message status.
    const delivery = { delivered: 0, read: 0, failed: 0, pending: 0, available: false };
    for (const l of leadRows) {
      const d = l.deliveryStatus;
      if (!d) continue;
      delivery.available = true;
      if (d === 'read') { delivery.read++; delivery.delivered++; }
      else if (d === 'delivered') { delivery.delivered++; }
      else if (d === 'failed') { delivery.failed++; }
      else if (d === 'sent') { delivery.pending++; }
    }

    return NextResponse.json({ ...campaign, leads: leadRows, delivery });

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
