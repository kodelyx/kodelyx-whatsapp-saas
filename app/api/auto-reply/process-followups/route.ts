import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { scheduledFollowups, evolutionInstances } from '@/lib/db/schema';
import { eq, and, lte } from 'drizzle-orm';

// Cron job: processes due follow-ups every minute
export async function GET() {
    try {
        const now = new Date();

        const dueFollowups = await db.query.scheduledFollowups.findMany({
            where: and(
                eq(scheduledFollowups.sent, false),
                lte(scheduledFollowups.scheduledAt, now)
            ),
            limit: 50,
        });

        if (dueFollowups.length === 0) {
            return NextResponse.json({ message: 'No follow-ups due' });
        }

        let sent = 0, failed = 0;

        for (const fu of dueFollowups) {
            try {
                // Mark as sent first (prevent duplicates)
                await db.update(scheduledFollowups)
                    .set({ sent: true })
                    .where(eq(scheduledFollowups.id, fu.id));

                // Get instance for token & phone number ID
                const instance = await db.query.evolutionInstances.findFirst({
                    where: eq(evolutionInstances.id, fu.instanceId)
                });

                if (!instance?.metaToken || !instance?.metaPhoneNumberId) {
                    failed++;
                    continue;
                }

                // Send via Meta API
                const response = await fetch(
                    `https://graph.facebook.com/v25.0/${instance.metaPhoneNumberId}/messages`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${instance.metaToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            messaging_product: 'whatsapp',
                            to: fu.phone,
                            type: 'text',
                            text: { body: fu.message },
                        }),
                        signal: AbortSignal.timeout(10000),
                    }
                );

                if (response.ok) {
                    sent++;
                } else {
                    failed++;
                    const err = await response.json();
                    console.error('[Follow-Up Send Error]', fu.phone, err);
                }

                // Small delay between sends
                await new Promise(r => setTimeout(r, 200));
            } catch (e: any) {
                failed++;
                console.error('[Follow-Up Error]', e.message);
            }
        }

        return NextResponse.json({ success: true, sent, failed, total: dueFollowups.length });
    } catch (error: any) {
        console.error('[Follow-Up Process Error]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
