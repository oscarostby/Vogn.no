import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VOGN',
    short_name: 'VOGN',
    description: 'Your crew. Your space.',
    start_url: '/home',
    display: 'standalone',
    background_color: '#101114',
    theme_color: '#101114',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
