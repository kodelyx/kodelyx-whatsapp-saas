import type {
  WhatsAppProvider,
  WhatsAppInstanceConfig,
  SendTextPayload,
  SendMediaPayload,
  SendAudioPayload,
  SendReactionPayload,
  SendInteractivePayload,
  SendTemplatePayload,
  SendResult,
  ConnectionStatus,
} from '@/lib/whatsapp/types';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class MetaCloudProvider implements WhatsAppProvider {
  readonly providerType = 'META-CLOUD';
  private phoneNumberId: string;
  private token: string;
  private instanceName: string;

  constructor(config: WhatsAppInstanceConfig) {
    this.phoneNumberId = config.metaPhoneNumberId || '';
    this.token = config.metaToken || '';
    this.instanceName = config.instanceName;

    if (!this.phoneNumberId || !this.token) {
      console.warn(`[MetaCloudProvider] Missing metaPhoneNumberId or metaToken for instance ${config.instanceName}`);
    }
  }

  private formatRecipient(remoteJid: string): string {
    // Convert 919876543210@s.whatsapp.net → 919876543210
    return remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '');
  }

  private async graphPost(endpoint: string, body: any): Promise<any> {
    const url = `${GRAPH_API_BASE}/${this.phoneNumberId}/${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[MetaCloudProvider] API Error:', JSON.stringify(data));
      throw new Error(data.error?.message || `Meta API error: ${response.status}`);
    }

    return data;
  }

  async sendText(remoteJid: string, payload: SendTextPayload): Promise<SendResult> {
    try {
      const to = this.formatRecipient(remoteJid);

      const body: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: payload.text },
      };

      // Context for quoted messages
      if (payload.quoted?.id) {
        body.context = { message_id: payload.quoted.id };
      }

      const data = await this.graphPost('messages', body);
      const messageId = data.messages?.[0]?.id;

      return { success: true, messageId, raw: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendMedia(remoteJid: string, payload: SendMediaPayload): Promise<SendResult> {
    try {
      const to = this.formatRecipient(remoteJid);

      // Upload media first
      const mediaId = await this.uploadMedia(payload.mediaBase64, payload.mimetype);
      if (!mediaId) {
        return { success: false, error: 'Failed to upload media to Meta' };
      }

      let metaType: string;
      let mediaPayload: any;

      if (payload.mediaType === 'image') {
        metaType = 'image';
        mediaPayload = { id: mediaId, caption: payload.caption || undefined };
      } else if (payload.mediaType === 'video') {
        metaType = 'video';
        mediaPayload = { id: mediaId, caption: payload.caption || undefined };
      } else {
        metaType = 'document';
        mediaPayload = { id: mediaId, caption: payload.caption || undefined, filename: payload.fileName || 'document' };
      }

      const body: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: metaType,
        [metaType]: mediaPayload,
      };

      if (payload.quoted?.id) {
        body.context = { message_id: payload.quoted.id };
      }

      const data = await this.graphPost('messages', body);
      const messageId = data.messages?.[0]?.id;

      return { success: true, messageId, raw: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendAudio(remoteJid: string, payload: SendAudioPayload): Promise<SendResult> {
    try {
      const to = this.formatRecipient(remoteJid);

      const mimetype = payload.mimetype || 'audio/ogg; codecs=opus';
      const mediaId = await this.uploadMedia(payload.audioBase64, mimetype);
      if (!mediaId) {
        return { success: false, error: 'Failed to upload audio to Meta' };
      }

      const body: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'audio',
        audio: { id: mediaId },
      };

      if (payload.quoted?.id) {
        body.context = { message_id: payload.quoted.id };
      }

      const data = await this.graphPost('messages', body);
      const messageId = data.messages?.[0]?.id;

      return { success: true, messageId, raw: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendReaction(remoteJid: string, payload: SendReactionPayload): Promise<SendResult> {
    try {
      const to = this.formatRecipient(remoteJid);

      const body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'reaction',
        reaction: {
          message_id: payload.messageId,
          emoji: payload.emoji,
        },
      };

      const data = await this.graphPost('messages', body);
      const messageId = data.messages?.[0]?.id;

      return { success: true, messageId, raw: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendInteractive(remoteJid: string, payload: SendInteractivePayload): Promise<SendResult> {
    try {
      const to = this.formatRecipient(remoteJid);

      const body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: payload.type,
          body: payload.body,
          header: payload.header,
          footer: payload.footer,
          action: payload.action,
        },
      };

      const data = await this.graphPost('messages', body);
      const messageId = data.messages?.[0]?.id;

      return { success: true, messageId, raw: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendTemplate(remoteJid: string, payload: SendTemplatePayload): Promise<SendResult> {
    try {
      const to = this.formatRecipient(remoteJid);

      const body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: payload.templateName,
          language: { code: payload.language },
          components: payload.components || [],
        },
      };

      const data = await this.graphPost('messages', body);
      const messageId = data.messages?.[0]?.id;

      return { success: true, messageId, raw: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    // WABA is always "connected" if credentials are valid
    if (!this.phoneNumberId || !this.token) return 'close';
    try {
      const res = await fetch(`${GRAPH_API_BASE}/${this.phoneNumberId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok ? 'open' : 'close';
    } catch {
      return 'unknown';
    }
  }

  async disconnect(): Promise<void> {
    // WABA doesn't have a disconnect concept
    console.log(`[MetaCloudProvider] Disconnect called for ${this.instanceName} (no-op for WABA)`);
  }

  // --- Private helpers ---

  private async uploadMedia(base64Data: string, mimetype: string): Promise<string | null> {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: mimetype });

      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', mimetype);
      formData.append('file', blob, `upload.${this.getExtFromMime(mimetype)}`);

      const response = await fetch(`${GRAPH_API_BASE}/${this.phoneNumberId}/media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('[MetaCloudProvider] Media upload error:', data);
        return null;
      }

      return data.id || null;
    } catch (err: any) {
      console.error('[MetaCloudProvider] Media upload failed:', err.message);
      return null;
    }
  }

  private getExtFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'video/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/ogg; codecs=opus': 'ogg',
      'audio/mp4': 'm4a', 'audio/mpeg': 'mp3',
      'application/pdf': 'pdf',
    };
    return map[mime] || 'bin';
  }
}
