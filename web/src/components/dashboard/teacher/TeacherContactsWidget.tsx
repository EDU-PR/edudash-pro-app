'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User, Search, GraduationCap } from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  class_id: string;
}

interface Parent {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  students: Student[];
}

interface Teacher {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: string;
  classes: string[];
}

interface TeacherContactsWidgetProps {
  preschoolId: string | undefined;
  teacherId: string | undefined;
}

export function TeacherContactsWidget({ preschoolId, teacherId }: TeacherContactsWidgetProps) {
  const router = useRouter();
  const supabase = createClient();
  const [parents, setParents] = useState<Parent[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'parents' | 'teachers'>('parents');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!preschoolId || !teacherId) return;
    
    fetchContacts();
  }, [preschoolId, teacherId]);

  const fetchContacts = async () => {
    if (!preschoolId || !teacherId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([fetchParents(), fetchTeachers()]);
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
      setError(error.message || 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  const fetchParents = async () => {
    try {
      // Get the teacher's classes
      const { data: teacherClasses, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('teacher_id', teacherId)
        .eq('preschool_id', preschoolId);
      
      if (classesError) throw classesError;
      
      const teacherClassIds = teacherClasses?.map((c: any) => c.id) || [];
      
      if (teacherClassIds.length === 0) {
        setParents([]);
        return;
      }
      
      // Get students from teacher's classes
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          class_id,
          parent_id
        `)
        .eq('preschool_id', preschoolId)
        .in('class_id', teacherClassIds)
        .not('parent_id', 'is', null);
      
      if (studentsError) throw studentsError;
      
      if (!students || students.length === 0) {
        setParents([]);
        return;
      }
      
      // Get unique parent IDs
      const parentIds = [...new Set(students.map((s: any) => s.parent_id).filter(Boolean))] as string[];
      
      // Fetch parent profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, phone')
        .in('id', parentIds);
      
      if (profilesError) throw profilesError;
      
      // Group students by parent
      const parentsData: Parent[] = [];
      
      for (const profile of profiles || []) {
        const parentStudents = students.filter((s: any) => s.parent_id === profile.id);
        
        parentsData.push({
          id: profile.id,
          email: profile.email,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          phone: profile.phone,
          students: parentStudents,
        });
      }
      
      setParents(parentsData);
    } catch (error) {
      console.error('Error fetching parents:', error);
      throw error;
    }
  };

  const fetchTeachers = async () => {
    try {
      // Get other teachers in the same preschool
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          first_name,
          last_name,
          phone,
          role,
          preschool_id
        `)
        .eq('preschool_id', preschoolId)
        .in('role', ['teacher', 'principal'])
        .neq('id', teacherId); // Exclude current teacher
      
      if (profilesError) throw profilesError;
      
      // Get classes for each teacher
      const teachersData: Teacher[] = [];
      
      for (const profile of profiles || []) {
        const { data: teacherClasses } = await supabase
          .from('classes')
          .select('name')
          .eq('teacher_id', profile.id)
          .eq('preschool_id', preschoolId);
        
        teachersData.push({
          id: profile.id,
          email: profile.email,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          phone: profile.phone,
          role: profile.role,
          classes: teacherClasses?.map((c: any) => c.name) || [],
        });
      }
      
      setTeachers(teachersData);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      throw error;
    }
  };

  const handleStartConversation = async (contactId: string, contactRole: string) => {
    try {
      console.log('🔍 Looking for existing thread between teacher:', teacherId, 'and contact:', contactId);
      
      // Find existing thread between teacher and contact
      const { data: existingThreads, error: threadsError } = await supabase
        .from('message_threads')
        .select(`
          id,
          message_participants(user_id, role)
        `)
        .eq('preschool_id', preschoolId);
      
      if (threadsError) {
        console.error('Error fetching threads:', threadsError);
        throw threadsError;
      }
      
      console.log('📋 Found threads:', existingThreads?.length || 0, existingThreads);
      
      // Check if thread exists with both participants
      const existingThread = existingThreads?.find((thread: any) => {
        const participants = thread.message_participants || [];
        const hasTeacher = participants.some((p: any) => p.user_id === teacherId);
        const hasContact = participants.some((p: any) => p.user_id === contactId);
        const isMatch = hasTeacher && hasContact;
        console.log('  Thread', thread.id, '- participants:', participants.length, 'hasTeacher:', hasTeacher, 'hasContact:', hasContact, 'match:', isMatch);
        return isMatch;
      });
      
      if (existingThread) {
        console.log('✅ Found existing thread:', existingThread.id);
        // Redirect to messages page with thread selection
        router.push(`/dashboard/teacher/messages?thread=${existingThread.id}`);
        return;
      }
      
      console.log('🆕 Creating new thread for contact');
      
      // Create new thread with correct type based on contact role
      // Valid types: 'parent-teacher', 'parent-principal', 'general'
      const threadType = contactRole === 'parent' ? 'parent-teacher' : 'general';
      
      const { data: newThread, error: threadError } = await supabase
        .from('message_threads')
        .insert({
          preschool_id: preschoolId,
          subject: `Conversation with ${contactRole}`,
          created_by: teacherId,
          type: threadType,
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (threadError) throw threadError;
      
      // Add participants
      const participants = [
        {
          thread_id: newThread.id,
          user_id: teacherId,
          role: 'teacher',
          joined_at: new Date().toISOString(),
        },
        {
          thread_id: newThread.id,
          user_id: contactId,
          role: contactRole,
          joined_at: new Date().toISOString(),
        }
      ];
      
      const { error: participantsError } = await supabase
        .from('message_participants')
        .insert(participants);
      
      if (participantsError) throw participantsError;
      
      console.log('✅ Created new thread:', newThread.id, 'with participants:', participants.map(p => p.user_id));
      
      // Redirect to messages page with new thread selection
      router.push(`/dashboard/teacher/messages?thread=${newThread.id}`);
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      alert('Failed to start conversation. Please try again.');
    }
  };

  // Filter contacts based on search query
  const filteredParents = parents.filter(parent =>
    `${parent.first_name} ${parent.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    parent.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    parent.students.some(student => 
      `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const filteredTeachers = teachers.filter(teacher =>
    `${teacher.first_name} ${teacher.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.classes.some(className => className.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          <p style={{ color: 'var(--muted)' }}>Loading contacts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--danger)', marginBottom: 16 }}>Error: {error}</p>
          <button 
            onClick={fetchContacts}
            className="btn btnPrimary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '800px',
      margin: '0 auto',
      background: 'rgba(30, 41, 59, 0.4)',
      borderRadius: '20px',
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(20px)'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 28px',
        background: 'rgba(30, 41, 59, 0.8)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em'
        }}>
          Contacts
        </h2>
        <span style={{
          fontSize: 13,
          color: 'rgba(255, 255, 255, 0.5)',
          fontWeight: 500
        }}>
          {filteredParents.length + filteredTeachers.length} contacts
        </span>
      </div>

      {/* Search Bar */}
      <div style={{ 
        padding: '24px 28px', 
        background: 'rgba(30, 41, 59, 0.6)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <Search className="searchIcon icon16" style={{
            position: 'absolute',
            left: 18,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'rgba(255, 255, 255, 0.4)',
            pointerEvents: 'none',
            zIndex: 2
          }} />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '48px',
              padding: '0 20px 0 50px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '24px',
              fontSize: '15px',
              fontWeight: 400,
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)'
            }}
            onFocus={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.12)';
              e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.08)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Tab Navigation */}
        <div style={{ 
          display: 'flex', 
          background: 'rgba(255, 255, 255, 0.06)', 
          borderRadius: '16px', 
          padding: '4px',
          marginBottom: 0,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(10px)'
        }}>
          <button
            onClick={() => setActiveTab('parents')}
            style={{
              flex: 1,
              padding: '14px 20px',
              border: 'none',
              background: activeTab === 'parents' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
              color: activeTab === 'parents' ? 'white' : 'rgba(255, 255, 255, 0.7)',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: activeTab === 'parents' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
            }}
          >
            <User size={16} />
            Parents ({filteredParents.length})
          </button>
          <button
            onClick={() => setActiveTab('teachers')}
            style={{
              flex: 1,
              padding: '14px 20px',
              border: 'none',
              background: activeTab === 'teachers' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
              color: activeTab === 'teachers' ? 'white' : 'rgba(255, 255, 255, 0.7)',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: activeTab === 'teachers' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
            }}
          >
            <GraduationCap size={16} />
            Teachers ({filteredTeachers.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ 
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(30, 41, 59, 0.2) 100%)',
        minHeight: '400px'
      }}>
        {activeTab === 'parents' && (
          <>
            {filteredParents.length === 0 ? (
              <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '40px',
                  background: 'var(--surface-1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  border: '1px solid var(--border)'
                }}>
                  <User size={32} style={{ color: 'var(--muted)' }} />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {searchQuery ? 'No matches found' : 'No parent contacts'}
                </h3>
                <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
                  {searchQuery ? 'Try adjusting your search terms.' : 'Parent contacts will appear here when students are enrolled in your classes.'}
                </p>
              </div>
            ) : (
              <div>
                {filteredParents.map((parent, index) => (
                  <div
                    key={parent.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '16px 20px',
                      background: 'transparent',
                      borderBottom: index < filteredParents.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      justifyContent: 'space-between'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    onClick={() => handleStartConversation(parent.id, 'parent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <div 
                        style={{ 
                          marginRight: 12,
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          fontSize: '16px',
                          fontWeight: '600',
                          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          flexShrink: 0,
                          boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                          border: '2px solid rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        {parent.first_name[0]}{parent.last_name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ 
                            fontWeight: 600, 
                            fontSize: 16, 
                            color: 'var(--text-primary)',
                            lineHeight: 1.2,
                            letterSpacing: '-0.01em',
                            display: 'block'
                          }}>
                            {parent.first_name} {parent.last_name}
                          </span>
                        </div>
                        <div style={{ 
                          fontSize: 14, 
                          color: 'rgba(255, 255, 255, 0.6)', 
                          lineHeight: 1.4,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: 400
                        }}>
                          Children: {parent.students.map(s => `${s.first_name} ${s.last_name}`).join(', ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'teachers' && (
          <>
            {filteredTeachers.length === 0 ? (
              <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '40px',
                  background: 'var(--surface-1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  border: '1px solid var(--border)'
                }}>
                  <GraduationCap size={32} style={{ color: 'var(--muted)' }} />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {searchQuery ? 'No matches found' : 'No other teachers'}
                </h3>
                <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
                  {searchQuery ? 'Try adjusting your search terms.' : 'Other teachers and staff members will appear here.'}
                </p>
              </div>
            ) : (
              <div>
                {filteredTeachers.map((teacher, index) => (
                  <div
                    key={teacher.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '16px 20px',
                      background: 'transparent',
                      borderBottom: index < filteredTeachers.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      justifyContent: 'space-between'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    onClick={() => handleStartConversation(teacher.id, teacher.role)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <div 
                        style={{ 
                          marginRight: 12,
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          fontSize: '16px',
                          fontWeight: '600',
                          background: teacher.role === 'principal' 
                            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                            : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          flexShrink: 0,
                          boxShadow: teacher.role === 'principal' 
                            ? '0 4px 12px rgba(245, 158, 11, 0.25)'
                            : '0 4px 12px rgba(139, 92, 246, 0.25)',
                          border: '2px solid rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        {teacher.first_name[0]}{teacher.last_name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <span style={{ 
                              fontWeight: 600, 
                              fontSize: 16, 
                              color: 'var(--text-primary)',
                              lineHeight: 1.2,
                              letterSpacing: '-0.01em'
                            }}>
                              {teacher.first_name} {teacher.last_name}
                            </span>
                            <span style={{
                              fontSize: 10,
                              padding: '3px 6px',
                              borderRadius: 5,
                              background: teacher.role === 'principal' 
                                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                                : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                              color: 'white',
                              textTransform: 'capitalize',
                              fontWeight: 700,
                              flexShrink: 0,
                              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.2)'
                            }}>
                              {teacher.role}
                            </span>
                          </div>
                        </div>
                        <div style={{ 
                          fontSize: 14, 
                          color: 'rgba(255, 255, 255, 0.6)', 
                          lineHeight: 1.4,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: 400
                        }}>
                          {teacher.classes.length > 0 ? `Classes: ${teacher.classes.join(', ')}` : teacher.email}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}