import { NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { messageCredits } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'No team found' }, { status: 403 });
    }

    let credits = await db.query.messageCredits.findFirst({
      where: eq(messageCredits.teamId, userWithTeam.teamId),
    });

    if (!credits) {
      // Initialize with 0 credits
      const [newCredits] = await db.insert(messageCredits).values({
        teamId: userWithTeam.teamId,
        balance: 0,
      }).returning();
      credits = newCredits;
    }

    return NextResponse.json({ balance: credits.balance });
  } catch (error: any) {
    console.error('[Message Credits]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
