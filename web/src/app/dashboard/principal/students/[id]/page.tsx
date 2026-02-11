'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { ArrowLeft, Calendar, User, Mail, Phone, MapPin, Users, FileText, Clock, KeyRound, MessageSquare, TrendingUp, School, BookOpen, Activity } from 'lucide-react';

interface StudentDetail {
  id: string;
  student_id: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  id_number: string | null;
  home_address: string | null;
  home_phone: string | null;
  medical_conditions: string | null;
  allergies: string | null;
  medication: string | null;
  notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  status: string;
  enrollment_date: string | null;
  guardian_id: string | null;
  parent_id?: string | null;
  class_id: string | null;
  preschool_id: string;
  organization_id?: string | null;
  registration_fee_amount?: number | null;
  registration_fee_paid?: boolean | null;
  payment_verified?: boolean | null;
  payment_date?: string | null;
  classes?: {
    id: string;
    name: string;
    age_group: string;
    teacher_id: string | null;
  };
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  };
}

interface RegistrationData {
  preferred_class?: string;
  preferred_start_date?: string;
  how_did_you_hear?: string;
  special_requests?: string;
  previous_school?: string;
}

interface AttendanceStats {
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

interface RecentActivity {
  id: string;
  type: string;
  title: string;
  date: string;
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [teacherName, setTeacherName] = useState<string | null>(null);
  const [lastContactDate, setLastContactDate] = useState<string | null>(null);
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [quickEditData, setQuickEditData] = useState({
    id_number: '',
    home_address: '',
    home_phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    medical_conditions: '',
    allergies: '',
    medication: '',
    notes: '',
    registration_fee_amount: '',
    payment_verified: false,
    payment_date: '',
  });

  const { profile } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const preschoolName = profile?.preschoolName;
  const preschoolId = profile?.preschoolId;
  const tenantId =
    (profile as any)?.organizationId ||
    (profile as any)?.organization_id ||
    (profile as any)?.preschoolId ||
    (profile as any)?.preschool_id ||
    preschoolId;

  const studentId = params.id as string;

  // Guard: Prevent treating "enroll" as a student ID
  useEffect(() => {
    if (studentId === 'enroll') {
      // This is handled by the /enroll route, not this dynamic [id] page
      return;
    }
  }, [studentId]);

  // Auth check
  useEffect(() => {
    if (studentId === 'enroll') return; // Skip auth check for enroll route
    
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
    };
    initAuth();
  }, [router, supabase, studentId]);

