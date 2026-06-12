import { db } from '@/lib/db/drizzle';

// NOTE: Voice calling is a stubbed/disabled feature (Twilio not wired up).
// These signatures match their call sites so the project type-checks and builds;
// behaviour stays a safe no-op / explicit "not configured" until Twilio is implemented.

export async function getCreditsBalance(teamId: number): Promise<number> {
  // Voice call credits - returns 0 when Twilio is not configured
  return 0;
}

export async function generateClientToken(params: {
  teamId: number;
  userId: number;
}): Promise<{ token: string; identity: string }> {
  throw new Error('Voice calls not configured. Set up Twilio credentials in admin panel.');
}

export async function handleCallStatusUpdate(
  callSid: string,
  callStatus: string,
  callDuration?: number,
  recordingUrl?: string,
  recordingSid?: string,
): Promise<void> {
  console.warn('[Voice Call] Twilio not configured, ignoring status update.');
}

export async function initiateCall(params: {
  teamId: number;
  userId: number;
  to: string;
  from: string;
}): Promise<{ callSid: string }> {
  throw new Error('Voice calls not configured.');
}

export async function addCredits(
  teamId: number,
  amount: number,
  paymentReference?: string,
  description?: string,
): Promise<void> {
  console.warn('[Voice Call] Twilio not configured, skipping addCredits.');
}

export async function provisionPhoneNumber(
  teamId: number,
  phoneNumber: string,
  subscriptionId?: string,
): Promise<void> {
  console.warn('[Voice Call] Twilio not configured, skipping provisionPhoneNumber.');
}
