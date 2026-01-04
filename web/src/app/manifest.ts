import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EduDash Pro - AI-Powered Educational Platform',
    short_name: 'EduDash Pro',
    description: 'Revolutionary AI-powered educational platform for preschools. Trusted by educators worldwide for next-generation learning experiences with Society 5.0 technology.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#00f5ff',
    // Prefer native app over PWA install
    prefer_related_applications: true,
    related_applications: [
      {
        platform: 'play',
        url: 'https://play.google.com/store/apps/details?id=com.edudashpro',
        id: 'com.edudashpro',
      },
      {
        platform: 'itunes',
        url: 'https://apps.apple.com/app/edudash-pro/id6478437234',
      },
    ],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.square.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
