'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { ArrowLeft, Send, User, Loader2, Mic, Paperclip, MessageCircle, Search, Smile } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { ChatMessageBubble, type ChatMessage } from '@/components/messaging/ChatMessageBubble';
import { useComposerEnhancements, EMOJI_OPTIONS } from '@/lib/messaging/useComposerEnhancements';

interface MessageThread {
  id: string;
  type: string;
  subject: string;
  student_id?: string | null;
  last_message_at?: string;
  student?: {
    first_name: string;
    last_name: string;
  };
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
  participants?: Array<{
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

const CONTACT_PANEL_WIDTH = 296;

const formatMessageTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
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

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '10px 12px',
        marginBottom: 6,
        borderRadius: 10,
        cursor: 'pointer',
        background: isActive ? 'var(--primary-subtle)' : 'transparent',
        border: isActive ? '1px solid var(--primary-subtle)' : '1px solid transparent',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        transition: 'background 0.2s ease, border 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#fff',
        }}
      >
        <User size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: hasUnread ? 700 : 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {parentName}
          </span>
          {thread.last_message?.created_at && (
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
              {formatMessageTime(thread.last_message.created_at)}
            </span>
          )}
        </div>
        {studentName && (
          <p
            style={{
              margin: '2px 0',
              fontSize: 11,
              color: 'var(--primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            RE: {studentName}
          </p>
        )}
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: hasUnread ? 'var(--text-primary)' : 'var(--muted)',
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
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
          }}
        >
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>
            {thread.unread_count && thread.unread_count > 9 ? '9+' : thread.unread_count}
          </span>
        </div>
      )}
    </div>
  );
};

