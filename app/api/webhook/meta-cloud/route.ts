import { NextResponse, after } from 'next/server';
import { isPluginInstalled } from '@/lib/plugins/registry';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

import { db } from '@/lib/db/drizzle';
import { channelConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Dynamically fetch verify token from database config
  const rows = await db.select().from(channelConfigs).where(eq(channelConfigs.channel, 'meta-cloud')).limit(1);
  const metaRow = rows[0];
  const dbVerifyToken = metaRow?.metaWebhookToken;
  const expectedVerifyToken = dbVerifyToken || process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.NEXT_PUBLIC_EVOLUTION_WEBHOOK_TOKEN || 'token_verify_2026';

  if (mode === 'subscribe' && token === expectedVerifyToken) {
    console.log('[Meta Webhook] Verification successful');
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  console.warn('[Meta Webhook] Verification failed. Token mismatch. Expected:', expectedVerifyToken, 'Got:', token);
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function POST(request: Request) {
  const limited = checkRateLimit(`webhook:meta:${getClientIp(request)}`, RATE_LIMITS.webhook);
  if (limited) return limited;

  try {
    if (!isPluginInstalled('meta-cloud')) {
      return NextResponse.json({ error: 'Meta Cloud plugin not installed' }, { status: 400 });
    }

    const body = await request.json();

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ received: true, ignored: true });
    }

    const entries = body.entry;
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ received: true });
    }

    // Process in Kodelyx. Use after() so Vercel keeps the function alive to finish
    // processing AFTER the 200 response — a bare fire-and-forget promise can be frozen
    // when the serverless instance is suspended post-response, silently dropping status
    // updates (Meta gets its 200 and never retries them).
    const { processMetaWebhook } = await import('@/lib/plugins/meta-cloud/webhook-handler');

    after(async () => {
      try {
        await processMetaWebhook(entries);
      } catch (e) {
        console.error('[Meta Webhook] Processing error:', e);
      }
    });

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Meta Webhook] Error:', error.message);
    return NextResponse.json({ received: true });
  }
}
