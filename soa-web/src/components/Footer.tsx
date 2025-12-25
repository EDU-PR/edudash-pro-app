'use client';

import Link from 'next/link';
import { Leaf, Mail, Phone, MapPin, ExternalLink, Youtube, Instagram, Facebook } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-soa-dark text-white">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-white rounded-lg p-1 relative flex items-center justify-center overflow-hidden">
                <img 
                  src="/images/soa-logo.png" 
                  alt="SOA Logo" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.classList.remove('bg-white');
                      parent.classList.add('bg-gradient-to-br', 'from-soa-secondary', 'to-soa-accent');
                      parent.innerHTML = '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>';
                    }
                  }}
                />
              </div>
              <span className="text-xl font-bold">Soil of Africa</span>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Formed to transform and liberate South Africans through skills development, 
              social justice, and youth empowerment. #SIZOSEBENZANGENKANI
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3 mb-4">
              <a href="https://www.facebook.com/61575839187032" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-blue-600 transition">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="https://www.tiktok.com/@soilofafrica" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-gray-900 transition">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>
              </a>
              <a href="https://www.youtube.com/@soilofafrica" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-red-600 transition">
                <Youtube className="w-4 h-4" />
              </a>
              <a href="https://www.instagram.com/soilofafrica" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-pink-600 transition">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="https://wa.me/27762233981" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-soa-gold transition">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Powered by</span>
              <Link
                href="https://edudashpro.org.za"
                target="_blank"
                className="inline-flex items-center gap-1 text-edudash-primary hover:underline"
              >
                EduDash Pro
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-gray-400 hover:text-white transition">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/media" className="text-gray-400 hover:text-white transition">
                  Media Hub
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="text-gray-400 hover:text-white transition">
                  Gallery
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-gray-400 hover:text-white transition">
                  Become a Member
                </Link>
              </li>
              <li>
                <Link href="/download" className="text-gray-400 hover:text-white transition">
                  Download App
                </Link>
              </li>
            </ul>
          </div>

          {/* Chapters */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Our Chapters</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/chapters/skills" className="text-gray-400 hover:text-white transition">
                  Skills Development
                </Link>
              </li>
              <li>
                <Link href="/chapters/youth" className="text-gray-400 hover:text-white transition">
                  Youth Chapter
                </Link>
              </li>
              <li>
                <Link href="/chapters/social" className="text-gray-400 hover:text-white transition">
                  Social Development
                </Link>
              </li>
              <li>
                <Link href="/join" className="text-gray-400 hover:text-white transition">
                  Join with Code
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-gray-400 hover:text-white transition">
                  Register Now
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-soa-secondary shrink-0 mt-0.5" />
                <span className="text-gray-400 text-sm">
                  679 Tanya Street, Moreleta Park, Pretoria, 0044
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-soa-secondary shrink-0" />
                <div className="text-gray-400 text-sm">
                  <a href="tel:+27128845118" className="hover:text-white transition block">+27 12 884-5118</a>
                  <a href="tel:+27762233981" className="hover:text-white transition block">+27 76 223-3981</a>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-soa-secondary shrink-0" />
                <a
                  href="mailto:info@soilofafrica.org"
                  className="text-gray-400 hover:text-white transition"
                >
                  info@soilofafrica.org
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} Soil of Africa. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-gray-500 hover:text-white transition">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-gray-500 hover:text-white transition">
                Terms of Service
              </Link>
              <Link
                href="https://edudashpro.org.za"
                target="_blank"
                className="text-edudash-primary hover:text-edudash-secondary transition flex items-center gap-1"
              >
                EduDash Pro
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
