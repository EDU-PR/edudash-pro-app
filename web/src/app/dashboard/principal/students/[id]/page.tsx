'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { ArrowLeft, Calendar, User, Mail, Phone, MapPin, Users, FileText, Clock } from 'lucide-react';

interface StudentDetail {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  medical_info: string | null;
  allergies: string | null;
  status: string;
  enrollment_date: string | null;
  guardian_id: string | null;
  class_id: string | null;
  preschool_id: string;
  classes?: {
    id: string;
    name: string;
    age_group: string;
  };
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  };
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentDetail | null>(null);

  const { profile } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const preschoolName = profile?.preschoolName;
  const preschoolId = profile?.preschoolId;

  const studentId = params.id as string;

  // Auth check
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
    };
    initAuth();
  }, [router, supabase]);

  // Load student details
  useEffect(() => {
    if (!preschoolId || !studentId) {
      console.log('Waiting for preschoolId or studentId...', { preschoolId, studentId });
      return;
    }

    const loadStudent = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('students')
          .select(`
            *,
            classes (
              id,
              name,
              age_group
            ),
            profiles!students_guardian_id_fkey (
              first_name,
              last_name,
              email,
              phone
            )
          `)
          .eq('id', studentId)
          .eq('preschool_id', preschoolId)
          .single();

        if (error) {
          console.error('Error loading student:', error);
          setStudent(null);
          return;
        }

        setStudent(data);
      } catch (error) {
        console.error('Error loading student:', error);
        setStudent(null);
      } finally {
        setLoading(false);
      }
    };

    loadStudent();
  }, [preschoolId, studentId, supabase]);

  const calculateAge = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return 'Unknown';
    const birth = new Date(dateOfBirth);
    const today = new Date();
    const years = Math.floor((today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor(((today.getTime() - birth.getTime()) / (30.44 * 24 * 60 * 60 * 1000)) % 12);
    return `${years} years, ${months} months`;
  };

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mail size={16} style={{ color: 'var(--muted)' }} />
                    {student.profiles.email}
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
                  color: student.medical_info ? 'inherit' : 'var(--muted)'
                }}>
                  {student.medical_info || 'No medical information provided'}
                </div>
              </div>
            </div>
          </div>

          {/* Class Information */}
          {student.classes && (
            <div className="card">
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={20} />
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
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button 
              className="btn btnSecondary"
              onClick={() => router.push(`/dashboard/principal/students/${student.id}/edit`)}
            >
              Edit Student
            </button>
            <button 
              className="btn"
              style={{ 
                backgroundColor: student.status === 'active' ? '#f59e0b' : '#10b981',
                color: 'white'
              }}
              onClick={async () => {
                const newStatus = student.status === 'active' ? 'inactive' : 'active';
                const { error } = await supabase
                  .from('students')
                  .update({ status: newStatus })
                  .eq('id', student.id);
                
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
