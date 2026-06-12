import { NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { messageCreditTransactions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

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

    const transactions = await db.query.messageCreditTransactions.findMany({
      where: eq(messageCreditTransactions.teamId, userWithTeam.teamId),
      orderBy: [desc(messageCreditTransactions.createdAt)],
      limit: 50,
    });

    return NextResponse.json({ transactions });
  } catch (error: any) {
    console.error('[Message Credits History]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
