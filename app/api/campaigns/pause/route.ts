import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { campaigns } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';

export async function POST(request: Request) {
    try {
        const team = await getTeamForUser();
        if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { campaignId } = await request.json();

        if (!campaignId) {
            return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
        }

        await db.update(campaigns)
            .set({ status: 'PAUSED' })
            .where(
                and(
                    eq(campaigns.id, campaignId),
                    eq(campaigns.teamId, team.id)
                )
            );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Campaign Pause Error]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
