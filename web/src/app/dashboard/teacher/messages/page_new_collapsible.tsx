'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { MessageCircle, Search, Send, Smile, Paperclip, Mic, Loader2, ArrowLeft, MoreVertical } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { ChatMessageBubble, type ChatMessage } from '@/components/messaging/ChatMessageBubble';
import { useComposerEnhancements, EMOJI_OPTIONS } from '@/lib/messaging/useComposerEnhancements';

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
  message_participants?: Array<{
    user_id: string;
    role: string;
    last_read_at?: string;
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
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffInHours < 168) return messageTime.toLocaleDateString([], { weekday: 'short' });
  return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

interface ThreadItemProps {
  thread: MessageThread;
  isActive: boolean;
  onSelect: () => void;
  collapsed: boolean;
}

const ThreadItem = ({ thread, isActive, onSelect, collapsed }: ThreadItemProps) => {
  const participants = thread.message_participants || thread.participants || [];
  const parentParticipant = participants.find((p) => p.role === 'parent');
  const parentName = parentParticipant?.user_profile
    ? `${parentParticipant.user_profile.first_name} ${parentParticipant.user_profile.last_name}`.trim()
    : 'Parent';
  const studentName = thread.student
    ? `${thread.student.first_name} ${thread.student.last_name}`
    : null;
  const hasUnread = (thread.unread_count || 0) > 0;
  
  const getInitials = (name: string) => {
    if (!name || name.trim() === '') return '?';
    const parts = name.trim().split(' ').filter(part => part.length > 0);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0]?.[0]?.toUpperCase() || '?';
  };

  if (collapsed) {
    return (
      <div
        onClick={onSelect}
        style={{
          padding: '10px',
          marginBottom: '8px',
          borderRadius: '12px',
          cursor: 'pointer',
          background: isActive ? 'var(--surface-2)' : 'transparent',
          border: `1px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transition: 'all 0.2s ease',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = 'var(--surface)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = 'transparent';
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: isActive ? 'var(--primary)' : 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: isActive ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none',
          }}
        >
          {getInitials(parentName)}
        </div>
        {hasUnread && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--primary)',
              boxShadow: '0 0 0 2px var(--surface)',
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px',
        marginBottom: '8px',
        borderRadius: '12px',
        cursor: 'pointer',
        background: isActive ? 'var(--surface-2)' : 'transparent',
        border: `1px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        transition: 'all 0.2s ease',
        boxShadow: isActive ? '0 2px 12px rgba(124, 58, 237, 0.15)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--surface)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: isActive ? 'var(--primary)' : 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '14px',
          fontWeight: '600',
          flexShrink: 0,
          boxShadow: isActive ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none',
        }}
      >
        {getInitials(parentName)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span
            style={{
              fontSize: '14px',
              fontWeight: hasUnread ? '700' : '600',
              color: hasUnread ? 'var(--text)' : 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {parentName}
          </span>
          {thread.last_message?.created_at && (
            <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '8px', flexShrink: 0 }}>
              {formatMessageTime(thread.last_message.created_at)}
            </span>
          )}
        </div>
        {studentName && (
          <p
            style={{
              margin: '0 0 4px 0',
              fontSize: '12px',
              color: 'var(--cyan)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: '500',
            }}
          >
            📚 {studentName}
          </p>
        )}
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: hasUnread ? 'var(--text)' : 'var(--muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {thread.last_message?.content || 'No messages yet'}
        </p>
      </div>
      {hasUnread && (
        <div
          style={{
            minWidth: '22px',
            height: '22px',
            borderRadius: '11px',
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 7px',
            boxShadow: '0 2px 8px rgba(124, 58, 237, 0.4)',
            flexShrink: 0,
          }}
        >
          <span style={{ color: 'white', fontSize: '11px', fontWeight: '700' }}>
            {thread.unread_count && thread.unread_count > 9 ? '9+' : thread.unread_count}
          </span>
        </div>
      )}
    </div>
  );
};

export default function TeacherMessagesPage() {
  const router = useRouter();
  useBodyScrollLock(true);
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const selectedThreadIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const {
    emojiButtonRef,
    emojiPickerRef,
    showEmojiPicker,
    setShowEmojiPicker,
    handleEmojiSelect,
    triggerFilePicker,
    fileInputRef,
    handleAttachmentChange,
    attachmentUploading,
    isRecording,
    handleMicClick,
    statusMessage,
  } = useComposerEnhancements({
    supabase,
    threadId: selectedThreadId,
    userId,
    onRefresh: () => setRefreshTrigger(prev => prev + 1),
    onEmojiInsert: (emoji) => setMessageText((prev) => `${prev}${emoji}`),
  });

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
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const markThreadAsRead = useCallback(async (threadId: string) => {
    if (!userId) return;
    try {
      await supabase.rpc('mark_thread_messages_as_read', {
        thread_id: threadId,
        reader_id: userId,
      });
    } catch (err) {
      console.error('Error marking thread as read:', err);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (selectedThreadId && userId) {
      const markAndRefresh = async () => {
        await markThreadAsRead(selectedThreadId);
        setTimeout(() => setRefreshTrigger(prev => prev + 1), 300);
      };
      setTimeout(markAndRefresh, 500);
    }
  }, [selectedThreadId, userId, markThreadAsRead]);

  const fetchMessages = useCallback(async (threadId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          thread_id,
          sender_id,
          content,
          created_at,
          read_by,
          sender:profiles(first_name, last_name, role)
        `)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      await markThreadAsRead(threadId);
      setTimeout(() => scrollToBottom(), 80);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  }, [markThreadAsRead, supabase]);

  const fetchThreads = useCallback(async () => {
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
      
      const teacherThreads = (threads || []).filter((thread: any) => 
        thread.message_participants?.some((p: any) => 
          p.user_id === userId && p.role === 'teacher'
        )
      );
      
      const threadsWithDetails = await Promise.all(
        teacherThreads.map(async (thread: any) => {
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('thread_id', thread.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
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
      if (selectedThreadId) {
        const stillSelected = threadsWithDetails.some((t) => t.id === selectedThreadId);
        if (!stillSelected) setSelectedThreadId(null);
      }
    } catch (err: any) {
      console.error('Error fetching threads:', err);
      setError(err.message);
    } finally {
      setThreadsLoading(false);
    }
  }, [profile?.preschoolId, selectedThreadId, supabase, userId]);

  useEffect(() => {
    if (userId && profile?.preschoolId) {
      fetchThreads();
    }
  }, [userId, profile?.preschoolId, fetchThreads, refreshTrigger]);

  useEffect(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId);
    }
  }, [selectedThreadId, fetchMessages]);

  useEffect(() => {
    if (!selectedThreadId) return;

    const channel = supabase
      .channel(`teacher-messages:${selectedThreadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${selectedThreadId}`,
        },
        () => {
          fetchMessages(selectedThreadId);
          fetchThreads();
          setTimeout(() => scrollToBottom(), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedThreadId, supabase, fetchMessages, fetchThreads]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        (event.key.toLowerCase() === 'x' || event.key === 'Escape') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        if (selectedThreadIdRef.current) {
          setSelectedThreadId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (authLoading || profileLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedThreadId || !userId) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          thread_id: selectedThreadId,
          sender_id: userId,
          content: messageText.trim(),
          content_type: 'text',
        });

      if (error) throw error;

      await supabase
        .from('message_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedThreadId);

      setMessageText('');
      setRefreshTrigger(prev => prev + 1);
      setTimeout(() => scrollToBottom(), 100);
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const filteredThreads = threads.filter((thread) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const participants = thread.message_participants || thread.participants || [];
    const participant = participants.find((p: any) => p.role === 'parent');
    const participantName = participant?.user_profile
      ? `${participant.user_profile.first_name} ${participant.user_profile.last_name}`.toLowerCase()
      : '';
    const studentName = thread.student
      ? `${thread.student.first_name} ${thread.student.last_name}`.toLowerCase()
      : '';
    const lastMessage = thread.last_message?.content.toLowerCase() || '';

    return (
      participantName.includes(query) ||
      studentName.includes(query) ||
      lastMessage.includes(query) ||
      thread.subject.toLowerCase().includes(query)
    );
  });

  const totalUnread = threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId);
  const selectedParticipants = selectedThread?.message_participants || selectedThread?.participants || [];
  const parentParticipant = selectedParticipants?.find((p: any) => p.role === 'parent');
  const parentName = parentParticipant?.user_profile
    ? `${parentParticipant.user_profile.first_name} ${parentParticipant.user_profile.last_name}`.trim()
    : 'Parent';

  const sidebarWidth = isDesktop ? (sidebarCollapsed ? '80px' : '320px') : '100%';

  return (
    <>
      <style jsx global>{`
        /* Hide the header on teacher messages page */
        body:has(.teacher-messages-page) .topbar,
        body:has(.teacher-messages-page) header.topbar {
          display: none !important;
        }
        .teacher-messages-page {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 999;
        }
      `}</style>
      <TeacherShell
        tenantSlug={tenantSlug}
        userEmail={profile?.email}
        userName={profile?.firstName}
        preschoolName={profile?.preschoolName}
        preschoolId={profile?.preschoolId}
        userId={userId}
        unreadCount={totalUnread}
        contentStyle={{ padding: 0, overflow: 'hidden', height: '100vh' }}
      >
        <div className="teacher-messages-page" style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', background: 'var(--bg)' }}>
          {/* Collapsible Sidebar */}
          <div
            onMouseEnter={() => isDesktop && setSidebarCollapsed(false)}
            onMouseLeave={() => isDesktop && setSidebarCollapsed(true)}
            style={{
              width: sidebarWidth,
              display: (!isDesktop && selectedThread) ? 'none' : 'flex',
              flexDirection: 'column',
              background: 'var(--surface)',
              borderRight: isDesktop ? '1px solid var(--border)' : 'none',
              boxShadow: isDesktop ? '2px 0 12px rgba(0, 0, 0, 0.1)' : 'none',
              position: isDesktop ? 'relative' : 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: isDesktop ? 1 : 1000,
              transition: 'width 0.3s ease',
            }}
          >
            {/* Sidebar Header */}
            <div style={{
              padding: sidebarCollapsed ? '16px 10px' : '16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-2)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            }}>
              {!sidebarCollapsed && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    {!isDesktop && (
                      <button
                        onClick={() => router.push('/dashboard/teacher')}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'var(--text)',
                        }}
                      >
                        <ArrowLeft size={20} />
                      </button>
                    )}
                    <h3 style={{
                      margin: 0,
                      fontSize: '18px',
                      fontWeight: '700',
                      color: 'var(--text)',
                      flex: 1,
                      textAlign: !isDesktop ? 'center' : 'left',
                    }}>
                      Messages
                    </h3>
                    {totalUnread > 0 && (
                      <span style={{
                        background: 'var(--primary)',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: '700',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
                      }}>
                        {totalUnread}
                      </span>
                    )}
                  </div>

                  {/* Search */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Search conversations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 38px',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                      }}
                    />
                    <Search
                      size={18}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--muted)',
                      }}
                    />
                  </div>
                </>
              )}
              {sidebarCollapsed && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <MessageCircle size={24} color="var(--primary)" />
                </div>
              )}
            </div>

            {/* Threads List */}
            <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: sidebarCollapsed ? '12px 8px' : '12px' }}>
              {threadsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <div className="spinner"></div>
                </div>
              ) : error ? (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  {!sidebarCollapsed && (
                    <>
                      <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '16px' }}>Failed to load</p>
                      <button
                        onClick={fetchThreads}
                        style={{
                          background: 'var(--primary)',
                          border: 'none',
                          color: 'white',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                        }}
                      >
                        Try Again
                      </button>
                    </>
                  )}
                </div>
              ) : filteredThreads.length > 0 ? (
                filteredThreads.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === selectedThreadId}
                    onSelect={() => setSelectedThreadId(thread.id)}
                    collapsed={sidebarCollapsed}
                  />
                ))
              ) : (
                !sidebarCollapsed && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '60px 20px',
                    textAlign: 'center',
                  }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'var(--surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px',
                    }}>
                      <MessageCircle size={32} color="var(--muted)" />
                    </div>
                    <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>
                      No conversations yet
                    </p>
                    <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
                      Your messages will appear here
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Main Chat Area - Takes full remaining space */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg)',
            position: 'relative',
            minWidth: 0,
          }}>
            {!selectedThread ? (
              /* Empty State */
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '40px',
              }}>
                <div style={{
                  maxWidth: '400px',
                  textAlign: 'center',
                  padding: '48px 32px',
                  borderRadius: '20px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                }}>
                  <div style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--cyan) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    boxShadow: '0 8px 24px rgba(124, 58, 237, 0.25)',
                  }}>
                    <MessageCircle size={48} color="white" />
                  </div>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: 'var(--text)',
                    marginBottom: '12px',
                  }}>
                    Select a conversation
                  </h2>
                  <p style={{
                    color: 'var(--muted)',
                    fontSize: '15px',
                    lineHeight: '1.6',
                  }}>
                    Choose a conversation from the sidebar to start messaging with parents
                  </p>
                </div>
              </div>
            ) : (
              /* Chat View - Content continues in next message due to length */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Placeholder - the rest will be in the full implementation */}
              </div>
            )}
          </div>
        </div>
      </TeacherShell>
    </>
  );
}