export default function TeacherMessageThreadPage() {
  const router = useRouter();
  const params = useParams();
  const threadIdParam = params?.threadId as string | undefined;
  useBodyScrollLock(true);
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  
  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(threadIdParam ?? null);
  const [fallbackThread, setFallbackThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    setSelectedThreadId(threadIdParam ?? null);
  }, [threadIdParam]);

  const fetchThreadDetails = useCallback(async (targetId?: string) => {
    if (!targetId) return;
    try {
      const { data, error } = await supabase
        .from('message_threads')
        .select(`
          id,
          type,
          subject,
          student_id,
          last_message_at,
          student:students(first_name, last_name),
          message_participants:message_participants(
            user_id,
            role,
            last_read_at,
            user_profile:profiles(first_name, last_name, role)
          )
        `)
        .eq('id', targetId)
        .single();

      if (error) throw error;
      setFallbackThread((data as unknown as MessageThread) || null);
    } catch (err) {
      console.error('Error fetching thread details:', err);
    }
  }, [supabase]);

  useEffect(() => {
    if (threadIdParam) {
      setFallbackThread(null);
      fetchThreadDetails(threadIdParam);
    }
  }, [threadIdParam, fetchThreadDetails]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Detect desktop for glowing shadows
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  const fetchThreads = useCallback(async () => {
    if (!userId || !profile?.preschoolId) return;

    setThreadsLoading(true);
    setError(null);

    try {
      const { data: threadRows, error: threadsError } = await supabase
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

      const teacherThreads = (threadRows || []).filter((thread: any) =>
        thread.message_participants?.some((participant: any) => participant.user_id === userId && participant.role === 'teacher')
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

          const teacherParticipant = thread.message_participants?.find((p: any) => p.user_id === userId && p.role === 'teacher');

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
          } as MessageThread;
        })
      );

      setThreads(threadsWithDetails);

      if (threadsWithDetails.length > 0) {
        const stillSelected = threadsWithDetails.some((thread) => thread.id === (threadIdParam ?? selectedThreadId));
        if (!selectedThreadId || !stillSelected) {
          setSelectedThreadId(threadIdParam ?? threadsWithDetails[0].id);
        }
      }
    } catch (err: any) {
      console.error('Error fetching threads:', err);
      setError(err.message);
    } finally {
      setThreadsLoading(false);
    }
  }, [profile?.preschoolId, selectedThreadId, supabase, threadIdParam, userId]);

  useEffect(() => {
    if (userId && profile?.preschoolId) {
      fetchThreads();
    }
  }, [userId, profile?.preschoolId, fetchThreads]);

  const markThreadAsRead = useCallback(async (currentThreadId: string) => {
    if (!userId) return;
    try {
      await supabase
        .from('message_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('thread_id', currentThreadId)
        .eq('user_id', userId);
    } catch (err) {
      console.error('Error marking thread as read:', err);
    }
  }, [supabase, userId]);

  const fetchMessages = useCallback(async (currentThreadId: string) => {
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
          sender:profiles(first_name, last_name, role)
        `)
        .eq('thread_id', currentThreadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      await markThreadAsRead(currentThreadId);
      setTimeout(() => scrollToBottom(), 80);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  }, [markThreadAsRead, supabase]);

  const refreshConversation = useCallback(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId);
    }
    fetchThreads();
  }, [fetchMessages, fetchThreads, selectedThreadId]);

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
    onRefresh: refreshConversation,
    onEmojiInsert: (emoji) => setMessageText((prev) => `${prev}${emoji}`),
  });

  useEffect(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId);
    }
  }, [selectedThreadId, fetchMessages]);

  useEffect(() => {
    if (!selectedThreadId) return;

    const channel = supabase
      .channel(`teacher-thread-${selectedThreadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${selectedThreadId}`,
        },
        () => fetchMessages(selectedThreadId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedThreadId, supabase, fetchMessages]);

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
      fetchMessages(selectedThreadId);
      fetchThreads();
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
    const lastMessage = thread.last_message?.content?.toLowerCase() || '';

    return (
      participantName.includes(query) ||
      studentName.includes(query) ||
      lastMessage.includes(query) ||
      thread.subject.toLowerCase().includes(query)
    );
  });

  const totalUnread = threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);
  const currentThread = selectedThreadId
    ? threads.find((thread) => thread.id === selectedThreadId) || fallbackThread
    : fallbackThread;
  const currentParticipants = currentThread?.message_participants || currentThread?.participants || [];
  const parentParticipant = currentParticipants.find((p: any) => p.role === 'parent');
  const parentName = parentParticipant?.user_profile
    ? `${parentParticipant.user_profile.first_name} ${parentParticipant.user_profile.last_name}`.trim()
    : 'Parent';
  const currentStudentName = currentThread?.student
    ? `${currentThread.student.first_name} ${currentThread.student.last_name}`
    : null;

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    router.replace(`/dashboard/teacher/messages/${threadId}`);
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <TeacherShell
      tenantSlug={tenantSlug}
      userEmail={profile?.email}
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName}
      preschoolId={profile?.preschoolId}
      userId={userId}
      unreadCount={totalUnread}
      contentStyle={{ padding: 0, overflow: 'hidden' }}
    >
      <div
        style={{
          display: 'flex',
          height: 'calc(100vh - var(--topnav-h))',
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {currentThread ? (
            <>
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface-1)',
                  flexShrink: 0,
                }}
              >
                {!isDesktop && (
                  <button
                    onClick={() => router.push('/dashboard/teacher/messages')}
                    className="btn btnSecondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    <ArrowLeft size={16} />
                    Back to inbox
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    <User size={28} color="white" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{parentName}</h2>
                    {currentStudentName && (
                      <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>
                        📚 About: {currentStudentName}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="hide-scrollbar"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '24px 20px',
                  paddingRight: isDesktop ? CONTACT_PANEL_WIDTH + 24 : 20,
                  paddingBottom: 120,
                  background: 'var(--background)',
                  backgroundImage:
                    'radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.03) 0%, transparent 50%)',
                }}
              >
                {messagesLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                    <div className="spinner"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      minHeight: 300,
                      padding: 40,
                    }}
                  >
                    <div
                      style={{
                        padding: '32px 24px',
                        borderRadius: 16,
                        background: 'var(--surface-2)',
                        border: '2px dashed var(--border)',
                      }}
                    >
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          margin: '0 auto 16px',
                          borderRadius: 32,
                          background: 'linear-gradient(135deg, var(--primary-subtle) 0%, rgba(139, 92, 246, 0.1) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Send size={28} color="var(--primary)" />
                      </div>
                      <p style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: 16, fontWeight: 600 }}>No messages yet</p>
                      <p style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 280, lineHeight: 1.5 }}>
                        Start the conversation below to reach this parent.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {messages.map((message) => {
                      const isOwn = message.sender_id === userId;
                      const senderName = message.sender
                        ? `${message.sender.first_name} ${message.sender.last_name}`
                        : 'Unknown';

                      return (
                        <ChatMessageBubble
                          key={message.id}
                          message={message}
                          isOwn={isOwn}
                          isDesktop={isDesktop}
                          formattedTime={formatMessageTime(message.created_at)}
                          senderName={!isOwn ? senderName : undefined}
                        />
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: isDesktop ? CONTACT_PANEL_WIDTH : 0,
                  padding: '12px 16px',
                  background: 'var(--background)',
                  borderTop: '1px solid var(--border)',
                  boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.2)',
                  zIndex: 10,
                }}
              >
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
                        bottom: 70,
                        left: 12,
                        background: 'var(--surface-2)',
                        borderRadius: 12,
                        padding: 8,
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: 6,
                        zIndex: 20,
                      }}
                    >
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleEmojiSelect(emoji)}
                          style={{
                            fontSize: 20,
                            lineHeight: 1,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: 900, margin: '0 auto' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        ref={emojiButtonRef}
                        onClick={() => setShowEmojiPicker((prev) => !prev)}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          background: 'transparent',
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
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'var(--muted)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <Paperclip size={18} />
                      </button>
                    </div>

                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message..."
                      disabled={sending || attachmentUploading}
                      rows={1}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        borderRadius: 24,
                        border: '1px solid var(--border)',
                        background: 'var(--surface-1)',
                        color: 'var(--text-primary)',
                        fontSize: 15,
                        outline: 'none',
                        resize: 'none',
                        maxHeight: 120,
                        fontFamily: 'inherit',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />

                    {messageText.trim() ? (
                      <button
                        type="submit"
                        disabled={sending || attachmentUploading}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          background:
                            sending || attachmentUploading
                              ? 'var(--muted)'
                              : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: sending || attachmentUploading ? 'not-allowed' : 'pointer',
                          boxShadow:
                            sending || attachmentUploading ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.3)',
                          transition: 'all 0.2s ease',
                          flexShrink: 0,
                        }}
                      >
                        {sending || attachmentUploading ? (
                          <Loader2 size={20} className="animate-spin" color="#fff" />
                        ) : (
                          <Send size={20} color="#fff" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleMicClick}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          background: isRecording ? '#D97706' : '#25D366',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        }}
                      >
                        <Mic size={22} color="white" />
                      </button>
                    )}
                  </div>
                </form>
                {statusMessage && (
                  <p style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>{statusMessage}</p>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <div style={{ textAlign: 'center', padding: 40 }}>
                <MessageCircle size={64} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Select a conversation</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>Choose a parent from the list to start messaging</p>
              </div>
            </div>
          )}
        </div>

        {isDesktop && (
          <div
            style={{
              position: 'fixed',
              right: 0,
              top: 'var(--topnav-h)',
              bottom: 0,
              width: 280,
              paddingRight: 16,
              borderLeft: '1px solid var(--border)',
              background: 'var(--surface-1)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 20,
            }}
          >
            <div style={{ padding: '16px 12px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                Conversations {totalUnread > 0 && `• ${totalUnread}`}
              </h3>
              <div style={{ position: 'relative', marginTop: 10 }}>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <Search
                  size={14}
                  color="var(--muted)"
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
              {threadsLoading ? (
                <div style={{ textAlign: 'center', padding: 30 }}>
                  <div className="spinner" style={{ margin: '0 auto' }}></div>
                </div>
              ) : error ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>Failed to load messages</p>
                  <button className="btn btnSecondary" onClick={fetchThreads}>
                    Try Again
                  </button>
                </div>
              ) : filteredThreads.length > 0 ? (
                filteredThreads.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === selectedThreadId}
                    onSelect={() => handleSelectThread(thread.id)}
                  />
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: 30 }}>
                  <MessageCircle size={40} color="var(--muted)" style={{ margin: '0 auto 10px' }} />
                  <p style={{ color: 'var(--muted)', fontSize: 13 }}>No conversations yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TeacherShell>
  );
}
