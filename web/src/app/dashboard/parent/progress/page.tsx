'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { SubPageHeader } from '@/components/dashboard/SubPageHeader';
import { BarChart3, Users, TrendingUp, TrendingDown, Award, Target, Calendar, BookOpen } from 'lucide-react';

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  grade: string;
  attendance_rate?: number;
  homework_completion?: number;
  class_id?: string;
}

interface GradeStats {
  subject: string;
  average: number;
  trend: 'up' | 'down' | 'stable';
  completed: number;
  total: number;
}

export default function ProgressPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>();
  const { slug } = useTenantSlug(userId);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [gradeStats, setGradeStats] = useState<GradeStats[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/sign-in'); return; }
      setEmail(session.user.email || '');
      setUserId(session.user.id);
    })();
  }, [router, supabase.auth]);

  useEffect(() => {
    if (!userId) return;
    loadChildren();
  }, [userId]);

  useEffect(() => {
    if (selectedChildId) {
      loadProgressData(selectedChildId);
    }
  }, [selectedChildId]);

  const loadChildren = async () => {
    try {
      const { data: childrenData } = await supabase
        .from('students')
        .select('*')
        .or(`parent_id.eq.${userId},guardian_id.eq.${userId}`)
        .eq('status', 'active');

      if (childrenData && childrenData.length > 0) {
        setChildren(childrenData);
        setSelectedChildId(childrenData[0].id);
      }
    } catch (error) {
      console.error('Error loading children:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProgressData = async (childId: string) => {
    try {
      // Load homework completion stats
      const { data: homework } = await supabase
        .from('homework_submissions')
        .select('assignment_id, grade, status')
        .eq('student_id', childId);

      // Calculate subject-wise stats (mock for now)
      const subjects = ['Mathematics', 'English', 'Science', 'Life Skills'];
      const stats: GradeStats[] = subjects.map((subject, idx) => ({
        subject,
        average: 70 + Math.random() * 20,
        trend: idx % 3 === 0 ? 'up' : idx % 3 === 1 ? 'down' : 'stable',
        completed: Math.floor(10 + Math.random() * 15),
        total: 25,
      }));

      setGradeStats(stats);
    } catch (error) {
      console.error('Error loading progress data:', error);
    }
  };

  const selectedChild = children.find(c => c.id === selectedChildId);
  const hasData = children.length > 0;

  return (
    <ParentShell tenantSlug={slug} userEmail={email} hideHeader={true}>
      <div style={{ margin: 'calc(var(--space-3) * -1) calc(var(--space-2) * -1)', padding: 0 }}>
        <SubPageHeader 
          title="Progress Reports"
          subtitle="Monitor academic performance and achievements"
          icon={<BarChart3 size={28} color="white" />}
        />
        
        <div style={{ width: '100%', padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div className="spinner" />
            </div>
          ) : !hasData ? (
            <div className="section">
              <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <h3 style={{ marginBottom: 8 }}>No children found</h3>
                <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
                  Add your children to start tracking their progress
                </p>
                <button
                  onClick={() => router.push('/dashboard/parent/children')}
                  className="btn btnPrimary"
                >
                  <Users size={18} />
                  Manage Children
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Child Selector */}
              <div className="section">
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                  {children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedChildId(child.id)}
                      className="card"
                      style={{
                        padding: 16,
                        minWidth: 200,
                        flexShrink: 0,
                        cursor: 'pointer',
                        border: selectedChildId === child.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: selectedChildId === child.id ? 'var(--surface-1)' : 'transparent',
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {child.first_name} {child.last_name}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {child.grade}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Overview Metrics */}
              <div className="section">
                <div className="sectionTitle">Overview</div>
                <div className="grid2">
                  <div className="card tile">
                    <div className="metricValue" style={{ color: '#10b981' }}>85%</div>
                    <div className="metricLabel">Attendance Rate</div>
                    <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <TrendingUp size={14} /> +5% vs last month
                    </div>
                  </div>
                  <div className="card tile">
                    <div className="metricValue" style={{ color: '#f59e0b' }}>12</div>
                    <div className="metricLabel">Homework Pending</div>
                    <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <TrendingDown size={14} /> 3 overdue
                    </div>
                  </div>
                  <div className="card tile">
                    <div className="metricValue" style={{ color: '#8b5cf6' }}>78%</div>
                    <div className="metricLabel">Average Grade</div>
                    <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <TrendingUp size={14} /> +2% improvement
                    </div>
                  </div>
                  <div className="card tile">
                    <div className="metricValue" style={{ color: '#06b6d4' }}>24</div>
                    <div className="metricLabel">Assignments Completed</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      Out of 30 total
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject Performance */}
              <div className="section">
                <div className="sectionTitle">Subject Performance</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {gradeStats.map((stat) => (
                    <div key={stat.subject} className="card" style={{ padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{stat.subject}</div>
                          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                            {stat.completed} / {stat.total} assignments completed
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 24, fontWeight: 700, color: stat.average >= 75 ? '#10b981' : stat.average >= 50 ? '#f59e0b' : '#ef4444' }}>
                            {Math.round(stat.average)}%
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: stat.trend === 'up' ? '#10b981' : stat.trend === 'down' ? '#ef4444' : 'var(--muted)' }}>
                            {stat.trend === 'up' ? <TrendingUp size={12} /> : stat.trend === 'down' ? <TrendingDown size={12} /> : null}
                            {stat.trend === 'up' ? 'Improving' : stat.trend === 'down' ? 'Declining' : 'Stable'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div style={{ width: '100%', height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${stat.average}%`,
                          height: '100%',
                          background: stat.average >= 75 ? 'linear-gradient(90deg, #10b981, #059669)' : stat.average >= 50 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #ef4444, #dc2626)',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Achievements */}
              <div className="section">
                <div className="sectionTitle">Recent Achievements</div>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Award size={24} color="white" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>Perfect Attendance</div>
                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>No absences this month</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Target size={24} color="white" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>Top Performer</div>
                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Highest grade in Mathematics</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen size={24} color="white" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>Early Submitter</div>
                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Submitted 5 assignments early</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </ParentShell>
  );
}
