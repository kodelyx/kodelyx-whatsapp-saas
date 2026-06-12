import { NextResponse } from 'next/server';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { evolutionInstances, ActivityType } from '@/lib/db/schema';
import { logActivity } from '@/lib/db/activity';
import { enforceLimit } from '@/lib/limits';
import { getMetaCloudConfig } from '@/lib/whatsapp/config';

// Subscribe the app to the WABA, then set a phone-number-level webhook override.
// This is the two-step flow Meta requires: a plain subscribe must succeed before
// the override call is allowed, otherwise Meta returns "(#100) ... must be subscribed".
async function configureWebhook(opts: {
  apiVersion: string;
  wabaId: string;
  phoneNumberId: string;
  token: string;
  callbackUrl: string;
  verifyToken: string;
}): Promise<{ subscribed: boolean; overridden: boolean; error?: string }> {
  const { apiVersion, wabaId, phoneNumberId, token, callbackUrl, verifyToken } = opts;
  const base = 'https://graph.facebook.com';
  try {
    // Step 1 — subscribe the app to the WhatsApp Business Account.
    const subRes = await fetch(`${base}/${apiVersion}/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    const subJson = await subRes.json().catch(() => ({}));
    if (!subRes.ok || subJson?.success === false) {
      return { subscribed: false, overridden: false, error: subJson?.error?.message || 'Failed to subscribe app to WABA' };
    }

    // Step 2 — override the callback URL for this specific phone number.
    const ovrRes = await fetch(`${base}/${apiVersion}/${phoneNumberId}/subscribed_apps`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ override_callback_uri: callbackUrl, verify_token: verifyToken }),
      signal: AbortSignal.timeout(10000),
    });
    const ovrJson = await ovrRes.json().catch(() => ({}));
    if (!ovrRes.ok || ovrJson?.success === false) {
      return { subscribed: true, overridden: false, error: ovrJson?.error?.message || 'Failed to set webhook override' };
    }
    return { subscribed: true, overridden: true };
  } catch (e: any) {
    return { subscribed: false, overridden: false, error: e.message };
  }
}

export async function POST(request: Request) {
  try {
    const {
      instanceName,
      metaToken,
      metaBusinessId,
      metaPhoneNumberId,
    } = await request.json();

    const user = await getUser();
    const team = await getTeamForUser();
    
    if (!team || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await enforceLimit(team.id, 'instances');
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    if (!instanceName || !metaPhoneNumberId || !metaBusinessId || !metaToken) {
      return NextResponse.json({ error: 'All fields are required: Instance Name, Phone Number ID, Business Account (WABA) ID, and System User Token.' }, { status: 400 });
    }

    const slug = `t${team.id}_${Date.now().toString(36)}`;
    const evoInstanceName = instanceName ? `${slug}_${instanceName.replace(/[^a-zA-Z0-9_-]/g, '')}` : slug;
    const userDisplayName = instanceName || `Instance ${slug}`;

    console.log(`Starting instance setup: ${evoInstanceName} (display: ${userDisplayName}) [WHATSAPP-BUSINESS]`);

    // Verify token with Meta Graph API
    let phoneInfo: any = null;
    const apiVersion = process.env.API_VERSION || 'v25.0';
    
    try {
      const verifyRes = await fetch(
        `https://graph.facebook.com/${apiVersion}/${metaPhoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        {
          headers: { 'Authorization': `Bearer ${metaToken}` },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        return NextResponse.json({ error: `Invalid Meta credentials: ${err.error?.message || 'Check Token/Phone Number ID.'}` }, { status: 400 });
      }
      phoneInfo = await verifyRes.json();
      console.log(`[Meta] Verified: ${phoneInfo.display_phone_number} (${phoneInfo.verified_name})`);
    } catch (e: any) {
      return NextResponse.json({ error: `Failed to verify Meta credentials: ${e.message}` }, { status: 500 });
    }

    const instanceId = `meta_${metaPhoneNumberId}`;

    await db.insert(evolutionInstances)
      .values({
        teamId: team.id,
        instanceName: evoInstanceName,
        displayName: userDisplayName,
        instanceNumber: phoneInfo?.display_phone_number || metaPhoneNumberId,
        evolutionInstanceId: instanceId,
        accessToken: metaToken,
        integration: 'WHATSAPP-BUSINESS',
        metaBusinessId: metaBusinessId || null,
        metaPhoneNumberId: metaPhoneNumberId,
        metaWabaId: metaBusinessId || null,
        metaToken: metaToken,
      })
      .onConflictDoUpdate({
        target: [evolutionInstances.teamId, evolutionInstances.instanceName],
        set: {
          instanceNumber: phoneInfo?.display_phone_number || metaPhoneNumberId,
          evolutionInstanceId: instanceId,
          accessToken: metaToken,
          integration: 'WHATSAPP-BUSINESS',
          metaBusinessId: metaBusinessId || null,
          metaPhoneNumberId: metaPhoneNumberId,
          metaWabaId: metaBusinessId || null,
          metaToken: metaToken,
          updatedAt: new Date(),
        }
      });

    await logActivity(team.id, user.id, ActivityType.CREATE_INSTANCE);

    // Auto-configure webhook so messages start flowing without any manual step:
    // subscribe the app to the WABA and override the callback URL to point at /webhook.
    let webhook: { subscribed: boolean; overridden: boolean; error?: string } = { subscribed: false, overridden: false };
    const wabaId = metaBusinessId;
    if (wabaId) {
      const metaCfg = await getMetaCloudConfig();
      const verifyToken = metaCfg.webhookToken
        || process.env.META_WEBHOOK_VERIFY_TOKEN
        || process.env.NEXT_PUBLIC_EVOLUTION_WEBHOOK_TOKEN
        || 'token_verify_2026';
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || new URL(request.url).origin).replace(/\/$/, '');
      const callbackUrl = `${appUrl}/webhook`;
      webhook = await configureWebhook({
        apiVersion,
        wabaId,
        phoneNumberId: metaPhoneNumberId,
        token: metaToken,
        callbackUrl,
        verifyToken,
      });
      if (webhook.error) {
        console.warn(`[Meta] Webhook auto-config issue: ${webhook.error}`);
      } else {
        console.log(`[Meta] Webhook subscribed + override set -> ${callbackUrl}`);
      }
    } else {
      webhook.error = 'No Business Account (WABA) ID provided — webhook was not auto-configured.';
    }

    return NextResponse.json({
      instance: {
        instanceName: evoInstanceName,
        instanceId: instanceId,
        integration: 'WHATSAPP-BUSINESS',
        phoneNumber: phoneInfo?.display_phone_number,
        verifiedName: phoneInfo?.verified_name,
      },
      hash: metaToken,
      type: 'WHATSAPP-BUSINESS',
      qrcode: null,
      webhook,
    });

  } catch (error: any) {
    console.error('Fatal error in instance setup:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}