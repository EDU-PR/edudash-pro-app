'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Header, Footer } from '@/components';
import {
  CreditCard,
  Download,
  Smartphone,
  QrCode,
  Shield,
  CheckCircle2,
  Sparkles,
  User,
} from 'lucide-react';

// Sample member data for preview
const sampleMember = {
  member_number: 'SOA-GP-2025-00001',
  first_name: 'Sample',
  last_name: 'Member',
  member_type: 'regular',
  membership_tier: 'active',
  membership_status: 'active',
  region: { name: 'Gauteng', code: 'GP' },
  photo_url: '/images/president.jpg', // President's photo for demo
  card_number: 'SOA-CARD-2025-00001',
  issue_date: '2025-01-15',
  expiry_date: '2026-01-15',
};

// Card template colors
const cardColors = {
  primary: '#166534',
  secondary: '#22C55E',
  accent: '#10B981',
  dark: '#052e16',
};

export default function IDCardPage() {
  const [showBack, setShowBack] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-12 bg-gradient-to-br from-soa-primary to-soa-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm mb-4">
            <CreditCard className="w-4 h-4" />
            Digital ID Card
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Your SOA Member ID
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Every registered member receives a professional digital ID card with QR verification.
            Access your card anytime through the EduDash Pro app.
          </p>
        </div>
      </section>

      {/* ID Card Preview */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Preview Your Card</h2>
            <p className="text-gray-600">Click the card to flip between front and back</p>
          </div>

          {/* Card Container */}
          <div className="flex justify-center mb-8">
            <div 
              className="relative cursor-pointer perspective-1000"
              onClick={() => setShowBack(!showBack)}
              style={{ width: '400px', height: '252px' }}
            >
              {/* Front of Card */}
              <div className={`absolute inset-0 transition-all duration-500 transform ${showBack ? 'rotate-y-180 opacity-0' : 'rotate-y-0 opacity-100'}`}>
                <MemberIDCardFront member={sampleMember} />
              </div>

              {/* Back of Card */}
              <div className={`absolute inset-0 transition-all duration-500 transform ${showBack ? 'rotate-y-0 opacity-100' : 'rotate-y-180 opacity-0'}`}>
                <MemberIDCardBack member={sampleMember} />
              </div>
            </div>
          </div>

          {/* Flip Button */}
          <div className="text-center mb-12">
            <button
              onClick={() => setShowBack(!showBack)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {showBack ? 'View Front' : 'View Back'}
            </button>
          </div>

          {/* Card Features */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: QrCode, title: 'QR Verification', description: 'Instant verification at events' },
              { icon: Shield, title: 'Secure', description: 'Unique card number' },
              { icon: Smartphone, title: 'Digital Access', description: 'Always on your phone' },
              { icon: Sparkles, title: 'Premium Design', description: 'Professional quality' },
            ].map((feature, index) => (
              <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <div className="w-10 h-10 bg-soa-light rounded-lg flex items-center justify-center mx-auto mb-3">
                  <feature.icon className="w-5 h-5 text-soa-primary" />
                </div>
                <h4 className="font-semibold text-gray-900 text-sm">{feature.title}</h4>
                <p className="text-xs text-gray-500 mt-1">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">How to Get Your Card</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Register', description: 'Complete the membership registration form with your details and photo' },
              { step: '2', title: 'Verify', description: 'Your application is reviewed and approved by regional coordinators' },
              { step: '3', title: 'Access', description: 'Download the EduDash Pro app and access your digital ID card instantly' },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-soa-primary to-soa-secondary rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-soa-primary to-soa-secondary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Your Card?</h2>
          <p className="text-lg text-white/90 mb-8">
            Register as a member today and receive your digital ID card.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-soa-primary rounded-xl font-semibold hover:bg-gray-100 transition"
            >
              Register Now
              <CheckCircle2 className="w-5 h-5" />
            </Link>
            <Link
              href="/download"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white border border-white/30 rounded-xl font-semibold hover:bg-white/20 transition"
            >
              <Download className="w-5 h-5" />
              Download App
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// ID Card Front Component
function MemberIDCardFront({ member }: { member: typeof sampleMember }) {
  return (
    <div className="w-full h-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
      {/* Top Bar */}
      <div className="h-20 bg-gradient-to-r from-soa-primary to-soa-secondary px-4 flex items-center justify-between">
        {/* Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-white rounded-lg p-1 flex items-center justify-center overflow-hidden">
            <img 
              src="/images/soa-logo.png" 
              alt="SOA Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = '<svg class="w-6 h-6 text-soa-primary" viewBox="0 0 100 120"><path d="M50 5 C30 5 20 20 18 35 C15 50 20 65 25 75 C30 85 40 90 50 88 C60 90 70 85 75 75 C80 65 85 50 82 35 C80 20 70 5 50 5Z" fill="#166534"/><path d="M50 88 L50 95 M50 95 L40 110 M50 95 L60 110" stroke="#8B4513" stroke-width="3" fill="none"/></svg>';
                }
              }}
            />
          </div>
          <div>
            <p className="text-white font-bold text-sm">SOIL OF AFRICA</p>
            <p className="text-white/80 text-[10px]">MEMBERSHIP CARD</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className="bg-soa-gold px-2 py-0.5 rounded text-[10px] font-semibold text-soa-dark uppercase">
          {member.membership_status}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 flex gap-4">
        {/* Photo */}
        <div className="shrink-0">
          <div className="w-20 h-24 border-2 border-soa-primary rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <img 
              src={member.photo_url} 
              alt="Member Photo" 
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-soa-primary to-soa-secondary"><svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div>';
                }
              }}
            />
          </div>
          <div className="mt-1 text-center">
            <span className="text-[9px] bg-soa-light text-soa-primary px-2 py-0.5 rounded font-medium">
              ACTIVE MEMBER
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-lg truncate">
            {member.first_name} {member.last_name}
          </h3>
          <p className="text-soa-primary text-xs font-medium">Regular Member</p>
          
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-16">MEMBER NO.</span>
              <span className="text-xs font-semibold text-gray-900">{member.member_number}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-16">REGION</span>
              <span className="text-xs text-gray-700">{member.region.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-16">VALID UNTIL</span>
              <span className="text-xs text-gray-700">01/26</span>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="shrink-0 flex flex-col items-center">
          <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg p-1 flex items-center justify-center">
            <QrCode className="w-12 h-12 text-soa-primary" />
          </div>
          <span className="text-[8px] text-gray-500 mt-1">SCAN TO VERIFY</span>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="px-4 py-2 bg-gray-50 flex items-center justify-between border-t border-gray-100">
        <span className="text-[10px] text-gray-600">Card: {member.card_number}</span>
        <span className="text-[10px] text-gray-500">Issued: {member.issue_date}</span>
      </div>

      {/* Hologram Strip */}
      <div className="h-1 bg-gradient-to-r from-soa-secondary via-yellow-400 to-soa-primary opacity-50" />
    </div>
  );
}

// ID Card Back Component
function MemberIDCardBack({ member }: { member: typeof sampleMember }) {
  return (
    <div className="w-full h-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
      {/* Magnetic Strip */}
      <div className="h-10 bg-gray-900 mt-4" />

      {/* Barcode */}
      <div className="px-6 py-4">
        <div className="h-8 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center gap-[2px]">
          {Array.from({ length: 50 }).map((_, i) => (
            <div 
              key={i} 
              className="h-full bg-white"
              style={{ width: Math.random() > 0.5 ? '2px' : '1px' }}
            />
          ))}
        </div>
        <p className="text-center text-xs font-mono mt-1 text-gray-600">{member.member_number}</p>
      </div>

      {/* Emergency Contact */}
      <div className="px-6 py-2">
        <h4 className="text-xs font-semibold text-soa-primary mb-1">EMERGENCY CONTACT</h4>
        <p className="text-[10px] text-gray-600">Contact the nearest regional office</p>
        <p className="text-[10px] text-gray-600">or call: +27 12 884-5118</p>
      </div>

      {/* Terms */}
      <div className="px-6 py-2">
        <p className="text-[8px] text-gray-500 leading-relaxed">
          This card remains the property of Soil of Africa. If found, please return to the nearest branch or mail to: 679 Tanya Street, Moreleta Park, Pretoria, 0044
        </p>
      </div>

      {/* Signature Strip */}
      <div className="px-6 py-2">
        <div className="h-8 bg-gray-100 rounded flex items-center justify-center">
          <span className="text-[8px] text-gray-400">AUTHORIZED SIGNATURE</span>
        </div>
      </div>

      {/* Website */}
      <div className="px-6 py-2 text-center">
        <p className="text-xs font-medium text-soa-primary">www.soilofafrica.org</p>
      </div>
    </div>
  );
}
