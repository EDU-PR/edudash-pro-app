'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { MessageCircle, Plus, User, School, ChevronRight, Search } from 'lucide-react';

interface MessageThread {
  id: string;
  type: string;
  subject: string;
  student_id: string | null;
  last_message_at: string;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  participants?: Array<{
    user_id: string;
    role: string;
    user_profile?: {
      first_name: string;
      last_name: string;
      role: string;
    };
  }>;
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count?: number;
}

const formatMessageTime = (timestamp: string): string => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInHours = Math.abs(now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 168) {
    return messageTime.toLocaleDateString([], { weekday: 'short' });
  } else {
    return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

export default function TeacherMessagesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

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
    if (userId && profile?.preschoolId) {
      fetchThreads();
    }
  }, [userId, profile?.preschoolId]);

  const fetchThreads = async () => {
    if (!userId || !profile?.preschoolId) return;
    
    setThreadsLoading(true);
    setError(null);
    
    try {
      const { data: threads, error: threadsError } = await supabase
        .from('message_threads')
        .select(`
          id,
          type,
          subject,
          student_id,
          last_message_at,
          student:students(id, first_name, last_name),
          message_participants!inner(
            user_id,
            role,
            last_read_at,
            user_profile:profiles(first_name, last_name, role)
          )
        `)
        .eq('preschool_id', profile.preschoolId)
        .order('last_message_at', { ascending: false });
      
      if (threadsError) throw threadsError;
      
      // Filter threads where teacher is a participant
      const teacherThreads = (threads || []).filter((thread: any) => 
        thread.message_participants?.some((p: any) => 
          p.user_id === userId && p.role === 'teacher'
        )
      );
      
      // Get last message and unread count for each thread
      const threadsWithDetails = await Promise.all(
        teacherThreads.map(async (thread: any) => {
          // Get last message
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('thread_id', thread.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          // Get unread count
          const teacherParticipant = thread.message_participants?.find(
            (p: any) => p.user_id === userId && p.role === 'teacher'
          );
          
          let unreadCount = 0;
          if (teacherParticipant) {
            const { count } = await supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('thread_id', thread.id)
              .neq('sender_id', userId)
              .gt('created_at', teacherParticipant.last_read_at || '2000-01-01');
            
            unreadCount = count || 0;
          }
          
          return {
            ...thread,
            last_message: lastMessage,
            unread_count: unreadCount,
          };
        })
      );
      
      setThreads(threadsWithDetails);
    } catch (err: any) {
      console.error('Error fetching threads:', err);
      setError(err.message);
    } finally {
      setThreadsLoading(false);
    }
  };

  const filteredThreads = threads.filter(thread => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const participant = thread.participants?.find((p: any) => p.role === 'parent');
    const participantName = participant?.user_profile ? 
      `${participant.user_profile.first_name} ${participant.user_profile.last_name}`.toLowerCase() :
      '';
    const studentName = thread.student ? 
      `${thread.student.first_name} ${thread.student.last_name}`.toLowerCase() :
      '';
    const lastMessage = thread.last_message?.content.toLowerCase() || '';
    
    return participantName.includes(query) || 
           studentName.includes(query) || 
           lastMessage.includes(query) ||
           thread.subject.toLowerCase().includes(query);
  });

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const totalUnread = threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);

  return (
    <TeacherShell 
      tenantSlug={tenantSlug} 
      userEmail={profile?.email}
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName}
      preschoolId={profile?.preschoolId}
      userId={userId}
    >
      <div className="container">
        {/* Header */}
        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 className="h1">Messages</h1>
              <p className="muted">
                Communicate with parents {totalUnread > 0 && `• ${totalUnread} unread`}
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="section">
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px 12px 44px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                fontSize: 15,
                outline: 'none',
              }}
            />
            <Search 
              size={20} 
              color="var(--muted)" 
              style={{ 
                position: 'absolute', 
                left: 14, 
                top: '50%', 
                transform: 'translateY(-50%)' 
              }} 
            />
          </div>
        </div>

        {/* Messages List */}
        <div className="section">
          {threadsLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
          )}

          {error && (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ color: 'var(--danger)', marginBottom: 12 }}>Failed to load messages</p>
              <button className="btn btnSecondary" onClick={fetchThreads}>
                Try Again
              </button>
            </div>
          )}

          {!threadsLoading && !error && filteredThreads.length > 0 && (
            <div>
              {filteredThreads.map((thread) => {
                const parent = thread.participants?.find((p: any) => p.role === 'parent');
                const parentName = parent?.user_profile ? 
                  `${parent.user_profile.first_name} ${parent.user_profile.last_name}`.trim() :
                  'Parent';
                const studentName = thread.student ? 
                  `${thread.student.first_name} ${thread.student.last_name}` :
                  null;
                const hasUnread = (thread.unread_count || 0) > 0;
                
                return (
                  <div
                    key={thread.id}
                    onClick={() => router.push(`/dashboard/teacher/messages/${thread.id}`)}
                    className="card"
                    style={{
                      padding: 16,
                      marginBottom: 12,
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderLeft: hasUnread ? '4px solid var(--primary)' : 'none',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      background: 'var(--primary-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                      flexShrink: 0,
                    }}>
                      <User size={24} color="var(--primary)" />
                    </div>
                    
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{
                          fontSize: 16,
                          fontWeight: hasUnread ? 700 : 600,
                          color: 'var(--text-primary)',
                        }}>
                          {parentName}
                        </span>
                        {thread.last_message && (
                          <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                            {formatMessageTime(thread.last_message.created_at)}
                          </span>
                        )}
                      </div>
                      
                      {studentName && (
                        <div style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 4 }}>
                          RE: {studentName}
                        </div>
                      )}
                      
                      {thread.last_message ? (
                        <p style={{
                          fontSize: 14,
                          color: hasUnread ? 'var(--text-primary)' : 'var(--muted)',
                          fontWeight: hasUnread ? 500 : 400,
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {thread.last_message.content}
                        </p>
                      ) : (
                        <p style={{
                          fontSize: 14,
                          color: 'var(--muted)',
                          fontStyle: 'italic',
                          margin: 0,
                        }}>
                          No messages yet
                        </p>
                      )}
                    </div>
                    
                    {/* Right section */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 12 }}>
                      <ChevronRight size={16} color="var(--muted)" />
                      {hasUnread && (
                        <div style={{
                          background: 'var(--primary)',
                          borderRadius: 10,
                          minWidth: 20,
                          height: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 4,
                          padding: '0 6px',
                        }}>
                          <span style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>
                            {thread.unread_count && thread.unread_count > 9 ? '9+' : thread.unread_count}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!threadsLoading && !error && filteredThreads.length === 0 && (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <MessageCircle size={64} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                {searchQuery ? 'No matching conversations' : 'No Messages Yet'}
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
                {searchQuery 
                  ? 'Try a different search term' 
                  : 'Use the Parent Contacts widget below to start a conversation with parents.'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </TeacherShell>
  );
}
