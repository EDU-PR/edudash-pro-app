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
}

const ThreadItem = ({ thread, isActive, onSelect }: ThreadItemProps) => {
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
      <div className="flex items-center justify-center min-h-screen">
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
          {/* Sidebar - Always visible on desktop, toggleable on mobile */}
          <div
            style={{
              width: isDesktop ? '320px' : '100%',
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
            }}
          >
          {/* Sidebar Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          }}>
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
          </div>

          {/* Threads List */}
          <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {threadsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <div className="spinner"></div>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '32px' }}>
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
              </div>
            ) : filteredThreads.length > 0 ? (
              filteredThreads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === selectedThreadId}
                  onSelect={() => setSelectedThreadId(thread.id)}
                />
              ))
            ) : (
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
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          position: 'relative',
          marginLeft: isDesktop ? '0' : '0',
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
            /* Chat View */
            <>
              {/* Chat Header */}
              <div style={{
                padding: isDesktop ? '20px 28px' : '16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
              }}>
                {!isDesktop && (
                  <button
                    onClick={() => setSelectedThreadId(null)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'var(--surface-2)',
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
                <div
                  style={{
                    width: isDesktop ? '52px' : '44px',
                    height: isDesktop ? '52px' : '44px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--cyan) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: isDesktop ? '18px' : '16px',
                    fontWeight: '700',
                    boxShadow: '0 4px 16px rgba(124, 58, 237, 0.3)',
                    flexShrink: 0,
                  }}
                >
                  {parentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: isDesktop ? '18px' : '16px',
                    fontWeight: '700',
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {parentName}
                  </h3>
                  {selectedThread.student && (
                    <p style={{
                      margin: '4px 0 0',
                      fontSize: '13px',
                      color: 'var(--cyan)',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <span>📚</span>
                      <span>{selectedThread.student.first_name} {selectedThread.student.last_name}</span>
                    </p>
                  )}
                </div>
                {isDesktop && (
                  <button
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--muted)',
                    }}
                  >
                    <MoreVertical size={20} />
                  </button>
                )}
              </div>

              {/* Messages Area */}
              <div
                className="hide-scrollbar"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: isDesktop ? '24px 28px' : '16px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {messagesLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    <div className="spinner"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                  }}>
                    <div style={{
                      textAlign: 'center',
                      padding: '40px 32px',
                      borderRadius: '16px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                      maxWidth: '320px',
                    }}>
                      <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(0, 245, 255, 0.15) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                      }}>
                        <Send size={32} color="var(--primary)" />
                      </div>
                      <p style={{ color: 'var(--text)', fontSize: '17px', fontWeight: '600', marginBottom: '8px' }}>
                        Start a conversation
                      </p>
                      <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.5' }}>
                        Send your first message to connect with this parent
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => {
                      const isOwn = message.sender_id === userId;
                      const senderName = message.sender
                        ? `${message.sender.first_name} ${message.sender.last_name}`
                        : 'Unknown';
                      const otherParticipantIds = selectedParticipants
                        .filter((p: any) => p.user_id !== userId)
                        .map((p: any) => p.user_id);

                      return (
                        <ChatMessageBubble
                          key={message.id}
                          message={message}
                          isOwn={isOwn}
                          isDesktop={isDesktop}
                          formattedTime={formatMessageTime(message.created_at)}
                          senderName={!isOwn ? senderName : undefined}
                          otherParticipantIds={otherParticipantIds}
                        />
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Composer */}
              <div style={{
                padding: isDesktop ? '16px 28px 20px' : '12px 16px 16px',
                background: 'var(--surface)',
                borderTop: '1px solid var(--border)',
                boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
              }}>
                <input
                  type="file"
                  accept="image/*,audio/*,video/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleAttachmentChange}
                />
                <form onSubmit={handleSendMessage} style={{ position: 'relative' }}>
                  {showEmojiPicker && (
                    <div
                      ref={emojiPickerRef}
                      style={{
                        position: 'absolute',
                        bottom: '70px',
                        left: '12px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '16px',
                        padding: '12px',
                        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.2)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: '8px',
                        zIndex: 20,
                      }}
                    >
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleEmojiSelect(emoji)}
                          style={{
                            fontSize: '22px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '8px',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    {isDesktop && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          ref={emojiButtonRef}
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--muted)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Smile size={22} />
                        </button>
                        <button
                          type="button"
                          onClick={triggerFilePicker}
                          disabled={attachmentUploading}
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: attachmentUploading ? 'not-allowed' : 'pointer',
                            color: 'var(--muted)',
                            transition: 'all 0.2s ease',
                            opacity: attachmentUploading ? 0.5 : 1,
                          }}
                        >
                          <Paperclip size={20} />
                        </button>
                      </div>
                    )}

                    {!isDesktop && (
                      <button
                        type="button"
                        ref={emojiButtonRef}
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'var(--muted)',
                          flexShrink: 0,
                        }}
                      >
                        <Smile size={20} />
                      </button>
                    )}

                    <div style={{ position: 'relative', flex: 1 }}>
                      {!isDesktop && !messageText.trim() && (
                        <button
                          type="button"
                          onClick={triggerFilePicker}
                          disabled={attachmentUploading}
                          style={{
                            position: 'absolute',
                            left: '14px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            cursor: attachmentUploading ? 'not-allowed' : 'pointer',
                            color: 'var(--muted)',
                            zIndex: 1,
                            opacity: attachmentUploading ? 0.5 : 1,
                          }}
                        >
                          <Paperclip size={18} />
                        </button>
                      )}
                      <textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type a message..."
                        disabled={sending || attachmentUploading}
                        rows={1}
                        style={{
                          width: '100%',
                          padding: isDesktop ? '14px 20px' : (messageText.trim() ? '14px 54px 14px 20px' : '14px 54px 14px 48px'),
                          borderRadius: '14px',
                          border: '1px solid var(--border)',
                          background: 'var(--bg)',
                          color: 'var(--text)',
                          fontSize: '15px',
                          outline: 'none',
                          resize: 'none',
                          maxHeight: '120px',
                          fontFamily: 'inherit',
                          transition: 'border-color 0.2s ease',
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                          }
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                      />

                      {!isDesktop && (
                        <div style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                        }}>
                          {messageText.trim() ? (
                            <button
                              type="submit"
                              disabled={sending || attachmentUploading}
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                background: (sending || attachmentUploading) ? 'var(--muted)' : 'var(--primary)',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: (sending || attachmentUploading) ? 'not-allowed' : 'pointer',
                                boxShadow: (sending || attachmentUploading) ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.4)',
                              }}
                            >
                              {sending || attachmentUploading ? (
                                <Loader2 size={18} className="animate-spin" color="white" />
                              ) : (
                                <Send size={18} color="white" />
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleMicClick}
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                background: isRecording ? 'var(--warning)' : 'var(--cyan)',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: `0 4px 12px ${isRecording ? 'rgba(245, 158, 11, 0.4)' : 'rgba(0, 245, 255, 0.4)'}`,
                              }}
                            >
                              <Mic size={20} color="white" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {isDesktop && (
                      messageText.trim() ? (
                        <button
                          type="submit"
                          disabled={sending || attachmentUploading}
                          style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '14px',
                            background: (sending || attachmentUploading) ? 'var(--muted)' : 'var(--primary)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: (sending || attachmentUploading) ? 'not-allowed' : 'pointer',
                            boxShadow: (sending || attachmentUploading) ? 'none' : '0 4px 16px rgba(124, 58, 237, 0.4)',
                            flexShrink: 0,
                          }}
                        >
                          {sending || attachmentUploading ? (
                            <Loader2 size={20} className="animate-spin" color="white" />
                          ) : (
                            <Send size={20} color="white" />
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleMicClick}
                          style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '14px',
                            background: isRecording ? 'var(--warning)' : 'var(--cyan)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: `0 4px 16px ${isRecording ? 'rgba(245, 158, 11, 0.4)' : 'rgba(0, 245, 255, 0.4)'}`,
                            flexShrink: 0,
                          }}
                        >
                          <Mic size={22} color="white" />
                        </button>
                      )
                    )}
                  </div>
                </form>
                {statusMessage && (
                  <p style={{ marginTop: '10px', fontSize: '13px', color: 'var(--danger)', textAlign: 'center' }}>
                    {statusMessage}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </TeacherShell>
    </>
  );
}
