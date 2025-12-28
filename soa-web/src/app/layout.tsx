import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Soil of Africa | Growing Leaders, Cultivating Futures',
  description:
    'Join Soil of Africa - a community of learners, facilitators, and mentors across South Africa. Register for membership, access resources, and connect with your region.',
  keywords: [
    'Soil of Africa',
    'membership',
    'South Africa',
    'education',
    'community',
    'leadership',
    'EduDash Pro',
  ],
  openGraph: {
    title: 'Soil of Africa | Growing Leaders, Cultivating Futures',
    description:
      'Join thousands of members making a difference in their communities across South Africa.',
    url: 'https://soilofafrica.org',
    siteName: 'Soil of Africa',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_ZA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Soil of Africa | Growing Leaders, Cultivating Futures',
    description:
      'Join thousands of members making a difference in their communities across South Africa.',
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        {/* Twitter/X Embed Script */}
        <Script
          src="https://platform.twitter.com/widgets.js"
          strategy="lazyOnload"
          charSet="utf-8"
        />
      </body>
    </html>
  );
}
