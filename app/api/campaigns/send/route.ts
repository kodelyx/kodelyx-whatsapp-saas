import { NextResponse, after } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { checkRoutePermission } from '@/lib/auth/permissions-guard';
import { campaigns, campaignLeads } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { error } = await checkRoutePermission('campaigns');
    if (error) return error;

    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { campaignId } = await request.json();

    const campaign = await db.query.campaigns.findFirst({
        where: and(eq(campaigns.id, parseInt(campaignId)), eq(campaigns.teamId, team.id)),
        with: { template: true, instance: true }
    });

    if (!campaign || !campaign.template || !campaign.instance) {
        return NextResponse.json({ error: 'Campaign invalid' }, { status: 404 });
    }

    if (campaign.status !== 'DRAFT') {
        return NextResponse.json({ error: 'Campaign already started' }, { status: 400 });
    }

    const pendingCount = await db.query.campaignLeads.findMany({
        where: and(eq(campaignLeads.campaignId, campaign.id), eq(campaignLeads.status, 'PENDING')),
        columns: { id: true }
    });

    if (pendingCount.length === 0) {
        return NextResponse.json({ error: 'No pending leads' }, { status: 400 });
    }

    await db.update(campaigns)
        .set({ status: 'PROCESSING' })
        .where(eq(campaigns.id, campaign.id));

    // Kick off the first batch. after() guarantees the trigger is actually
    // sent even though this handler returns immediately — the /process route
    // then chains the remaining batches on its own. We derive the origin from
    // the incoming request so this works in production without relying on
    // NEXT_PUBLIC_APP_URL (which is empty there).
    let baseUrl: string;
    try {
        const origin = new URL(request.url).origin;
        baseUrl = origin && !origin.includes('localhost')
            ? origin
            : (process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    } catch {
        baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    }
    const cronSecret = process.env.CRON_SECRET;
    after(async () => {
      try {
        await fetch(`${baseUrl}/api/campaigns/process`, {
          headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Expected: the abort fires once the next invocation has started.
      }
    });

    return NextResponse.json({ success: true, message: 'Campaign queued for processing' });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
