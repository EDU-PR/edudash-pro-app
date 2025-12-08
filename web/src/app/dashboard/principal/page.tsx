'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import {
  Users,
  School,
  DollarSign,
  TrendingUp,
  UserPlus,
  FileText,
  Calendar,
  MessageCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Search,
  X,
  Sparkles,
  Bell,
} from 'lucide-react';
import { ParentApprovalWidget } from '@/components/dashboard/principal/ParentApprovalWidget';
import { ChildRegistrationWidget } from '@/components/dashboard/principal/ChildRegistrationWidget';
import { AskAIWidget } from '@/components/dashboard/AskAIWidget';
import { TierBadge } from '@/components/ui/TierBadge';
import { showLocalNotification } from '@/lib/services/pushNotificationService';

interface PrincipalMetrics {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  revenue: number;
  pendingPayments: number;
  activeEnrollments: number;
  staffAttendance: number;
  upcomingEvents: number;
}

interface RecentActivity {
  id: string;
  type: 'registration' | 'student' | 'system';
  title: string;
  description: string;
  timestamp: string;
}

export default function PrincipalDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [metrics, setMetrics] = useState<PrincipalMetrics>({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    revenue: 0,
    pendingPayments: 0,
    activeEnrollments: 0,
    staffAttendance: 0,
    upcomingEvents: 0,
  });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [dashAIFullscreen, setDashAIFullscreen] = useState(false);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  // Fetch user profile with preschool data
  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  const userEmail = profile?.email;
  const userName = profile?.firstName || userEmail?.split('@')[0] || 'Principal';
  const preschoolName = profile?.preschoolName;
  const preschoolId = profile?.preschoolId;
  const userRole = profile?.role;
  const roleDisplay = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Principal';

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

  // Load dashboard metrics
  useEffect(() => {
    if (!preschoolId) return;

    const loadMetrics = async () => {
      try {
        setMetricsLoading(true);

        // Fetch students count
        const { count: studentCount } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .eq('status', 'active');

        // Fetch teachers count
        const { count: teacherCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .eq('role', 'teacher');

        // Fetch classes count
        const { count: classCount } = await supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId);

        // Fetch financial data from registration_requests table (synced from EduSitePro)
        // Use payment_verified to count only verified payments for revenue
        const { data: registrations } = await supabase
          .from('registration_requests')
          .select('registration_fee_amount, registration_fee_paid, payment_verified, status')
          .eq('organization_id', preschoolId);

        let revenue = 0;
        let pendingPayments = 0;

        if (registrations) {
          // Only count verified payments from approved registrations
          const paidAndVerified = registrations.filter((r: any) => 
            r.payment_verified && r.status === 'approved'
          );
          
          // Pending = approved but not verified, or have amount but not paid
          const pending = registrations.filter((r: any) => 
            !r.payment_verified && r.registration_fee_amount && r.status !== 'rejected'
          );
          
          revenue = paidAndVerified.reduce((sum: number, r: any) => 
            sum + (parseFloat(r.registration_fee_amount as any) || 0), 0
          );
          pendingPayments = pending.length;
        }

        setMetrics({
          totalStudents: studentCount || 0,
          totalTeachers: teacherCount || 0,
          totalClasses: classCount || 0,
          revenue,
          pendingPayments,
          activeEnrollments: studentCount || 0,
          staffAttendance: teacherCount || 0,
          upcomingEvents: 0,
        });
      } catch (error) {
        console.error('Error loading metrics:', error);
      } finally {
        setMetricsLoading(false);
      }
    };

    loadMetrics();
  }, [preschoolId, supabase]);

  // Load recent activities
  useEffect(() => {
    if (!preschoolId) return;

    const loadActivities = async () => {
      try {
        const activities: RecentActivity[] = [];

        // Get recently enrolled students (registration_requests table is in EduSitePro, not EduDashPro)
        // Once approved, students are synced to students table
        const { data: students } = await supabase
          .from('students')
          .select('id, first_name, last_name, enrollment_date, created_at, status')
          .eq('preschool_id', preschoolId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (students) {
          students.forEach((student: any) => {
            const timestamp = student.enrollment_date || student.created_at;
            activities.push({
              id: `student-${student.id}`,
              type: 'student',
              title: student.status === 'active' ? 'Student Enrolled' : 'Student Added',
              description: `${student.first_name} ${student.last_name}`,
              timestamp,
            });
          });
        }

        // Sort by timestamp and take top 5
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecentActivities(activities.slice(0, 5));
      } catch (error) {
        console.error('Error loading activities:', error);
      }
    };

    loadActivities();
  }, [preschoolId, supabase]);

  const loading = authLoading || profileLoading || metricsLoading;

  if (loading) {
    return (
      <PrincipalShell
        tenantSlug={tenantSlug}
        userEmail={userEmail}
        userName={userName}
        preschoolName={preschoolName}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400">Loading...</p>
        </div>
      </PrincipalShell>
    );
  }

  // Debug logging
  console.log('🎓 [PrincipalDashboard] preschoolId:', preschoolId);
  console.log('🎓 [PrincipalDashboard] userId:', userId);

  // Right sidebar content
  const rightSidebar = (
    <>
      {/* At a Glance */}
      <div className="card">
        <div className="sectionTitle">At a glance</div>
        <ul style={{ display: 'grid', gap: 8 }}>
          <li className="listItem">
            <span>Total Students</span>
            <span className="badge">{metrics.totalStudents}</span>
          </li>
          <li className="listItem">
            <span>Teaching Staff</span>
            <span className="badge">{metrics.totalTeachers}</span>
          </li>
          <li className="listItem">
            <span>Active Classes</span>
            <span className="badge">{metrics.totalClasses}</span>
          </li>
        </ul>
      </div>

      {/* Child Registration Requests */}
      <ChildRegistrationWidget preschoolId={preschoolId} userId={userId} />

      {/* Parent Link Approval Requests */}
      <ParentApprovalWidget preschoolId={preschoolId} userId={userId} />

      {/* Recent Activity */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Activity size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Recent Activity</h3>
        </div>
        {recentActivities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
            <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontSize: 14 }}>No recent activity</p>
          </div>
        ) : (
          <ul style={{ display: 'grid', gap: 12 }}>
            {recentActivities.map((activity) => (
              <li key={activity.id} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                {activity.type === 'registration' ? (
                  <FileText size={14} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                ) : activity.type === 'student' ? (
                  <UserPlus size={14} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <Clock size={14} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{activity.title}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                    {activity.description}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
                    {new Date(activity.timestamp).toLocaleString('en-ZA', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ask Dash AI Assistant - Wrapped in div with data-dash-ai for mobile detection */}
      <div data-dash-ai onClick={(e) => {
        // On mobile, intercept click and open fullscreen
        if (window.innerWidth < 1024) {
          e.preventDefault();
          e.stopPropagation();
          setDashAIFullscreen(true);
        }
      }}>
        <AskAIWidget inline userId={userId} />
      </div>
    </>
  );

  return (
    <>
      <style jsx global>{`
        body, html {
          overflow-x: hidden;
          max-width: 100vw;
        }
        .section, .card, .grid2, .grid3 {
          max-width: 100%;
          overflow-x: hidden;
        }
      `}</style>
      <PrincipalShell
        tenantSlug={tenantSlug}
        userEmail={userEmail}
        userName={userName}
        preschoolName={preschoolName}
        rightSidebar={rightSidebar}
        onOpenDashAI={() => setDashAIFullscreen(true)}
      >
      {/* Search Bar */}
      <div style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>
        <div style={{ position: 'relative' }}>
          <input
            className="searchInput"
            placeholder="Search students, teachers, reports..."
            style={{ width: '100%', paddingRight: '2.5rem' }}
            onKeyDown={(e) => {
              const t = e.target as HTMLInputElement;
              if (e.key === 'Enter' && t.value.trim()) router.push(`/dashboard/principal/search?q=${encodeURIComponent(t.value.trim())}`);
            }}
          />
          <Search className="searchIcon icon16" style={{ right: '0.75rem', left: 'auto' }} />
        </div>
      </div>

      {/* Page Header with Preschool Name */}
      <div className="section" style={{ marginBottom: 0 }}>
        {preschoolName && (
          <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', marginBottom: 16, cursor: 'pointer' }} onClick={() => router.push('/dashboard/principal/settings')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 24 }}>🏫</span>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{preschoolName}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 32 }}>
                <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>{roleDisplay}</p>
                <span style={{ opacity: 0.7 }}>•</span>
                <TierBadge userId={userId} size="sm" showUpgrade />
              </div>
            </div>
          </div>
        )}
      </div>

      <h1 className="h1">{greeting}, {userName}</h1>

      {/* Overview Metrics */}
      <div className="section">
        <div className="sectionTitle">School Overview</div>
        <div className="grid2">
          <div className="card tile">
            <div className="metricValue">{metrics.totalStudents}</div>
            <div className="metricLabel">Total Students</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{metrics.totalTeachers}</div>
            <div className="metricLabel">Teaching Staff</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{metrics.totalClasses}</div>
            <div className="metricLabel">Active Classes</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{metrics.staffAttendance}</div>
            <div className="metricLabel">Staff Present Today</div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="section">
        <div className="sectionTitle">Financial Summary</div>
        <div className="grid2">
          <div className="card tile">
            <div className="metricValue" style={{ color: '#10b981' }}>
              R{metrics.revenue.toLocaleString()}
            </div>
            <div className="metricLabel">Registration Fees Collected</div>
          </div>
          <div className="card tile">
            <div className="metricValue" style={{ color: '#f59e0b' }}>
              {metrics.pendingPayments}
            </div>
            <div className="metricLabel">Pending Payments</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{metrics.activeEnrollments}</div>
            <div className="metricLabel">Active Enrollments</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{metrics.upcomingEvents}</div>
            <div className="metricLabel">Upcoming Events</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="section">
        <div className="sectionTitle">Quick Actions</div>
        <div className="grid2">
          <button className="qa" onClick={() => router.push('/dashboard/principal/students')}>
            <UserPlus className="icon20" />
            <span>Enroll Student</span>
          </button>
          <button className="qa" onClick={() => router.push('/dashboard/principal/teachers')}>
            <School className="icon20" />
            <span>Manage Teachers</span>
          </button>
          <button className="qa" onClick={() => router.push('/dashboard/principal/dash-chat')} style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', color: 'white', border: 'none' }}>
            <Sparkles className="icon20" />
            <span>Chat with Dash AI</span>
          </button>
          <button className="qa" onClick={() => router.push('/dashboard/principal/financials')}>
            <DollarSign className="icon20" />
            <span>View Financials</span>
          </button>
          <button className="qa" onClick={() => router.push('/dashboard/principal/reports')}>
            <FileText className="icon20" />
            <span>Generate Reports</span>
          </button>
          <button className="qa" onClick={() => router.push('/dashboard/principal/messages')}>
            <MessageCircle className="icon20" />
            <span>Send Announcement</span>
          </button>
          <button className="qa" onClick={() => router.push('/dashboard/principal/calendar')}>
            <Calendar className="icon20" />
            <span>School Calendar</span>
          </button>
        </div>
      </div>

      {/* Alerts & Notifications */}
      <div className="section">
        <div className="sectionTitle">Recent Alerts</div>
        <div className="card">
          {metrics.pendingPayments > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderLeft: '4px solid #f59e0b' }}>
              <AlertTriangle size={20} color="#f59e0b" />
              <div>
                <div style={{ fontWeight: 600 }}>Pending Payments</div>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                  {metrics.pendingPayments} payments awaiting review
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderLeft: '4px solid #10b981' }}>
              <CheckCircle size={20} color="#10b981" />
              <div>
                <div style={{ fontWeight: 600 }}>All Systems Operational</div>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                  No urgent actions required at this time
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </PrincipalShell>
      
      {/* Mobile Fullscreen Dash AI Modal */}
      {dashAIFullscreen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--background)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4)',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-1)',
          }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Ask Dash AI</h2>
            <button
              onClick={() => setDashAIFullscreen(false)}
              className="iconBtn"
              aria-label="Close"
            >
              <X className="icon20" />
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <AskAIWidget fullscreen userId={userId} />
          </div>
        </div>
      )}
    </>
  );
}
