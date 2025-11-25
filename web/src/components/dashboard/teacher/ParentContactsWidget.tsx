'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MessageCircle, Mail, Phone, User, Users, ChevronRight, Search } from 'lucide-react';

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
  unread_count: number;
}

interface ParentContactsWidgetProps {
  preschoolId: string | undefined;
  teacherId: string | undefined;
  classIds?: string[]; // Optional: filter by specific classes
}

export function ParentContactsWidget({ preschoolId, teacherId, classIds }: ParentContactsWidgetProps) {
  const router = useRouter();
  const supabase = createClient();
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!preschoolId || !teacherId) return;
    
    fetchParents();
  }, [preschoolId, teacherId, classIds]);

  const fetchParents = async () => {
    if (!preschoolId || !teacherId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Build query to get students
      let studentsQuery = supabase
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
        .not('parent_id', 'is', null);
      
      // Filter by class if specified
      if (classIds && classIds.length > 0) {
        studentsQuery = studentsQuery.in('class_id', classIds);
      }
      
      const { data: students, error: studentsError } = await studentsQuery;
      
      if (studentsError) throw studentsError;
      
      if (!students || students.length === 0) {
        console.log('No students found with parent_id for preschool:', preschoolId);
        setParents([]);
        setLoading(false);
        return;
      }
      
      console.log(`Found ${students.length} students with parents:`, students);
      
      // Get unique parent IDs
      const parentIds = [...new Set(students.map((s: any) => s.parent_id).filter(Boolean))] as string[];
      console.log('Unique parent IDs:', parentIds);
      
      // Fetch parent profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, phone')
        .in('id', parentIds);
      
      console.log('Parent profiles fetched:', profiles);
      if (profilesError) {
        console.error('Error fetching parent profiles:', profilesError);
        throw profilesError;
      }
      
      // Get unread message counts for each parent
      const unreadCounts = await Promise.all(
        parentIds.map(async (parentId) => {
          // First get all threads for this preschool
          const { data: allThreads } = await supabase
            .from('message_threads')
            .select(`
              id,
              message_participants!inner(user_id, role, last_read_at)
            `)
            .eq('preschool_id', preschoolId);
          
          if (!allThreads) return { parentId, count: 0 };
          
          // Filter threads where this parent is a participant
          const parentThreads = allThreads.filter((thread: any) => 
            thread.message_participants?.some((p: any) => 
              p.user_id === parentId && p.role === 'parent'
            )
          );
          
          let totalUnread = 0;
          for (const thread of parentThreads) {
            const parentParticipant = thread.message_participants?.find(
              (p: any) => p.user_id === parentId && p.role === 'parent'
            );
            
            if (parentParticipant) {
              const { count } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('thread_id', thread.id)
                .neq('sender_id', parentId)
                .gt('created_at', parentParticipant.last_read_at || '2000-01-01');
              
              totalUnread += count || 0;
            }
          }
          
          return { parentId, count: totalUnread };
        })
      );
      
      // Group students by parent
      const parentsMap = new Map<string, Parent>();
      
      profiles?.forEach((profile: any) => {
        const studentList = students.filter((s: any) => s.parent_id === profile.id);
        const unreadData = unreadCounts.find(u => u.parentId === profile.id);
        
        parentsMap.set(profile.id, {
          id: profile.id,
          email: profile.email || '',
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          phone: profile.phone,
          students: studentList,
          unread_count: unreadData?.count || 0,
        });
      });
      
      const finalParents = Array.from(parentsMap.values()).sort((a, b) => 
        `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
      );
      
      console.log('Final parents array to display:', finalParents);
      setParents(finalParents);
    } catch (err: any) {
      console.error('Error fetching parents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMessageParent = async (parent: Parent, student: Student) => {
    if (!teacherId) return;
    
    try {
      // Check if thread exists - get all threads for this student and filter client-side
      const { data: allThreads } = await supabase
        .from('message_threads')
        .select(`
          id,
          message_participants!inner(user_id, role)
        `)
        .eq('preschool_id', preschoolId)
        .eq('student_id', student.id)
        .eq('type', 'parent-teacher');
      
      let threadId: string | null = null;
      
      if (allThreads && allThreads.length > 0) {
        // Find thread where both parent and teacher are participants
        const matchingThread = allThreads.find((thread: any) => {
          const participants = thread.message_participants || [];
          const hasParent = participants.some((p: any) => p.user_id === parent.id && p.role === 'parent');
          const hasTeacher = participants.some((p: any) => p.user_id === teacherId && p.role === 'teacher');
          return hasParent && hasTeacher;
        });
        
        if (matchingThread) {
          threadId = matchingThread.id;
        }
      }
      
      // Create new thread if none exists
      if (!threadId) {
        const { data: newThread, error: threadError } = await supabase
          .from('message_threads')
          .insert({
            preschool_id: preschoolId,
            type: 'parent-teacher',
            subject: `Regarding ${student.first_name} ${student.last_name}`,
            student_id: student.id,
            created_by: teacherId,
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (threadError) throw threadError;
        threadId = newThread.id;
        
        // Add participants
        await supabase.from('message_participants').insert([
          {
            thread_id: threadId,
            user_id: teacherId,
            role: 'teacher',
            last_read_at: new Date().toISOString(),
          },
          {
            thread_id: threadId,
            user_id: parent.id,
            role: 'parent',
            last_read_at: new Date().toISOString(),
          },
        ]);
      }
      
      // Navigate to thread
      router.push(`/dashboard/teacher/messages/${threadId}`);
    } catch (err: any) {
      console.error('Error creating/finding thread:', err);
      alert('Failed to open message thread. Please try again.');
    }
  };

  const filteredParents = parents.filter(parent => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const parentName = `${parent.first_name} ${parent.last_name}`.toLowerCase();
    const studentNames = parent.students.map((s: any) => 
      `${s.first_name} ${s.last_name}`.toLowerCase()
    ).join(' ');
    const email = parent.email.toLowerCase();
    
    return parentName.includes(query) || 
           studentNames.includes(query) || 
           email.includes(query);
  });

  if (loading) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Users size={24} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Parent Contacts</h3>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Users size={24} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Parent Contacts</h3>
        </div>
        <p style={{ color: 'var(--danger)', textAlign: 'center', padding: '20px 0' }}>
          Failed to load parent contacts
        </p>
        <button 
          className="btn btnSecondary" 
          style={{ width: '100%' }}
          onClick={fetchParents}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Users size={24} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Parent Contacts</h3>
        </div>
        <span style={{ 
          background: 'var(--primary-subtle)', 
          color: 'var(--primary)', 
          padding: '4px 12px', 
          borderRadius: 12, 
          fontSize: 14,
          fontWeight: 600 
        }}>
          {filteredParents.length}
        </span>
      </div>
      
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search parents or students..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px 10px 40px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <Search 
          size={18} 
          color="var(--muted)" 
          style={{ 
            position: 'absolute', 
            left: 12, 
            top: '50%', 
            transform: 'translateY(-50%)' 
          }} 
        />
      </div>
      
      {filteredParents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Users size={48} color="var(--muted)" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>
            {searchQuery ? 'No matching parents found' : 'No parent contacts yet'}
          </p>
          {!searchQuery && !classIds && (
            <p style={{ color: 'var(--muted-light)', fontSize: 12 }}>
              Students need to be assigned to classes to appear here
            </p>
          )}
        </div>
      ) : (
        <div style={{ 
          maxHeight: 500, 
          overflowY: 'auto',
          marginTop: 8,
        }}>
          {filteredParents.map((parent) => (
            <div
              key={parent.id}
              style={{
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--border)',
                marginBottom: 12,
                background: 'var(--surface-1)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-2)';
                e.currentTarget.style.borderColor = 'var(--primary-subtle)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface-1)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              {/* Parent Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  background: 'var(--primary-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <User size={20} color="var(--primary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <h4 style={{ 
                      margin: 0, 
                      fontSize: 15, 
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {parent.first_name} {parent.last_name}
                    </h4>
                    {parent.unread_count > 0 && (
                      <span style={{
                        background: 'var(--danger)',
                        color: 'white',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 10,
                        minWidth: 18,
                        textAlign: 'center',
                      }}>
                        {parent.unread_count > 9 ? '9+' : parent.unread_count}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={12} />
                      {parent.email}
                    </span>
                    {parent.phone && (
                      <span style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={12} />
                        {parent.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Students */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
                  Children ({parent.students.length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {parent.students.map((student) => (
                    <span
                      key={student.id}
                      style={{
                        fontSize: 12,
                        padding: '4px 10px',
                        borderRadius: 12,
                        background: 'var(--primary-subtle)',
                        color: 'var(--primary)',
                        fontWeight: 500,
                      }}
                    >
                      {student.first_name} {student.last_name}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                {parent.students.map((student) => (
                  <button
                    key={student.id}
                    className="btn btnSecondary"
                    style={{ 
                      fontSize: 13, 
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onClick={() => handleMessageParent(parent, student)}
                  >
                    <MessageCircle size={14} />
                    <span style={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {student.first_name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
