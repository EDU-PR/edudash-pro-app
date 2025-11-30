'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { FileText, Download, Calendar, AlertCircle, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';

interface ProgressReport {
  id: string;
  student_id: string;
  teacher_id: string;
  report_period: string;
  report_type: string;
  overall_comments: string;
  teacher_comments: string;
  strengths: string;
  areas_for_improvement: string;
  subjects_performance: any;
  overall_grade: string;
  approval_status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  // Joined data
  students?: {
    first_name: string;
    last_name: string;
  };
  teacher?: {
    first_name: string;
    last_name: string;
  };
}

export default function ReportsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [pendingReports, setPendingReports] = useState<ProgressReport[]>([]);
  const [reviewedReports, setReviewedReports] = useState<ProgressReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'approved' | 'rejected'>('approved');

  const { profile } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const preschoolName = profile?.preschoolName;
  const preschoolId = profile?.preschoolId;

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
      setLoading(false);
    };
    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (!preschoolId) return;

    const loadAllReports = async () => {
      setLoadingReports(true);
      try {
        // Load pending reports
        const { data: pending, error: pendingError } = await supabase
          .from('progress_reports')
          .select(`
            *,
            students (first_name, last_name),
            teacher:users!progress_reports_teacher_id_fkey (first_name, last_name)
          `)
          .eq('preschool_id', preschoolId)
          .eq('approval_status', 'pending_review')
          .order('created_at', { ascending: false });

        if (pendingError) {
          console.error('Error loading pending reports:', pendingError);
        } else {
          setPendingReports(pending || []);
        }

        // Load reviewed reports (approved and rejected)
        const { data: reviewed, error: reviewedError } = await supabase
          .from('progress_reports')
          .select(`
            *,
            students (first_name, last_name),
            teacher:users!progress_reports_teacher_id_fkey (first_name, last_name)
          `)
          .eq('preschool_id', preschoolId)
          .in('approval_status', ['approved', 'rejected'])
          .order('reviewed_at', { ascending: false });

        if (reviewedError) {
          console.error('Error loading reviewed reports:', reviewedError);
        } else {
          setReviewedReports(reviewed || []);
        }
      } catch (err) {
        console.error('Error loading reports:', err);
      } finally {
        setLoadingReports(false);
      }
    };

    loadAllReports();
  }, [preschoolId, supabase]);

  const handleProgressReportAction = async (reportId: string, action: 'approve' | 'reject', notes?: string) => {
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const { error } = await supabase
        .from('progress_reports')
        .update({ 
          approval_status: newStatus,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          principal_notes: notes || null,
        })
        .eq('id', reportId);

      if (error) {
        console.error('Error updating progress report:', error);
        return;
      }

      // Move from pending to reviewed
      const report = pendingReports.find(r => r.id === reportId);
      if (report) {
        setPendingReports(prev => prev.filter(r => r.id !== reportId));
        setReviewedReports(prev => [{ ...report, approval_status: newStatus as any }, ...prev]);
      }
    } catch (err) {
      console.error('Error handling progress report action:', err);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('progress_reports')
        .delete()
        .eq('id', reportId);

      if (error) {
        console.error('Error deleting report:', error);
        return;
      }

      // Remove from local state
      setReviewedReports(prev => prev.filter(r => r.id !== reportId));
    } catch (err) {
      console.error('Error deleting report:', err);
    }
  };


  const reportTypes = [
    { id: 'attendance', name: 'Attendance Report', description: 'Student and staff attendance tracking', icon: Calendar },
    { id: 'financial', name: 'Financial Summary', description: 'Revenue, expenses, and payments', icon: FileText },
    { id: 'enrollment', name: 'Enrollment Report', description: 'Student enrollment trends', icon: FileText },
    { id: 'academic', name: 'Academic Performance', description: 'Student progress and assessments', icon: FileText },
  ];

  if (loading) {
    return (
      <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={profile?.preschoolId}>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400">Loading reports...</p>
        </div>
      </PrincipalShell>
    );
  }

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={profile?.preschoolId}>
      <div className="section">
        <h1 className="h1">Reports</h1>

        {/* Pending Progress Reports Review Section */}
        <div style={{ marginBottom: 32 }}>
          <div className="sectionTitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={20} color="#667eea" />
            Student Progress Reports - Pending Review
            {pendingProgressReports.length > 0 && (
              <span style={{ 
                background: '#667eea', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: 12, 
                fontSize: 12, 
                fontWeight: 600 
              }}>
                {pendingProgressReports.length}
              </span>
            )}
          </div>

          {pendingProgressReports.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ marginBottom: 8, color: 'var(--muted)' }}>No Pending Reports</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                All student progress reports have been reviewed. New reports submitted by teachers will appear here for your approval.
              </p>
            </div>
          ) : (
          <div style={{ marginBottom: 32 }}>
            <div className="sectionTitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={20} color="#667eea" />
              Student Progress Reports - Pending Review
              <span style={{ 
                background: '#667eea', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: 12, 
                fontSize: 12, 
                fontWeight: 600 
              }}>
                {pendingProgressReports.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendingProgressReports.map((report) => {
                const studentName = report.students 
                  ? `${report.students.first_name} ${report.students.last_name}` 
                  : 'Unknown Student';
                const teacherName = report.teacher 
                  ? `${report.teacher.first_name} ${report.teacher.last_name}` 
                  : 'Unknown Teacher';
                return (
                  <div key={report.id} className="card" style={{ 
                    borderLeft: `4px solid #667eea` 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <FileText size={18} color="#667eea" />
                          <span style={{ 
                            fontSize: 12, 
                            fontWeight: 600, 
                            color: '#667eea',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {report.report_type} Report
                          </span>
                          <span style={{ color: 'var(--muted)', fontSize: 12 }}>•</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {report.report_period}
                          </span>
                        </div>
                        
                        <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 700 }}>
                          {studentName}
                        </h3>
                        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 12 }}>
                          Submitted by <strong>{teacherName}</strong>
                        </p>
                        
                        {report.overall_grade && (
                          <div style={{ 
                            display: 'inline-block',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                            color: 'white',
                            padding: '4px 12px', 
                            borderRadius: 8, 
                            fontSize: 14,
                            fontWeight: 600,
                            marginBottom: 12
                          }}>
                            Overall Grade: {report.overall_grade}
                          </div>
                        )}
                        
                        {report.teacher_comments && (
                          <div style={{ marginBottom: 12 }}>
                            <strong style={{ fontSize: 14 }}>Teacher Comments:</strong>
                            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                              {report.teacher_comments.substring(0, 200)}
                              {report.teacher_comments.length > 200 && '...'}
                            </p>
                          </div>
                        )}
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                          {report.strengths && (
                            <div style={{ 
                              background: 'var(--card-hover)', 
                              padding: 12, 
                              borderRadius: 8,
                              fontSize: 13
                            }}>
                              <strong>Strengths:</strong>
                              <p style={{ marginTop: 4, color: 'var(--muted)' }}>
                                {report.strengths.substring(0, 100)}
                                {report.strengths.length > 100 && '...'}
                              </p>
                            </div>
                          )}
                          {report.areas_for_improvement && (
                            <div style={{ 
                              background: 'var(--card-hover)', 
                              padding: 12, 
                              borderRadius: 8,
                              fontSize: 13
                            }}>
                              <strong>Areas for Improvement:</strong>
                              <p style={{ marginTop: 4, color: 'var(--muted)' }}>
                                {report.areas_for_improvement.substring(0, 100)}
                                {report.areas_for_improvement.length > 100 && '...'}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
                          Submitted on {new Date(report.created_at).toLocaleDateString()} at {new Date(report.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button 
                          className="btn btnPrimary"
                          onClick={() => handleProgressReportAction(report.id, 'approve')}
                          style={{ minWidth: 120, background: '#10b981' }}
                        >
                          <CheckCircle size={16} style={{ marginRight: 6 }} />
                          Approve
                        </button>
                        <button 
                          className="btn btnSecondary"
                          onClick={() => {
                            const reason = prompt('Reason for rejection (optional):');
                            handleProgressReportAction(report.id, 'reject', reason || undefined);
                          }}
                          style={{ minWidth: 120 }}
                        >
                          <XCircle size={16} style={{ marginRight: 6 }} />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sectionTitle">Available Reports</div>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {reportTypes.map((report) => {
            const Icon = report.icon;
            return (
              <div key={report.id} className="card" style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon size={24} color="white" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: 8 }}>{report.name}</h3>
                    <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>{report.description}</p>
                    <button className="btn btnSecondary" style={{ width: '100%' }}>
                      <Download size={16} style={{ marginRight: 8 }} />
                      Generate Report
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PrincipalShell>
  );
}
