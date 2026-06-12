import { NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';

// QR code not needed for WABA — only for WhatsApp Web
export async function GET() {
  return NextResponse.json({ error: 'QR Code is not required for Official WABA API.' }, { status: 400 });
}