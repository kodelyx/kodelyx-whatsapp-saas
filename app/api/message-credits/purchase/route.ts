import { NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import Razorpay from 'razorpay';

export const dynamic = 'force-dynamic';

const CREDIT_PACKS = [
  { id: 1, credits: 1000,   priceInr: 22000,   label: '1,000 Credits',   perMsg: '22p' },
  { id: 2, credits: 5000,   priceInr: 100000,  label: '5,000 Credits',   perMsg: '20p' },
  { id: 3, credits: 10000,  priceInr: 180000,  label: '10,000 Credits',  perMsg: '18p' },
  { id: 4, credits: 50000,  priceInr: 750000,  label: '50,000 Credits',  perMsg: '15p' },
  { id: 5, credits: 100000, priceInr: 1100000, label: '1,00,000 Credits', perMsg: '11p' },
];

export async function GET() {
  return NextResponse.json({ packs: CREDIT_PACKS });
}

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
    const { packId } = body;

    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: pack.priceInr, // already in paise
      currency: 'INR',
      receipt: `credits_${userWithTeam.teamId}_${packId}_${Date.now()}`,
      notes: {
        teamId: userWithTeam.teamId.toString(),
        packId: packId.toString(),
        credits: pack.credits.toString(),
        userId: user.id.toString(),
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      pack,
    });
  } catch (error: any) {
    console.error('[Razorpay Order]', error.message);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
