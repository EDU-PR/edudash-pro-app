import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { PWAUpdateChecker } from "@/components/PWAUpdateChecker";
import { DeploymentNotificationProvider } from "@/components/DeploymentNotificationProvider";
import { PWASplashScreen } from "@/components/PWASplashScreen";
import { CallProviderWrapper } from "@/components/calls/CallProviderWrapper";
import { NativeAppManager } from "@/components/NativeAppManager";
import 'katex/dist/katex.min.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EduDash Pro",
  description: "Educational dashboard for South African preschools",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EduDash Pro",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export function generateViewport() {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    themeColor: "#111111",
    interactiveWidget: "resizes-visual",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Next.js automatically adds manifest link from manifest.ts */}
        <meta name="theme-color" content="#111111" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="EduDash Pro" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <PWASplashScreen />
        <PWARegister />
        <PWAInstallPrompt />
        <PWAUpdateChecker />
        <DeploymentNotificationProvider />
        <NativeAppManager enableSounds={true} />
        <CallProviderWrapper>
          <ErrorBoundary>{children}</ErrorBoundary>
        </CallProviderWrapper>
      </body>
    </html>
  );
}
