import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EduDash Pro - AI-Powered Educational Platform',
    short_name: 'EduDash Pro',
    description: 'Revolutionary AI-powered educational platform for preschools. Trusted by educators worldwide for next-generation learning experiences with Society 5.0 technology.',
    lang: 'en-ZA',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#00f5ff',
    orientation: 'portrait',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    prefer_related_applications: false,
    categories: ['education', 'productivity'],
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
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'View your dashboard',
        url: '/dashboard',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
      {
        name: 'Messages',
        short_name: 'Messages',
        description: 'View messages',
        url: '/dashboard/parent/messages',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    ],
    screenshots: [
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        form_factor: 'wide',
        label: 'EduDash Pro Dashboard',
      },
    ],
  };
}
