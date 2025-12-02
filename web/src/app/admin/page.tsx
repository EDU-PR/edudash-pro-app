'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SuperAdminShell } from '@/components/dashboard/superadmin/SuperAdminShell';
import Link from 'next/link';
import { Settings, BookMarked, Activity, Users, DollarSign, Zap } from 'lucide-react';

const adminTools = [
  {
    title: 'Registration Management',
    description: 'Review and approve student registrations from all schools in real-time',
    icon: Users,
    href: '/admin/registrations',
    color: 'bg-red-500',
  },
  {
    title: 'User Management & Troubleshooting',
    description: 'Search users, view payment history, tier status, and fix upgrade issues',
    icon: Users,
    href: '/admin/users',
    color: 'bg-blue-500',
  },
  {
    title: 'Promotions & Pricing',
    description: 'Manage trial periods, promotional offers, and subscription pricing',
    icon: DollarSign,
    href: '/admin/promotions',
    color: 'bg-purple-500',
  },
  {
    title: 'AI Provider Configuration',
    description: 'Configure AI providers (Claude/OpenAI) and models per scenario and user tier',
    icon: Zap,
    href: '/admin/ai-config',
    color: 'bg-green-500',
  },
  {
    title: 'CAPS Curriculum Mapping',
    description: 'Map CAPS topics to textbooks and chapters for exam generation',
    icon: BookMarked,
    href: '/admin/caps-mapping',
    color: 'bg-orange-500',
  },
  {
    title: 'System Monitoring',
    description: 'View AI usage, costs, and system health metrics',
    icon: Activity,
    href: '/admin/monitoring',
    color: 'bg-indigo-500',
    disabled: true,
  },
];

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [greeting, setGreeting] = useState('');

  // Initialize auth
  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/sign-in');
        return;
      }

      setUserId(session.user.id);

      // Set greeting based on time of day
      const hour = new Date().getHours();
      if (hour < 12) setGreeting('Good Morning');
      else if (hour < 18) setGreeting('Good Afternoon');
      else setGreeting('Good Evening');

      setAuthLoading(false);
    };

    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (!userId) return;
    loadProfile();
  }, [userId]);

  async function loadProfile() {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    setProfile(profileData);
  }

  if (authLoading) {
    return (
      <SuperAdminShell
        userEmail={profile?.email}
        userName={profile?.first_name}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400 dark:text-slate-500">Loading...</p>
        </div>
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell
      userEmail={profile?.email}
      userName={profile?.first_name}
      hideRightSidebar={true}
    >
      <h1 className="h1">{greeting}, {profile?.first_name || 'Admin'}! 🛡️</h1>
      <p style={{ marginTop: 8, marginBottom: 24, fontSize: 16, color: 'var(--muted)' }}>
        System-wide platform management and configuration
      </p>

      {/* Platform Overview */}
      <div className="section">
        <div className="sectionTitle">Platform Overview</div>
        <div className="grid2">
          <div className="card tile">
            <div className="metricValue">32</div>
            <div className="metricLabel">Total Schools</div>
          </div>
          <div className="card tile">
            <div className="metricValue">1,247</div>
            <div className="metricLabel">Total Users</div>
          </div>
          <div className="card tile">
            <div className="metricValue">89</div>
            <div className="metricLabel">Pending Registrations</div>
          </div>
          <div className="card tile">
            <div className="metricValue" style={{ color: '#10b981' }}>98.2%</div>
            <div className="metricLabel">System Uptime</div>
          </div>
        </div>
      </div>

      {/* Admin Tools */}
      <div className="section">
        <div className="sectionTitle">Admin Tools</div>
        <div className="grid2">
          {adminTools.map((tool) => {
            const Icon = tool.icon;
            const isDisabled = tool.disabled;

            return (
              <Link
                key={tool.href}
                href={isDisabled ? '#' : tool.href}
                className="card"
                style={{
                  opacity: isDisabled ? 0.6 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  borderLeft: `4px solid ${tool.color.replace('bg-', '#').replace('-500', '')}`,
                  padding: 20
                }}
                onClick={(e) => isDisabled && e.preventDefault()}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: 16 }}>
                  <div style={{ 
                    padding: 12, 
                    borderRadius: 12, 
                    background: isDisabled ? '#e5e7eb' : tool.color.replace('bg-', '#').replace('-500', ''),
                    color: 'white'
                  }}>
                    <Icon style={{ width: 24, height: 24 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {tool.title}
                      {isDisabled && (
                        <span style={{ 
                          padding: '2px 8px', 
                          fontSize: 11, 
                          fontWeight: 600, 
                          background: '#e5e7eb',
                          color: '#6b7280',
                          borderRadius: 12
                        }}>
                          Coming Soon
                        </span>
                      )}
                    </h3>
                    <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
                      {tool.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </SuperAdminShell>
  );
}
