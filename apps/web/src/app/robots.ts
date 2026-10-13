import type { MetadataRoute } from 'next';
import { publicConfig } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: ['/', '/u/', '/v/', '/c/', '/discover', '/legal/'], disallow: ['/api/', '/admin', '/settings', '/messages', '/onboarding'] },
    ],
    sitemap: `${publicConfig.appUrl}/sitemap.xml`,
  };
}
