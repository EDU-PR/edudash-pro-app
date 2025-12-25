'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Header, Footer } from '@/components';
import { FadeIn, SlideIn, ScaleIn, StaggerChildren } from '@/components/animations';
import {
  Smartphone,
  Download,
  Apple,
  QrCode,
  CheckCircle2,
  ExternalLink,
  Leaf,
  Globe,
} from 'lucide-react';

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <ScaleIn>
              <div className="w-20 h-20 bg-gradient-to-br from-soa-primary to-soa-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-soa-primary/25">
                <Smartphone className="w-10 h-10 text-white" />
              </div>
            </ScaleIn>
            <FadeIn delay={0.1}>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Download the EduDash Pro App
              </h1>
            </FadeIn>
            <SlideIn direction="up" delay={0.2}>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Access your Soil of Africa membership, digital ID card, resources, and events on
                the go. Available on Android and iOS.
              </p>
            </SlideIn>
          </div>

          {/* Download Options */}
          <StaggerChildren className="grid md:grid-cols-2 gap-6 mb-12" staggerDelay={0.1}>
            {/* Android */}
            <motion.div 
              className="bg-white rounded-2xl shadow-sm p-8"
              whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-soa-light rounded-xl flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-soa-primary" fill="currentColor">
                    <path d="M17.523 15.341c-.5.5-1.172.784-1.875.784h-7.296c-.703 0-1.375-.284-1.875-.784l-3.773-3.773c-.5-.5-.5-1.311 0-1.811l8.296-8.296c.5-.5 1.311-.5 1.811 0l8.296 8.296c.5.5.5 1.311 0 1.811l-3.584 3.773zm-1.523-12.591l-8 8h4v4h4v-4h4l-8-8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Android</h3>
                  <p className="text-sm text-gray-500">Google Play Store</p>
                </div>
              </div>

              <a
                href={process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition mb-4"
              >
                <Download className="w-5 h-5" />
                Get on Google Play
              </a>

              <p className="text-xs text-gray-500 text-center">
                Requires Android 8.0 or higher
              </p>
            </motion.div>

            {/* iOS */}
            <motion.div 
              className="bg-white rounded-2xl shadow-sm p-8"
              whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Apple className="w-8 h-8 text-gray-900" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">iOS</h3>
                  <p className="text-sm text-gray-500">App Store</p>
                </div>
              </div>

              <a
                href={process.env.NEXT_PUBLIC_APP_STORE_URL || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition mb-4"
              >
                <Download className="w-5 h-5" />
                Get on App Store
              </a>

              <p className="text-xs text-gray-500 text-center">Requires iOS 14.0 or higher</p>
            </motion.div>
          </StaggerChildren>

          {/* Alternative: Web App */}
          <div className="bg-gradient-to-br from-edudash-primary to-edudash-secondary rounded-2xl p-8 text-white mb-12">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Globe className="w-8 h-8" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-bold mb-2">Prefer using a browser?</h3>
                <p className="text-white/80 mb-4">
                  Access your membership through the EduDash Pro web portal. Works on any device
                  with a modern browser.
                </p>
                <a
                  href="https://edudashpro.org.za"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-edudash-primary rounded-lg font-medium hover:bg-white/90 transition"
                >
                  Open Web App
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center mb-12">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Scan to Download</h3>
            <div className="w-48 h-48 bg-gray-100 rounded-xl mx-auto flex items-center justify-center mb-4">
              <div className="text-center">
                <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-400">QR Code</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Scan this QR code with your phone's camera to download the app
            </p>
          </div>

          {/* App Features */}
          <div className="mb-12">
            <FadeIn>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                What you can do in the app
              </h2>
            </FadeIn>
            <StaggerChildren className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" staggerDelay={0.1}>
              {[
                { icon: '🪪', title: 'Digital ID Card', desc: 'View & share your member card' },
                { icon: '📚', title: 'Resources', desc: 'Access learning materials' },
                { icon: '📅', title: 'Events', desc: 'Register for workshops' },
                { icon: '💬', title: 'Community', desc: 'Connect with members' },
              ].map((feature, i) => (
                <motion.div 
                  key={i} 
                  className="bg-white rounded-xl p-5 text-center"
                  whileHover={{ scale: 1.05, y: -3 }}
                >
                  <span className="text-3xl mb-3 block">{feature.icon}</span>
                  <h4 className="font-semibold text-gray-900">{feature.title}</h4>
                  <p className="text-sm text-gray-500 mt-1">{feature.desc}</p>
                </motion.div>
              ))}
            </StaggerChildren>
          </div>

          {/* Not a member yet? */}
          <div className="bg-soa-light rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-soa-primary rounded-xl flex items-center justify-center mx-auto mb-4">
              <Leaf className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Not a member yet?</h3>
            <p className="text-gray-600 mb-6">
              Join Soil of Africa today and get access to all membership benefits.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-soa-primary text-white rounded-xl font-semibold hover:bg-soa-dark transition"
              >
                Register Now
              </Link>
              <Link
                href="/join"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-soa-primary border-2 border-soa-primary rounded-xl font-semibold hover:bg-soa-light transition"
              >
                I Have an Invite Code
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
