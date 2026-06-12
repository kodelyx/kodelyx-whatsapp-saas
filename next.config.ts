import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.whatsapp.net' },
      { protocol: 'https', hostname: '**.fna.fbcdn.net' },
      { protocol: 'https', hostname: 'scontent.whatsapp.net' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: 'pps.whatsapp.net' },
    ],
  },
  allowedDevOrigins: ['chatbulky.com', 'www.chatbulky.com'],
};

export default withNextIntl(nextConfig);