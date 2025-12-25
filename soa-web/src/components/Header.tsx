'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, Leaf } from 'lucide-react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/media', label: 'Media' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/id-card', label: 'ID Card' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-soa-cream/95 backdrop-blur-sm border-b border-soa-sand">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-16 h-16 relative flex items-center justify-center rounded-full overflow-hidden bg-white shadow-md border-2 border-soa-gold/30">
              {!logoError ? (
                <img 
                  src="/images/soa-logo.png" 
                  alt="SOA Logo" 
                  className="w-14 h-14 object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-soa-primary to-soa-secondary flex items-center justify-center">
                  <Leaf className="w-8 h-8 text-white" />
                </div>
              )}
            </div>
            <div>
              <span className="text-xl font-bold text-soa-dark">Soil of Africa</span>
              <span className="hidden sm:block text-[10px] text-gray-500 -mt-1">
                Powered by EduDash Pro
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isActive(link.href)
                    ? 'bg-soa-primary text-white'
                    : 'text-gray-600 hover:bg-soa-light hover:text-soa-primary'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/join"
              className="px-4 py-2 text-soa-primary hover:bg-soa-light rounded-lg transition"
            >
              Have Code?
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 bg-gradient-to-r from-soa-primary to-soa-secondary text-white rounded-lg font-medium hover:opacity-90 transition"
            >
              Join Now
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg font-medium transition ${
                    isActive(link.href)
                      ? 'bg-soa-primary text-white'
                      : 'text-gray-600 hover:bg-soa-light'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex gap-2 mt-4 px-4">
                <Link
                  href="/join"
                  className="flex-1 py-2 text-center text-soa-primary border border-soa-primary rounded-lg"
                >
                  Have Code?
                </Link>
                <Link
                  href="/register"
                  className="flex-1 py-2 text-center bg-soa-primary text-white rounded-lg"
                >
                  Join Now
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
