import { NextResponse } from 'next/server';

// Sync chats from Evolution not applicable — WABA uses webhooks
export async function POST() {
  return NextResponse.json({ chats: [], message: 'WABA uses webhook-based message delivery. No sync needed.' });
}
