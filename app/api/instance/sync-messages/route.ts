import { NextResponse } from 'next/server';

// Sync messages from Evolution not applicable
export async function POST() {
  return NextResponse.json({ messages: [], message: 'WABA uses webhook-based message delivery.' });
}
