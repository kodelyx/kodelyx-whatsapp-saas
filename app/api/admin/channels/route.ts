import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { channelConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { clearChannelConfigCache } from '@/lib/whatsapp/config';
import { isPluginInstalled } from '@/lib/plugins/registry';

export async function GET() {
  try {
    const user = await getUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await db.select().from(channelConfigs);
    const metaRow = rows.find(r => r.channel === 'meta-cloud');

    const metaCloud = {
      channel: 'meta-cloud',
      isActive: metaRow?.isActive ?? false,
      metaAppId: metaRow?.metaAppId || process.env.META_APP_ID || '',
      metaAppSecret: metaRow?.metaAppSecret || process.env.META_APP_SECRET || '',
      metaConfigId: metaRow?.metaConfigId || process.env.NEXT_PUBLIC_META_CONFIG_ID || '',
      metaWebhookToken: metaRow?.metaWebhookToken || process.env.META_WEBHOOK_VERIFY_TOKEN || '',
    };

    return NextResponse.json({
      channels: { metaCloud },
      plugins: { metaCloud: isPluginInstalled('meta-cloud') },
    });
  } catch (error: any) {
    console.error('[Admin Channels]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function registerMetaWebhook(appId: string, appSecret: string, callbackUrl: string, verifyToken: string) {
  const appAccessToken = `${appId}|${appSecret}`;
  const url = `https://graph.facebook.com/${appId}/subscriptions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      object: 'whatsapp_business_account',
      callback_url: callbackUrl,
      verify_token: verifyToken,
      fields: 'messages,message_deliveries',
      access_token: appAccessToken,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Unknown Graph API error');
  }
  return data;
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { channel, isActive, metaAppId, metaAppSecret, metaConfigId, metaWebhookToken } = body;

    if (channel !== 'meta-cloud') {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
    }


    const updateData: Record<string, any> = {
      isActive: isActive ?? false,
      updatedAt: new Date(),
    };

    if (channel === 'meta-cloud') {
      if (metaAppId !== undefined) updateData.metaAppId = metaAppId || null;
      if (metaAppSecret !== undefined) updateData.metaAppSecret = metaAppSecret || null;
      if (metaConfigId !== undefined) updateData.metaConfigId = metaConfigId || null;
      if (metaWebhookToken !== undefined) updateData.metaWebhookToken = metaWebhookToken || null;
    }

    
    const existing = await db.select({ id: channelConfigs.id }).from(channelConfigs)
      .where(eq(channelConfigs.channel, channel)).limit(1);

    if (existing.length > 0) {
      await db.update(channelConfigs)
        .set(updateData)
        .where(eq(channelConfigs.channel, channel));
    } else {
      await db.insert(channelConfigs).values({
        channel,
        ...updateData,
      });
    }

    clearChannelConfigCache();

    // Programmatically configure Webhooks on Meta if channel is WABA and activated
    if (channel === 'meta-cloud' && isActive === true) {
      if (metaAppId && metaAppSecret) {
        try {
          const origin = process.env.BASE_URL || request.nextUrl.origin;
          const callbackUrl = `${origin}/webhook`;
          const verifyToken = metaWebhookToken || process.env.META_WEBHOOK_VERIFY_TOKEN || 'token_verify_2026';

          console.log('[Admin Channels] Programmatically registering WABA Webhook at Meta:', callbackUrl);

          await registerMetaWebhook(metaAppId, metaAppSecret, callbackUrl, verifyToken);
          console.log('[Admin Channels] Meta Webhook registered successfully!');
        } catch (err: any) {
          console.error('[Admin Channels] Meta Webhook registration failed:', err.message);
          return NextResponse.json({ 
            error: `Failed to configure Webhook in Meta: ${err.message}. Please check your App ID, App Secret, and ensure your server is publicly accessible.` 
          }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: 'App ID and App Secret are required to activate Meta Cloud API.' }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Admin Channels]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
