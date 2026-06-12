import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { campaigns, campaignLeads } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';

export async function DELETE(request: Request) {
    try {
        const team = await getTeamForUser();
        if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
        }

        // Delete associated leads first due to foreign key constraints if no cascade
        await db.delete(campaignLeads).where(eq(campaignLeads.campaignId, parseInt(id)));
        
        // Delete the campaign
        await db.delete(campaigns).where(
            and(
                eq(campaigns.id, parseInt(id)),
                eq(campaigns.teamId, team.id)
            )
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Campaign Delete Error]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
