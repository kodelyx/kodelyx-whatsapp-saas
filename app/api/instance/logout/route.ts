import { NextResponse } from 'next/server';

// Logout not applicable for WABA — token-based auth
export async function POST() {
  return NextResponse.json({ message: 'WABA instances use token auth. No logout needed.' });
}