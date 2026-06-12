import type { WhatsAppProvider, WhatsAppInstanceConfig } from './types';
import { isPluginInstalled } from '@/lib/plugins/registry';

export async function getWhatsAppProvider(instance: WhatsAppInstanceConfig): Promise<WhatsAppProvider> {
  if (instance.integration === 'META-CLOUD' || instance.integration === 'WHATSAPP-BUSINESS') {
    if (!isPluginInstalled('meta-cloud')) {
      throw new Error('Meta Cloud plugin is not installed. Cannot create provider for WABA instance.');
    }

    try {
      const { MetaCloudProvider } = await import('@/lib/plugins/meta-cloud/provider');
      return new MetaCloudProvider(instance);
    } catch (e) {
      throw new Error('Failed to load Meta Cloud provider. Ensure the plugin is properly installed.');
    }
  }

  throw new Error(`Unsupported WhatsApp integration "${instance.integration}". Only the official Meta Cloud API is supported.`);
}
