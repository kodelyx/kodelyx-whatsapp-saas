import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { campaigns, campaignLeads } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(request: Request) {
    try {
        const team = await getTeamForUser();
        if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { campaignId } = await request.json();
        if (!campaignId) return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });

        const campaign = await db.query.campaigns.findFirst({
            where: and(eq(campaigns.id, campaignId), eq(campaigns.teamId, team.id))
        });

        if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

        // Reset all FAILED leads to PENDING
        const result = await db.update(campaignLeads)
            .set({ status: 'PENDING', error: null })
            .where(and(
                eq(campaignLeads.campaignId, campaignId),
                eq(campaignLeads.status, 'FAILED')
            ));

        // Reset campaign failed count and set status back to PROCESSING
        await db.update(campaigns)
            .set({ status: 'PROCESSING', failedCount: 0 })
            .where(eq(campaigns.id, campaignId));

        return NextResponse.json({ success: true, message: 'Failed leads queued for resend' });
    } catch (error: any) {
        console.error('[Retry Failed]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
