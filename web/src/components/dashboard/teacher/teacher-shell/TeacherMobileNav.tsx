'use client';

/**
 * Teacher Mobile Navigation Component
 * Extracted from TeacherShell.tsx
 */

import { useRouter, usePathname } from 'next/navigation';
import { X, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { NavItem } from './types';

interface TeacherMobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  nav: NavItem[];
}

export function TeacherMobileNav({ isOpen, onClose, nav }: TeacherMobileNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  if (!isOpen) return null;

  const handleNavClick = (href: string) => {
    console.log('🔗 Navigating to:', href);
    onClose(); // Close drawer first
    setTimeout(() => {
      router.push(href);
    }, 100); // Small delay to allow drawer to close
  };

  return (
    <>
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          zIndex: 9998,
        }}
        className="mobile-nav-overlay"
        onClick={onClose}
      />
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '80%',
          maxWidth: 320,
          background: 'var(--surface-1)',
          zIndex: 9999,
          overflowY: 'auto',
          padding: 'var(--space-4)',
          animation: 'slideInLeft 0.3s ease-out',
        }}
        className="mobile-nav-drawer"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Menu</h3>
          <button onClick={onClose} className="iconBtn" aria-label="Close">
            <X className="icon20" />
          </button>
        </div>
        
        <nav className="nav" style={{ display: 'grid', gap: 6 }}>
          {nav.map((it) => {
            const Icon = it.icon as any;
            const active = pathname === it.href || pathname?.startsWith(it.href + '/');
            return (
              <button 
                key={it.href} 
                className={`navItem ${active ? 'navItemActive' : ''}`}
                onClick={() => handleNavClick(it.href)}
                style={{ width: '100%' }}
              >
                <Icon className="navIcon" />
                <span>{it.label}</span>
                {typeof it.badge === 'number' && it.badge > 0 && (
                  <span className="navItemBadge badgeNumber">{it.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
        
        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)' }}>
          <button
            className="navItem"
            style={{ width: '100%' }}
            onClick={async () => { await supabase.auth.signOut(); router.push('/sign-in'); }}
          >
            <LogOut className="navIcon" />
            <span>Sign out</span>
          </button>
          <div className="brandPill" style={{ marginTop: 'var(--space-2)', width: '100%', textAlign: 'center' }}>
            Powered by EduDash Pro
          </div>
        </div>
      </div>
    </>
  );
}
