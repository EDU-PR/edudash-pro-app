'use client';

/**
 * Teacher Side Navigation Component
 * Extracted from TeacherShell.tsx
 */

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { NavItem } from './types';

interface TeacherSideNavProps {
  nav: NavItem[];
  collapsed: boolean;
  hovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

export function TeacherSideNav({ nav, collapsed, hovered, onHoverStart, onHoverEnd }: TeacherSideNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const isExpanded = !collapsed || hovered;

  return (
    <aside 
      className="sidenav sticky" 
      aria-label="Sidebar"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      style={{
        width: isExpanded ? '240px' : '64px',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
      }}
    >
      <div className="sidenavCol">
        <nav className="nav">
          {nav.map((it) => {
            const Icon = it.icon as any;
            const active = pathname === it.href || pathname?.startsWith(it.href + '/');
            return (
              <Link 
                key={it.href} 
                href={it.href} 
                className={`navItem ${active ? 'navItemActive' : ''}`} 
                aria-current={active ? 'page' : undefined}
                style={{
                  justifyContent: isExpanded ? 'flex-start' : 'center',
                  padding: isExpanded ? undefined : '12px',
                }}
                title={!isExpanded ? it.label : undefined}
              >
                <Icon className="navIcon" />
                {isExpanded && <span>{it.label}</span>}
                {isExpanded && typeof it.badge === 'number' && it.badge > 0 && (
                  <span className="navItemBadge badgeNumber">{it.badge}</span>
                )}
                {!isExpanded && typeof it.badge === 'number' && it.badge > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--danger)',
                  }} />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="sidenavFooter">
          <button
            className="navItem"
            onClick={async () => { await supabase.auth.signOut(); router.push('/sign-in'); }}
            style={{
              justifyContent: isExpanded ? 'flex-start' : 'center',
              padding: isExpanded ? undefined : '12px',
            }}
            title={!isExpanded ? 'Sign out' : undefined}
          >
            <LogOut className="navIcon" />
            {isExpanded && <span>Sign out</span>}
          </button>
          {isExpanded && (
            <div className="brandPill w-full text-center">Powered by EduDash Pro</div>
          )}
        </div>
      </div>
    </aside>
  );
}
