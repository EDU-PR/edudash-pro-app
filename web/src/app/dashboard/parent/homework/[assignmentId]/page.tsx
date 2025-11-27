'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { SubPageHeader } from '@/components/dashboard/SubPageHeader';
import { useParentDashboardData } from '@/lib/hooks/useParentDashboardData';
import type { ChildCard } from '@/lib/hooks/parent/useChildrenData';
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  UploadCloud,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Paperclip,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

const describeDueDate = (dueDateStr: string | null) => {
  if (!dueDateStr) {
    return { label: 'No due date yet', tone: 'muted' };
  }

  const dueDate = new Date(dueDateStr);
  const diff = dueDate.getTime() - Date.now();
  const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`, tone: 'danger' };
  }

  if (diffDays === 0) {
    return { label: 'Due today', tone: 'warning' };
  }

  if (diffDays === 1) {
    return { label: 'Due tomorrow', tone: 'warning' };
  }

  if (diffDays <= 7) {
    return { label: `Due in ${diffDays} days`, tone: 'info' };
  }

  return { label: dueDate.toLocaleDateString([], { month: 'short', day: 'numeric' }), tone: 'muted' };
};

const ChildSelector = ({
  childrenCards,
  activeChildId,
  setActiveChildId,
}: {
  childrenCards: ChildCard[];
  activeChildId: string | null;
  setActiveChildId: (id: string) => void;
}) => {
  if (childrenCards.length <= 1) return null;

  return (
    <div className="section">
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
        {childrenCards.map((child) => (
          <button
            key={child.id}
            onClick={() => setActiveChildId(child.id)}
            className="chip"
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              border: activeChildId === child.id ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: activeChildId === child.id ? 'var(--primary-subtle)' : 'var(--surface-1)',
              color: activeChildId === child.id ? 'var(--primary)' : 'var(--text-primary)',
              fontWeight: activeChildId === child.id ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {child.firstName} {child.lastName}
          </button>
        ))}
      </div>
    </div>
  );
};

const SubmissionStatusBadge = ({ submission }: { submission: any | null }) => {
  if (!submission) {
    return (
      <span
        style={{
          padding: '2px 10px',
          borderRadius: 999,
          background: 'var(--surface-2)',
          color: 'var(--muted)',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Not submitted
      </span>
    );
  }

  const tone = submission.status === 'graded' ? 'var(--success)' : 'var(--warning)';
  const label = submission.status === 'graded' ? 'Graded' : submission.status.replace('_', ' ');

  return (
    <span
      style={{
        padding: '2px 10px',
        borderRadius: 999,
        background: tone + '22',
        color: tone,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {label}
    </span>
  );
};

export default function ParentHomeworkDetailPage() {
  const router = useRouter();
  const params = useParams<{ assignmentId: string }>();
  const assignmentParam = Array.isArray(params?.assignmentId) ? params.assignmentId[0] : params?.assignmentId;
  const supabase = createClient();

  const {
    userId,
    profile,
    loading: dashboardLoading,
    userName,
    preschoolName,
    hasOrganization,
    tenantSlug,
    unreadCount,
    childrenCards,
    activeChildId,
    setActiveChildId,
    childrenLoading,
  } = useParentDashboardData();

  const [assignment, setAssignment] = useState<any | null>(null);
  const [target, setTarget] = useState<any | null>(null);
  const [submission, setSubmission] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Submission form state
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!assignmentParam || !hasOrganization || !activeChildId) {
      setLoadingDetail(false);
      return;
    }

    let isMounted = true;

    const loadDetails = async () => {
      try {
        setLoadingDetail(true);
        setError(null);

        const [assignmentRow, targetRes, submissionRes] = await Promise.all([
          supabase
            .from('homework')
            .select('*')
            .eq('id', assignmentParam)
            .single()
            .then((res: any) => res.data),
          supabase
            .from('homework_assignment_targets')
            .select('*')
            .eq('assignment_id', assignmentParam)
            .eq('student_id', activeChildId)
            .maybeSingle(),
          supabase
            .from('homework_submissions')
            .select('*')
            .eq('assignment_id', assignmentParam)
            .eq('student_id', activeChildId)
            .maybeSingle(),
        ]);

        if (!isMounted) return;

        if (targetRes.error && targetRes.error.code !== 'PGRST116') {
          throw targetRes.error;
        }
        if (submissionRes.error && submissionRes.error.code !== 'PGRST116') {
          throw submissionRes.error;
        }

        setAssignment(assignmentRow ?? null);
        setTarget(targetRes.data ?? null);
        setSubmission(submissionRes.data ?? null);
      } catch (loadError) {
        if (!isMounted) return;
        console.error('[ParentHomeworkDetailPage] Failed to load assignment', loadError);
        setError('Unable to load homework details. Please try again.');
      } finally {
        if (isMounted) setLoadingDetail(false);
      }
    };

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [assignmentParam, activeChildId, hasOrganization, supabase]);

  const userEmail = profile?.email ?? userId;
  const activeChild = childrenCards.find((child) => child.id === activeChildId) ?? null;
  const dueInfo = describeDueDate(target?.due_at ?? assignment?.due_date ?? null);
  const attachments = Array.isArray(assignment?.attachment_urls)
    ? (assignment?.attachment_urls as string[])
    : [];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSubmissionFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSubmissionFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitWork = async () => {
    if (!assignment || !activeChild) {
      setError('Missing assignment or student information.');
      return;
    }

    if (!submissionText.trim() && submissionFiles.length === 0) {
      setError('Please add some text or upload at least one file.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const fileUrls: string[] = [];

      // Upload files to Supabase Storage
      if (submissionFiles.length > 0) {
        for (const file of submissionFiles) {
          const fileName = `${Date.now()}_${file.name}`;
          const filePath = `homework_submissions/${assignment.preschool_id}/${assignment.id}/${activeChild.id}/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('homework-files')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error('File upload error:', uploadError);
            throw new Error(`Failed to upload ${file.name}`);
          }

          const { data: urlData } = supabase.storage
            .from('homework-files')
            .getPublicUrl(filePath);

          fileUrls.push(urlData.publicUrl);
        }
      }

      // Create submission in database
      const { data: submissionData, error: submitError } = await supabase
        .from('homework_submissions')
        .insert({
          assignment_id: assignment.id,
          student_id: activeChild.id,
          preschool_id: assignment.preschool_id,
          submitted_by: userId!,
          content: submissionText.trim() || null,
          content_type: submissionFiles.length > 0 ? 'mixed' : 'text',
          content_url: fileUrls.length > 0 ? fileUrls[0] : null,
          content_metadata: {
            files: fileUrls,
            file_count: fileUrls.length,
            submission_source: 'parent_dashboard',
          },
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (submitError) throw submitError;

      setSubmission(submissionData);
      setShowSubmissionForm(false);
      setSubmissionText('');
      setSubmissionFiles([]);

      // Refresh to show updated data
      window.location.reload();
    } catch (err) {
      console.error('Submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit work. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (dashboardLoading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!assignmentParam) {
    return (
      <ParentShell tenantSlug={tenantSlug} userEmail={userEmail} userName={userName} preschoolName={preschoolName} unreadCount={unreadCount}>
        <div style={{ padding: 40 }}>
          <p style={{ color: 'var(--danger)' }}>Missing assignment reference.</p>
        </div>
      </ParentShell>
    );
  }

  if (!hasOrganization) {
    return (
      <ParentShell tenantSlug={tenantSlug} userEmail={userEmail} userName={userName} preschoolName={preschoolName} unreadCount={unreadCount}>
        <div style={{ margin: 'calc(var(--space-3) * -1) calc(var(--space-2) * -1)' }}>
          <SubPageHeader
            title="Homework"
            subtitle="Link to your school to unlock detailed assignments"
            icon={<FileText size={28} color="white" />}
          />
          <div style={{ padding: 24 }}>
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Assignment unavailable</h3>
              <p style={{ color: 'var(--muted)' }}>Connect to your child's school to view homework details.</p>
            </div>
          </div>
        </div>
      </ParentShell>
    );
  }

  return (
    <ParentShell
      tenantSlug={tenantSlug}
      userEmail={userEmail}
      userName={userName}
      preschoolName={preschoolName}
      unreadCount={unreadCount}
      hasOrganization={hasOrganization}
    >
      <div style={{ margin: 'calc(var(--space-3) * -1) calc(var(--space-2) * -1)' }}>
        <SubPageHeader
          title={assignment?.title || 'Homework details'}
          subtitle={assignment?.subject ? assignment.subject.toUpperCase?.() : 'Assignment overview'}
          icon={<FileText size={28} color="white" />}
        />
        <div style={{ width: '100%', padding: 20 }}>
          <button
            className="btn"
            style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => router.push('/dashboard/parent/homework')}
          >
            <ArrowLeft size={16} /> Back to homework
          </button>

          <ChildSelector
            childrenCards={childrenCards}
            activeChildId={activeChildId}
            setActiveChildId={setActiveChildId}
          />

          {childrenLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Loader2 className="animate-spin" size={32} color="var(--primary)" />
            </div>
          )}

          {!childrenLoading && !activeChild && (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <AlertCircle size={40} color="var(--warning)" style={{ marginBottom: 12 }} />
              <p style={{ color: 'var(--muted)', margin: 0 }}>Link a child to view homework details.</p>
            </div>
          )}

          {error && (
            <div className="card" style={{ padding: 24, marginBottom: 16 }}>
              <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
            </div>
          )}

          {activeChild && loadingDetail && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Loader2 className="animate-spin" size={32} color="var(--primary)" />
            </div>
          )}

          {activeChild && !loadingDetail && !assignment && !error && (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <AlertCircle size={40} color="var(--danger)" style={{ marginBottom: 12 }} />
              <p style={{ color: 'var(--muted)', margin: 0 }}>This assignment could not be found.</p>
            </div>
          )}

          {activeChild && assignment && (
            <div className="section" style={{ display: 'grid', gap: 16 }}>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div>
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 4 }}>Assigned to</p>
                    <h2 style={{ fontSize: 20, marginBottom: 6 }}>{activeChild.firstName} {activeChild.lastName}</h2>
                    <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 12 }}>
                      {assignment.subject?.toUpperCase?.() || 'GENERAL'} • {assignment.grade_band || 'All grades'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Status</p>
                    <SubmissionStatusBadge submission={submission} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'var(--muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={16} /> {dueInfo.label}
                  </span>
                  {assignment.estimated_time_minutes && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={16} /> ~{assignment.estimated_time_minutes} minutes
                    </span>
                  )}
                  {target?.status && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={16} color="var(--primary)" /> {target.status}
                    </span>
                  )}
                </div>
              </div>

              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Instructions</h3>
                <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                  {assignment.description || 'No instructions were provided.'}
                </p>
                {assignment.requires_media && (
                  <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'var(--surface-2)' }}>
                    <p style={{ margin: 0, fontSize: 14 }}>
                      <strong>Heads up:</strong> The teacher requested photos, videos, or voice notes.
                    </p>
                  </div>
                )}
                {attachments.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Resources</p>
                    <ul style={{ listStyle: 'disc', paddingLeft: 20, color: 'var(--muted)' }}>
                      {attachments.map((url) => (
                        <li key={url}>
                          <a href={url} target="_blank" rel="noreferrer" className="link">Open attachment</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600 }}>Submission</h3>
                  <SubmissionStatusBadge submission={submission} />
                </div>
                {submission ? (
                  <div>
                    <p style={{ color: 'var(--muted)', marginBottom: 8 }}>
                      Submitted on {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '—'}
                    </p>
                    {submission.feedback && (
                      <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'var(--surface-2)' }}>
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>Teacher feedback</p>
                        <p style={{ margin: 0, color: 'var(--muted)' }}>{submission.feedback}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {!showSubmissionForm ? (
                      <>
                        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
                          Upload photos, recordings, or notes to let the teacher know this homework is done.
                        </p>
                        <button
                          className="btn btnPrimary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                          onClick={() => setShowSubmissionForm(true)}
                        >
                          <UploadCloud size={18} /> Submit work
                        </button>
                      </>
                    ) : (
                      <div>
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                            Written response (optional)
                          </label>
                          <textarea
                            value={submissionText}
                            onChange={(e) => setSubmissionText(e.target.value)}
                            placeholder="Type your answer or notes here..."
                            rows={6}
                            style={{
                              width: '100%',
                              padding: 12,
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                              background: 'var(--surface-1)',
                              color: 'var(--text-primary)',
                              fontSize: 14,
                              fontFamily: 'inherit',
                              resize: 'vertical',
                            }}
                          />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                            Attachments (optional)
                          </label>
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                          />
                          <button
                            className="btn btnSecondary"
                            onClick={() => fileInputRef.current?.click()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}
                          >
                            <Paperclip size={16} /> Add files
                          </button>

                          {submissionFiles.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {submissionFiles.map((file, index) => (
                                <div
                                  key={index}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 12,
                                    borderRadius: 8,
                                    background: 'var(--surface-2)',
                                    border: '1px solid var(--border)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                                    <Paperclip size={16} color="var(--primary)" />
                                    <span style={{ fontSize: 14 }}>{file.name}</span>
                                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveFile(index)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      padding: 4,
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <X size={18} color="var(--danger)" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                          <button
                            className="btn btnPrimary"
                            onClick={handleSubmitWork}
                            disabled={isSubmitting || (!submissionText.trim() && submissionFiles.length === 0)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 size={18} className="animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={18} />
                                Submit work
                              </>
                            )}
                          </button>
                          <button
                            className="btn btnSecondary"
                            onClick={() => {
                              setShowSubmissionForm(false);
                              setSubmissionText('');
                              setSubmissionFiles([]);
                            }}
                            disabled={isSubmitting}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Need help?</p>
                  <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Ask EduDash AI</h3>
                  <p style={{ color: 'var(--muted)', marginTop: 4 }}>
                    Get hints or step-by-step explanations before you submit.
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/dashboard/parent/ai-help?assignmentId=${assignment.id}`)}
                  className="btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Sparkles size={16} /> Open AI helper
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ParentShell>
  );
}
