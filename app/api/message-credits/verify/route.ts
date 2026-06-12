import { NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { messageCredits, messageCreditTransactions } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, credits, packLabel, packPrice } = body;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    const teamId = userWithTeam.teamId;

    // Upsert message credits
    const existing = await db.query.messageCredits.findFirst({
      where: eq(messageCredits.teamId, teamId),
    });

    if (existing) {
      await db.update(messageCredits).set({
        balance: sql`${messageCredits.balance} + ${credits}`,
        updatedAt: new Date(),
      }).where(eq(messageCredits.teamId, teamId));
    } else {
      await db.insert(messageCredits).values({
        teamId,
        balance: credits,
      });
    }

    // Log transaction
    await db.insert(messageCreditTransactions).values({
      teamId,
      type: 'purchase',
      amount: credits,
      description: `Purchased ${packLabel} (₹${(packPrice / 100).toLocaleString('en-IN')}) • ${razorpay_payment_id}`,
    });

    // Fetch updated balance
    const updated = await db.query.messageCredits.findFirst({
      where: eq(messageCredits.teamId, teamId),
    });

    return NextResponse.json({ 
      success: true, 
      balance: updated?.balance ?? 0,
      credited: credits,
    });
  } catch (error: any) {
    console.error('[Payment Verify]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