  // Load student details
  useEffect(() => {
    if (studentId === 'enroll') return; // Skip for enroll route
    
    if (!tenantId || !studentId) {
      console.log('Waiting for tenantId or studentId...', { tenantId, studentId });
      return;
    }

    const loadStudent = async () => {
      setLoading(true);
      try {
        // Fetch student using tenant-safe filters (preschool_id or organization_id)
        const { data, error } = await supabase
          .from('students')
          .select(`
            *,
            classes (
              id,
              name,
              age_group,
              teacher_id
            ),
            guardian:profiles!students_guardian_id_fkey (
              first_name,
              last_name,
              email,
              phone
            ),
            parent:profiles!students_parent_id_fkey (
              first_name,
              last_name,
              email,
              phone
            )
          `)
          .eq('id', studentId)
          .or(`preschool_id.eq.${tenantId},organization_id.eq.${tenantId}`)
          .single();

        if (error) {
          console.error('Error loading student:', error);
          setStudent(null);
          return;
        }

        // Merge guardian/parent data - prefer guardian, fallback to parent,
        // then resolve by auth_user_id when FK joins are empty.
        let guardianData = (data?.guardian as any) || null;
        let parentData = (data?.parent as any) || null;
        const profileIdsToResolve = [data?.guardian_id, data?.parent_id]
          .filter((id): id is string => Boolean(id));

        if (profileIdsToResolve.length > 0 && (!guardianData || !parentData)) {
          const profileMap: Record<string, any> = {};
          const { data: profilesById } = await supabase
            .from('profiles')
            .select('id, auth_user_id, first_name, last_name, email, phone')
            .in('id', profileIdsToResolve);
          (profilesById || []).forEach((profileRow: any) => {
            profileMap[profileRow.id] = profileRow;
            if (profileRow.auth_user_id) {
              profileMap[profileRow.auth_user_id] = profileRow;
            }
          });

          const unresolved = profileIdsToResolve.filter((id) => !profileMap[id]);
          if (unresolved.length > 0) {
            const { data: profilesByAuthId } = await supabase
              .from('profiles')
              .select('id, auth_user_id, first_name, last_name, email, phone')
              .in('auth_user_id', unresolved);
            (profilesByAuthId || []).forEach((profileRow: any) => {
              profileMap[profileRow.id] = profileRow;
              if (profileRow.auth_user_id) {
                profileMap[profileRow.auth_user_id] = profileRow;
              }
            });
          }

          if (!guardianData && data?.guardian_id && profileMap[data.guardian_id]) {
            guardianData = profileMap[data.guardian_id];
          }
          if (!parentData && data?.parent_id && profileMap[data.parent_id]) {
            parentData = profileMap[data.parent_id];
          }
        }

        if (data) {
          data.profiles = guardianData || parentData || null;
          delete (data as any).guardian;
          delete (data as any).parent;
        }

        console.log('[Student Page] Loaded student data:', data);
        console.log('[Student Page] Has profiles?', !!data?.profiles);
        console.log('[Student Page] Profile data:', data?.profiles);
        
        setStudent(data);
        setQuickEditData({
          id_number: data.id_number || '',
          home_address: data.home_address || '',
          home_phone: data.home_phone || '',
          emergency_contact_name: data.emergency_contact_name || '',
          emergency_contact_phone: data.emergency_contact_phone || '',
          emergency_contact_relation: data.emergency_contact_relation || '',
          medical_conditions: data.medical_conditions || '',
          allergies: data.allergies || '',
          medication: data.medication || '',
          notes: data.notes || '',
          registration_fee_amount:
            data.registration_fee_amount == null ? '' : Number(data.registration_fee_amount).toFixed(2),
          payment_verified: Boolean(data.payment_verified),
          payment_date: data.payment_date || '',
        });

        // Load additional data in parallel
        Promise.all([
          // Registration data
          supabase
            .from('registration_requests')
            .select('preferred_class, preferred_start_date, how_did_you_hear, special_requests, previous_school')
            .eq('student_id', studentId)
            .maybeSingle()
            .then(({ data }: any) => setRegistrationData(data)),

          // Teacher name
          data.classes?.teacher_id ? supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', data.classes.teacher_id)
            .single()
            .then(({ data: teacher }: any) => {
              if (teacher) setTeacherName(`${teacher.first_name} ${teacher.last_name}`);
            }) : Promise.resolve(),

          // Attendance stats (last 30 days)
          supabase
            .from('attendance')
            .select('status')
            .eq('student_id', studentId)
            .gte('attendance_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .then(({ data: attendance }: any) => {
              if (attendance) {
                const present = attendance.filter((a: any) => a.status === 'present').length;
                const absent = attendance.filter((a: any) => a.status === 'absent').length;
                const total = attendance.length;
                setAttendanceStats({
                  present,
                  absent,
                  total,
                  percentage: total > 0 ? Math.round((present / total) * 100) : 0
                });
              }
            }),

          // Recent activities
          supabase
            .from('homework_submissions')
            .select('id, created_at, homework:homework_id(title)')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(({ data: submissions }: any) => {
              if (submissions) {
                setRecentActivities(submissions.map((s: any) => ({
                  id: s.id,
                  type: 'homework',
                  title: (s.homework as any)?.title || 'Homework Submitted',
                  date: s.created_at
                })));
              }
            }),

          // Last parent contact
          supabase
            .from('messages')
            .select('created_at')
            .or(`sender_id.eq.${data.guardian_id},recipient_id.eq.${data.guardian_id}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .then(({ data: messages }: any) => {
              if (messages && messages[0]) {
                setLastContactDate(messages[0].created_at);
              }
            })
        ]).catch(err => console.error('Error loading additional data:', err));
      } catch (error) {
        console.error('Error loading student:', error);
        setStudent(null);
      } finally {
        setLoading(false);
      }
    };

    loadStudent();
  }, [tenantId, studentId, supabase]);

  const handleSendPasswordReset = async () => {
    if (!student?.profiles?.email) {
      alert('No parent email found for this student');
      return;
    }

    if (!confirm(`Send password reset email to ${student.profiles.email}?`)) {
      return;
    }

    setSendingPasswordReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(student.profiles.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      alert(`✅ Password reset email sent to ${student.profiles.email}!\n\nThe parent will receive an email with instructions to set their password.`);
    } catch (error: any) {
      console.error('Error sending password reset:', error);
      alert(`Failed to send password reset email: ${error.message}`);
    } finally {
      setSendingPasswordReset(false);
    }
  };

  const calculateAge = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return 'Unknown';
    const birth = new Date(dateOfBirth);
    const today = new Date();
    const years = Math.floor((today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor(((today.getTime() - birth.getTime()) / (30.44 * 24 * 60 * 60 * 1000)) % 12);
    return `${years} years, ${months} months`;
  };

  const handleQuickEditSave = async () => {
    if (!student || !tenantId) return;
    setQuickEditSaving(true);
    try {
      const registrationFeeRaw = quickEditData.registration_fee_amount.trim();
      const parsedRegistrationFee = registrationFeeRaw ? Number.parseFloat(registrationFeeRaw) : null;
      const paymentDate = quickEditData.payment_verified
        ? (quickEditData.payment_date || new Date().toISOString().split('T')[0])
        : null;

      const updates = {
        id_number: quickEditData.id_number || null,
        home_address: quickEditData.home_address || null,
        home_phone: quickEditData.home_phone || null,
        emergency_contact_name: quickEditData.emergency_contact_name || null,
        emergency_contact_phone: quickEditData.emergency_contact_phone || null,
        emergency_contact_relation: quickEditData.emergency_contact_relation || null,
        medical_conditions: quickEditData.medical_conditions || null,
        allergies: quickEditData.allergies || null,
        medication: quickEditData.medication || null,
        notes: quickEditData.notes || null,
        registration_fee_amount:
          parsedRegistrationFee != null && Number.isFinite(parsedRegistrationFee)
            ? Number(parsedRegistrationFee.toFixed(2))
            : null,
        payment_verified: quickEditData.payment_verified,
        payment_date: paymentDate,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('students')
        .update(updates)
        .eq('id', student.id)
        .or(`preschool_id.eq.${tenantId},organization_id.eq.${tenantId}`);

      if (error) throw error;

      setStudent((prev) => (prev ? { ...prev, ...updates } : prev));
      setQuickEditMode(false);
      alert('Student details updated successfully.');
    } catch (error: any) {
      console.error('Error saving quick edit details:', error);
      alert(`Failed to save details: ${error?.message || 'Unknown error'}`);
    } finally {
      setQuickEditSaving(false);
    }
  };

  // Guard: Don't render if this is the enroll route
  if (studentId === 'enroll') {
    return null; // Let the /enroll route handle this
  }

  if (loading) {
    return (
      <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId} hideRightSidebar={true}>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400">Loading student details...</p>
        </div>
      </PrincipalShell>
    );
  }

  if (!student) {
    return (
      <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId} hideRightSidebar={true}>
        <div className="section">
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <h3 style={{ marginBottom: 8 }}>Student not found</h3>
            <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
              The student you're looking for doesn't exist or you don't have access to view it.
            </p>
            <button 
              className="btn btnPrimary"
              onClick={() => router.push('/dashboard/principal/students')}
            >
              <ArrowLeft size={18} style={{ marginRight: 8 }} />
              Back to Students
            </button>
          </div>
        </div>
      </PrincipalShell>
    );
  }

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId} hideRightSidebar={true}>
      <div className="section">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <button 
            className="btn btnSecondary"
            onClick={() => router.push('/dashboard/principal/students')}
            style={{ marginBottom: 16 }}
          >
            <ArrowLeft size={18} style={{ marginRight: 8 }} />
            Back to Students
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div 
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 600,
                fontSize: 32,
              }}
            >
              {student.first_name[0]}{student.last_name[0]}
            </div>
            <div>
              <h1 className="h1" style={{ marginBottom: 8 }}>
                {student.first_name} {student.last_name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span 
                  style={{
                    padding: '4px 12px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: student.status === 'active' ? '#10b98120' : '#f59e0b20',
                    color: student.status === 'active' ? '#10b981' : '#f59e0b',
                  }}
                >
                  {student.status}
                </span>
                {student.classes && (
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                    {student.classes.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {/* Personal Information */}
          <div className="card">
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={20} />
              Personal Information
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Date of Birth</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} style={{ color: 'var(--muted)' }} />
                  {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : 'Not provided'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Age</div>
                <div>{calculateAge(student.date_of_birth)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Gender</div>
                <div>{student.gender || 'Not provided'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Enrollment Date</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} style={{ color: 'var(--muted)' }} />
                  {student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString() : 'Not provided'}
                </div>
              </div>
            </div>
          </div>

          {/* Additional Student Details */}
          <div className="card">
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={20} />
              Additional Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Student Number</div>
                <div>{student.student_id || 'Not provided'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>ID Number</div>
                <div>{student.id_number || 'Not provided'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Home Address</div>
                <div>{student.home_address || 'Not provided'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Home Phone</div>
                <div>{student.home_phone || 'Not provided'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Emergency Contact</div>
                <div>
                  {student.emergency_contact_name || 'Not provided'}
                  {student.emergency_contact_phone ? ` (${student.emergency_contact_phone})` : ''}
                  {student.emergency_contact_relation ? ` - ${student.emergency_contact_relation}` : ''}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Medication</div>
                <div>{student.medication || 'Not provided'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Notes</div>
                <div>{student.notes || 'No notes available'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Registration Fee</div>
                <div>
                  {student.registration_fee_amount != null
                    ? `R ${Number(student.registration_fee_amount).toFixed(2)}`
                    : 'Not set'}
                  {typeof student.registration_fee_paid === 'boolean'
                    ? ` (${student.registration_fee_paid ? 'Paid' : 'Not paid'})`
                    : ''}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Payment Verification</div>
                <div>
                  {typeof student.payment_verified === 'boolean'
                    ? student.payment_verified
                      ? 'Verified'
                      : 'Not verified'
                    : 'Unknown'}
                  {student.payment_date ? ` (${new Date(student.payment_date).toLocaleDateString()})` : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Guardian Information */}
          {student.profiles && (
            <div className="card">
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={20} />
                Guardian Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Name</div>
                  <div>{student.profiles.first_name} {student.profiles.last_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Email</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Mail size={16} style={{ color: 'var(--muted)' }} />
                      {student.profiles.email}
                    </div>
                    <button
                      onClick={handleSendPasswordReset}
                      disabled={sendingPasswordReset}
                      className="btn btnSecondary"
                      style={{ 
                        fontSize: 12,
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap'
                      }}
                      title="Send password reset email to parent"
                    >
                      <KeyRound size={14} />
                      {sendingPasswordReset ? 'Sending...' : 'Send Password Reset'}
                    </button>
                  </div>
                </div>
                {student.profiles.phone && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Phone</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Phone size={16} style={{ color: 'var(--muted)' }} />
                      {student.profiles.phone}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medical Information */}
          <div className="card">
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={20} />
              Medical Information
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Allergies</div>
                <div style={{ 
                  padding: 12, 
                  backgroundColor: student.allergies ? '#ef444420' : 'var(--surface)', 
                  borderRadius: 8,
                  color: student.allergies ? '#ef4444' : 'var(--muted)'
                }}>
                  {student.allergies || 'None reported'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Medical Notes</div>
                <div style={{ 
                  padding: 12, 
                  backgroundColor: 'var(--surface)', 
                  borderRadius: 8,
                  minHeight: 60,
                  color: student.medical_conditions ? 'inherit' : 'var(--muted)'
                }}>
                  {student.medical_conditions || 'No medical information provided'}
                </div>
              </div>
            </div>
          </div>

          {/* Class Information */}
          {student.classes && (
            <div className="card">
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <School size={20} />
                Class Assignment
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Class Name</div>
                  <div style={{ fontWeight: 600 }}>{student.classes.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Age Group</div>
                  <div>{student.classes.age_group}</div>
                </div>
                {teacherName && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Teacher</div>
                    <div>{teacherName}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Registration Details */}
          {registrationData && (
            <div className="card">
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={20} />
                Registration Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {registrationData.preferred_class && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Preferred Class</div>
                    <div>{registrationData.preferred_class}</div>
                  </div>
                )}
                {registrationData.preferred_start_date && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Preferred Start Date</div>
                    <div>{new Date(registrationData.preferred_start_date).toLocaleDateString()}</div>
                  </div>
                )}
                {registrationData.how_did_you_hear && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>How They Found Us</div>
                    <div>{registrationData.how_did_you_hear}</div>
                  </div>
                )}
                {registrationData.previous_school && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Previous School</div>
                    <div>{registrationData.previous_school}</div>
                  </div>
                )}
                {registrationData.special_requests && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Special Requests</div>
                    <div style={{ 
                      padding: 8,
                      backgroundColor: 'var(--surface)',
                      borderRadius: 6,
                      fontSize: 14
                    }}>
                      {registrationData.special_requests}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attendance Stats */}
          {attendanceStats && attendanceStats.total > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={20} />
                Attendance (Last 30 Days)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Attendance Rate</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: attendanceStats.percentage >= 90 ? '#10b981' : attendanceStats.percentage >= 75 ? '#f59e0b' : '#ef4444' }}>
                    {attendanceStats.percentage}%
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ padding: 8, backgroundColor: '#10b98110', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Present</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#10b981' }}>{attendanceStats.present}</div>
                  </div>
                  <div style={{ padding: 8, backgroundColor: '#ef444410', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Absent</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#ef4444' }}>{attendanceStats.absent}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Parent Communication */}
          {student.profiles && (
            <div className="card">
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={20} />
                Parent Communication
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Last Contact</div>
                  <div>{lastContactDate ? new Date(lastContactDate).toLocaleDateString() : 'No recent messages'}</div>
                </div>
                <button
                  className="btn btnSecondary"
                  onClick={() => router.push(`/dashboard/principal/messages?to=${student.guardian_id || student.parent_id || ''}`)}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <MessageSquare size={16} style={{ marginRight: 8 }} />
                  Send Message
                </button>
              </div>
            </div>
          )}

          {/* Recent Activities */}
          {recentActivities.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={20} />
                Recent Activities
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentActivities.map((activity) => (
                  <div 
                    key={activity.id}
                    style={{
                      padding: 10,
                      backgroundColor: 'var(--surface)',
                      borderRadius: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ fontSize: 14 }}>{activity.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {new Date(activity.date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {quickEditMode && (
          <div className="card" style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Quick Edit (on this page)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <input
                value={quickEditData.id_number}
                onChange={(e) => setQuickEditData((prev) => ({ ...prev, id_number: e.target.value }))}
                placeholder="ID number"
                style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <input
                value={quickEditData.home_phone}
                onChange={(e) => setQuickEditData((prev) => ({ ...prev, home_phone: e.target.value }))}
                placeholder="Home phone"
                style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <input
                value={quickEditData.emergency_contact_name}
                onChange={(e) => setQuickEditData((prev) => ({ ...prev, emergency_contact_name: e.target.value }))}
                placeholder="Emergency contact name"
                style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <input
                value={quickEditData.emergency_contact_phone}
                onChange={(e) => setQuickEditData((prev) => ({ ...prev, emergency_contact_phone: e.target.value }))}
                placeholder="Emergency contact phone"
                style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <input
                value={quickEditData.emergency_contact_relation}
                onChange={(e) => setQuickEditData((prev) => ({ ...prev, emergency_contact_relation: e.target.value }))}
                placeholder="Emergency relationship"
                style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <input
                value={quickEditData.registration_fee_amount}
                onChange={(e) => setQuickEditData((prev) => ({ ...prev, registration_fee_amount: e.target.value }))}
                placeholder="Registration fee amount"
                style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <input
                type="date"
                value={quickEditData.payment_date}
                onChange={(e) => setQuickEditData((prev) => ({ ...prev, payment_date: e.target.value }))}
                style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={quickEditData.payment_verified}
                  onChange={(e) => setQuickEditData((prev) => ({ ...prev, payment_verified: e.target.checked }))}
                />
                Payment verified
              </label>
            </div>
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              <textarea
                value={quickEditData.home_address}
                onChange={(e) => setQuickEditData((prev) => ({ ...prev, home_address: e.target.value }))}
                placeholder="Home address"
                rows={2}
                style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical' }}
              />
              <textarea
                value={quickEditData.medical_conditions}
                onChange={(e) => setQuickEditData((prev) => ({ ...prev, medical_conditions: e.target.value }))}
                placeholder="Medical conditions"
                rows={2}
                style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical' }}
              />
              <textarea
                value={quickEditData.allergies}
                onChange={(e) => setQuickEditData((prev) => ({ ...prev, allergies: e.target.value }))}
                placeholder="Allergies"
                rows={2}
                style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical' }}
              />
              <textarea
                value={quickEditData.medication}
                onChange={(e) => setQuickEditData((prev) => ({ ...prev, medication: e.target.value }))}
                placeholder="Medication"
                rows={2}
                style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical' }}
              />
              <textarea
                value={quickEditData.notes}
                onChange={(e) => setQuickEditData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes"
                rows={3}
                style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="btn btnSecondary" onClick={() => setQuickEditMode(false)} disabled={quickEditSaving}>
                Cancel
              </button>
              <button className="btn btnPrimary" onClick={handleQuickEditSave} disabled={quickEditSaving}>
                {quickEditSaving ? 'Saving...' : 'Save Quick Edit'}
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions Bar */}
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              className="btn btnPrimary"
              onClick={() => setQuickEditMode((prev) => !prev)}
            >
              {quickEditMode ? 'Close Quick Edit' : 'Quick Edit Here'}
            </button>
            <button 
              className="btn btnSecondary"
              onClick={() => router.push(`/dashboard/principal/students/${student.id}/edit`)}
            >
              Edit Student
            </button>
            <button 
              className="btn btnSecondary"
              onClick={() => router.push(`/dashboard/principal/reports?student=${student.id}`)}
            >
              View Progress Reports
            </button>
            <button 
              className="btn btnSecondary"
              onClick={() => router.push(`/dashboard/principal/messages?to=${student.guardian_id || student.parent_id || ''}`)}
            >
              <MessageSquare size={16} style={{ marginRight: 8 }} />
              Message Parent
            </button>
            <div style={{ flex: 1 }} />
            <button 
              className="btn"
              style={{ 
                backgroundColor: student.status === 'active' ? '#f59e0b' : '#10b981',
                color: 'white'
              }}
              onClick={async () => {
                const newStatus = student.status === 'active' ? 'inactive' : 'active';
                let query = supabase
                  .from('students')
                  .update({ status: newStatus })
                  .eq('id', student.id);
                if (tenantId) {
                  query = query.or(`preschool_id.eq.${tenantId},organization_id.eq.${tenantId}`);
                }
                const { error } = await query;
                
                if (!error) {
                  setStudent({ ...student, status: newStatus });
                }
              }}
            >
              {student.status === 'active' ? 'Deactivate' : 'Activate'} Student
            </button>
          </div>
        </div>
      </div>
    </PrincipalShell>
  );
}
