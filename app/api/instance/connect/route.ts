import { NextResponse } from 'next/server';

// Connect not needed for WABA — already connected via token
export async function GET() {
  return NextResponse.json({ error: 'Connect/QR is not required for Official WABA API.' }, { status: 400 });
}