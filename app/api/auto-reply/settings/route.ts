import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { autoReplySettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const team = await getTeamForUser();
        if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const instanceId = searchParams.get('instanceId');
        if (!instanceId) return NextResponse.json({ error: 'instanceId required' }, { status: 400 });

        const settings = await db.query.autoReplySettings.findFirst({
            where: and(
                eq(autoReplySettings.teamId, team.id),
                eq(autoReplySettings.instanceId, parseInt(instanceId))
            )
        });

        return NextResponse.json(settings || {
            autoReplyEnabled: false,
            autoReplyMessage: 'Thank you for contacting us! We will get back to you shortly.',
            autoReplyDelaySeconds: 300,
            autoReplyIntervalHours: 12,
            followup1Enabled: false,
            followup1Message: '🔔 Reminder: Check our latest offers!',
            followup1DelayMinutes: 480,
            followup2Enabled: false,
            followup2Message: '⏰ Last chance! This offer expires soon.',
            followup2DelayMinutes: 720,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const team = await getTeamForUser();
        if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { instanceId, ...settings } = body;

        if (!instanceId) return NextResponse.json({ error: 'instanceId required' }, { status: 400 });

        const existing = await db.query.autoReplySettings.findFirst({
            where: and(
                eq(autoReplySettings.teamId, team.id),
                eq(autoReplySettings.instanceId, parseInt(instanceId))
            )
        });

        if (existing) {
            await db.update(autoReplySettings)
                .set({ ...settings, updatedAt: new Date() })
                .where(eq(autoReplySettings.id, existing.id));
        } else {
            await db.insert(autoReplySettings).values({
                teamId: team.id,
                instanceId: parseInt(instanceId),
                ...settings,
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
