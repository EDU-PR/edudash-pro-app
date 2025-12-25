'use client';

import { useState } from 'react';
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
  Bell,
  Sparkles,
  Mail,
} from 'lucide-react';

export default function DownloadPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleEarlyAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      const message = `Hi! I'd like to get early access to the EduDash Pro app. My email: ${email}`;
      window.open(`https://wa.me/27762233981?text=${encodeURIComponent(message)}`, '_blank');
      setIsSubmitted(true);
      setEmail('');
    }
  };

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
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-soa-gold/20 text-soa-gold rounded-full text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                Coming Soon
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                EduDash Pro App
              </h1>
            </FadeIn>
            <SlideIn direction="up" delay={0.2}>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Access your Soil of Africa membership, digital ID card, resources, and events on
                the go. Coming soon to Android and iOS.
              </p>
            </SlideIn>
          </div>

          {/* Coming Soon Cards */}
          <StaggerChildren className="grid md:grid-cols-2 gap-6 mb-12" staggerDelay={0.1}>
            {/* Android */}
            <motion.div 
              className="bg-white rounded-2xl shadow-sm p-8 relative overflow-hidden"
              whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
            >
              <div className="absolute top-4 right-4 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                Coming Soon
              </div>
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

              <div className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-gray-200 text-gray-500 rounded-xl font-semibold cursor-not-allowed mb-4">
                <Bell className="w-5 h-5" />
                Notify Me When Available
              </div>

              <p className="text-xs text-gray-500 text-center">
                Expected Q1 2026
              </p>
            </motion.div>

            {/* iOS */}
            <motion.div 
              className="bg-white rounded-2xl shadow-sm p-8 relative overflow-hidden"
              whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
            >
              <div className="absolute top-4 right-4 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                Coming Soon
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Apple className="w-8 h-8 text-gray-900" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">iOS</h3>
                  <p className="text-sm text-gray-500">App Store</p>
                </div>
              </div>

              <div className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-gray-200 text-gray-500 rounded-xl font-semibold cursor-not-allowed mb-4">
                <Bell className="w-5 h-5" />
                Notify Me When Available
              </div>

              <p className="text-xs text-gray-500 text-center">Expected Q1 2026</p>
            </motion.div>
          </StaggerChildren>

          {/* Early Access Signup */}
          <FadeIn delay={0.3}>
            <div className="bg-gradient-to-br from-soa-primary to-soa-dark rounded-2xl p-8 text-white mb-12">
              <div className="max-w-xl mx-auto text-center">
                <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Get Early Access</h3>
                <p className="text-white/80 mb-6">
                  Be among the first to try the EduDash Pro app. Sign up for beta access and we'll
                  notify you when it's ready.
                </p>
                
                {isSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center gap-2 text-soa-gold"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="font-medium">Thanks! We'll be in touch soon.</span>
                  </motion.div>
                ) : (
                  <form onSubmit={handleEarlyAccess} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-soa-gold/50 focus:border-soa-gold"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 bg-soa-gold text-gray-900 rounded-xl font-semibold hover:bg-amber-400 transition-all duration-300 hover:scale-105 whitespace-nowrap"
                    >
                      Get Early Access
                    </button>
                  </form>
                )}
              </div>
            </div>
          </FadeIn>

          {/* App Features */}
          <div className="mb-12">
            <FadeIn>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                What you'll be able to do in the app
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
