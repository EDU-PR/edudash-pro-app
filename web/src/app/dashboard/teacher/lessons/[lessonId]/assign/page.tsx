'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { useLessonAssignment } from '@/hooks/useLessonAssignment';
import { Calendar, Users, Clock, AlertCircle, CheckCircle } from 'lucide-react';

export default function AssignLessonPage() {
  const router = useRouter();
  const params = useParams<{ lessonId: string }>();
  const lessonId = params?.lessonId;
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [lesson, setLesson] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<'class' | 'student'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState<string>('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [notes, setNotes] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const { assignLesson, assignLessonToClass, isAssigning } = useLessonAssignment();

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
      setAuthLoading(false);
    };
    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (!lessonId || !userId) return;
    
    const loadLesson = async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();
      
      if (error) {
        console.error('Error loading lesson:', error);
        setError('Failed to load lesson');
        return;
      }
      
      setLesson(data);
    };
    
    loadLesson();
  }, [lessonId, userId, supabase]);

  useEffect(() => {
    if (!userId || !profile?.preschoolId) return;
    
    const loadClasses = async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, grade_level')
        .eq('preschool_id', profile.preschoolId)
        .order('name');
      
      if (!error && data) {
        setClasses(data);
      }
    };
    
    const loadStudents = async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id, classes(name)')
        .eq('preschool_id', profile.preschoolId)
        .eq('is_active', true)
        .order('first_name');
      
      if (!error && data) {
        setStudents(data);
      }
    };
    
    loadClasses();
    loadStudents();
  }, [userId, profile?.preschoolId, supabase]);

  const handleAssign = async () => {
    if (!lessonId) {
      setError('Lesson ID is required');
      return;
    }

    setAssigning(true);
    setError(null);
    setSuccess(false);

    try {
      if (selectedTarget === 'class') {
        if (!selectedClassId) {
          setError('Please select a class');
          setAssigning(false);
          return;
        }
        
        const success = await assignLessonToClass(lessonId, selectedClassId, {
          due_date: dueDate || undefined,
          priority,
          notes: notes || undefined,
        });
        
        if (success) {
          setSuccess(true);
          setTimeout(() => {
            router.push('/dashboard/teacher/lessons');
          }, 2000);
        } else {
          setError('Failed to assign lesson');
        }
      } else {
        if (selectedStudentIds.size === 0) {
          setError('Please select at least one student');
          setAssigning(false);
          return;
        }
        
        const assignments = Array.from(selectedStudentIds).map(studentId => 
          assignLesson({
            lesson_id: lessonId,
            student_id: studentId,
            due_date: dueDate || undefined,
            priority,
            notes: notes || undefined,
          })
        );
        
        const results = await Promise.all(assignments);
        const allSuccess = results.every(r => r === true);
        
        if (allSuccess) {
          setSuccess(true);
          setTimeout(() => {
            router.push('/dashboard/teacher/lessons');
          }, 2000);
        } else {
          setError('Failed to assign lesson to some students');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to assign lesson');
    } finally {
      setAssigning(false);
    }
  };

  const toggleStudent = (studentId: string) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setSelectedStudentIds(newSet);
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  // Calculate default due date (7 days from now)
  const defaultDueDate = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return (
    <TeacherShell 
      tenantSlug={tenantSlug} 
      userEmail={profile?.email}
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName}
    >
      <div className="container">
        <div className="section">
          <h1 className="h1">Assign Lesson</h1>
          {lesson && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 8 }}>{lesson.title}</h3>
              {lesson.description && (
                <p style={{ color: 'var(--muted)', marginBottom: 8 }}>{lesson.description}</p>
              )}
              <div style={{ display: 'flex', gap: 16, fontSize: 14, color: 'var(--muted)' }}>
                <span>Subject: {lesson.subject}</span>
                <span>Duration: {lesson.duration_minutes} min</span>
                <span>Ages: {lesson.age_group}</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="section">
            <div className="card" style={{ borderLeft: '4px solid #ef4444', background: '#fee2e2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="section">
            <div className="card" style={{ borderLeft: '4px solid #10b981', background: '#d1fae5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p style={{ color: '#059669', margin: 0 }}>Lesson assigned successfully! Redirecting...</p>
              </div>
            </div>
          </div>
        )}

        <div className="section">
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Assignment Details</h3>

            {/* Target Selection */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Assign To</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className={`btn ${selectedTarget === 'class' ? 'btnPrimary' : ''}`}
                  onClick={() => setSelectedTarget('class')}
                  style={{ flex: 1 }}
                >
                  <Users className="icon16" />
                  Entire Class
                </button>
                <button
                  className={`btn ${selectedTarget === 'student' ? 'btnPrimary' : ''}`}
                  onClick={() => setSelectedTarget('student')}
                  style={{ flex: 1 }}
                >
                  <Users className="icon16" />
                  Individual Students
                </button>
              </div>
            </div>

            {/* Class Selection */}
            {selectedTarget === 'class' && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Select Class</label>
                <select
                  className="input"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Choose a class...</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} (Grade {cls.grade_level})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Student Selection */}
            {selectedTarget === 'student' && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  Select Students ({selectedStudentIds.size} selected)
                </label>
                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                  {students.map(student => (
                    <label
                      key={student.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: 8,
                        cursor: 'pointer',
                        borderRadius: 4,
                        background: selectedStudentIds.has(student.id) ? 'var(--primary)' + '20' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(student.id)}
                        onChange={() => toggleStudent(student.id)}
                      />
                      <span>
                        {student.first_name} {student.last_name}
                        {student.classes && ` - ${student.classes.name}`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Due Date */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 600 }}>
                <Calendar className="icon16" />
                Due Date
              </label>
              <input
                type="date"
                className="input"
                value={defaultDueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{ width: '100%' }}
              />
            </div>

            {/* Priority */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Priority</label>
              <select
                className="input"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                style={{ width: '100%' }}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Notes (Optional)</label>
              <textarea
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional instructions or notes..."
                rows={4}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btnPrimary"
                onClick={handleAssign}
                disabled={assigning || isAssigning}
                style={{ flex: 1 }}
              >
                {assigning || isAssigning ? 'Assigning...' : 'Assign Lesson'}
              </button>
              <button
                className="btn"
                onClick={() => router.back()}
                disabled={assigning || isAssigning}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}
