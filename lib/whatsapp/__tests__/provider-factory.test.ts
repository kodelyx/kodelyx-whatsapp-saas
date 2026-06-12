import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWhatsAppProvider } from '../provider-factory';
import type { WhatsAppInstanceConfig } from '../types';

vi.mock('@/lib/plugins/registry', () => ({
  isPluginInstalled: vi.fn(),
}));

import { isPluginInstalled } from '@/lib/plugins/registry';

const metaCloudConfig: WhatsAppInstanceConfig = {
  id: 3,
  instanceName: 'meta-direct',
  accessToken: '',
  integration: 'META-CLOUD',
  metaToken: 'EAA-direct-token',
  metaPhoneNumberId: '67890',
  metaBusinessId: 'biz-002',
};

const wabaConfig: WhatsAppInstanceConfig = {
  id: 2,
  instanceName: 'waba',
  accessToken: '',
  integration: 'WHATSAPP-BUSINESS',
  metaToken: 'EAA-token',
  metaPhoneNumberId: '12345',
};

const legacyBaileysConfig: WhatsAppInstanceConfig = {
  id: 1,
  instanceName: 'evo-instance',
  accessToken: 'token-123',
  integration: 'WHATSAPP-BAILEYS',
};

describe('Provider Factory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return MetaCloudProvider for META-CLOUD when plugin is installed', async () => {
    vi.mocked(isPluginInstalled).mockReturnValue(true);

    const provider = await getWhatsAppProvider(metaCloudConfig);
    expect(provider.providerType).toBe('META-CLOUD');
  });

  it('should return MetaCloudProvider for WHATSAPP-BUSINESS when plugin is installed', async () => {
    vi.mocked(isPluginInstalled).mockReturnValue(true);

    const provider = await getWhatsAppProvider(wabaConfig);
    expect(provider.providerType).toBe('META-CLOUD');
  });

  it('should throw when Meta Cloud plugin is not installed', async () => {
    vi.mocked(isPluginInstalled).mockReturnValue(false);

    await expect(getWhatsAppProvider(metaCloudConfig)).rejects.toThrow(
      'Meta Cloud plugin is not installed'
    );
  });

  it('should throw for unsupported (legacy Evolution) integrations', async () => {
    vi.mocked(isPluginInstalled).mockReturnValue(true);

    await expect(getWhatsAppProvider(legacyBaileysConfig)).rejects.toThrow(
      'Unsupported WhatsApp integration'
    );
  });
});
