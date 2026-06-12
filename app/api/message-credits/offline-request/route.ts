import { NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { messageCreditTransactions } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'No team found' }, { status: 403 });
    }

    const body = await req.json();
    const { packId, packLabel, packPrice, credits, utr } = body;

    if (!utr || utr.length < 6) {
      return NextResponse.json({ error: 'Invalid UTR/Transaction ID' }, { status: 400 });
    }

    // Log the offline request
    await db.insert(messageCreditTransactions).values({
      teamId: userWithTeam.teamId,
      type: 'offline_request',
      amount: credits,
      status: 'pending',
      utr: utr,
      description: `Requested ${packLabel} (₹${(packPrice / 100).toLocaleString('en-IN')}) via UPI`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Offline Request]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
