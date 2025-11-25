'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { ArrowLeft, Send, User, Paperclip, Smile, Mic } from 'lucide-react';

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

interface ThreadDetails {
  id: string;
  subject: string;
  type: string;
  student?: {
    first_name: string;
    last_name: string;
  };
  message_participants?: Array<{
    user_id: string;
    role: string;
    profiles?: {
      first_name: string;
      last_name: string;
      role: string;
    };
  }>;
}

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

export default function ParentMessageThreadPage() {
  const router = useRouter();
  const params = useParams();
  const threadId = params?.threadId as string;
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  
  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  const [thread, setThread] = useState<ThreadDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
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
    if (userId && threadId) {
      fetchThreadDetails();
      fetchMessages();
      markThreadAsRead();
    }
  }, [userId, threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`messages:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          console.log('New message received:', payload);
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, supabase]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchThreadDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('message_threads')
        .select(`
          id,
          subject,
          type,
          student:students(first_name, last_name),
          message_participants!inner(
            user_id,
            role,
            profiles(first_name, last_name, role)
          )
        `)
        .eq('id', threadId)
        .single();
      
      if (error) throw error;
      setThread(data);
    } catch (err: any) {
      console.error('Error fetching thread:', err);
    }
  };

  const fetchMessages = async () => {
    if (!threadId) return;
    
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
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setMessages(data || []);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const markThreadAsRead = async () => {
    if (!threadId || !userId) return;
    
    try {
      await supabase
        .from('message_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('thread_id', threadId)
        .eq('user_id', userId);
    } catch (err: any) {
      console.error('Error marking thread as read:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !threadId || !userId) return;
    
    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          thread_id: threadId,
          sender_id: userId,
          content: messageText.trim(),
          content_type: 'text',
        });
      
      if (error) throw error;
      
      // Update thread last_message_at
      await supabase
        .from('message_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', threadId);
      
      setMessageText('');
      fetchMessages();
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const teacher = thread?.message_participants?.find((p: any) => p.role === 'teacher' || p.role === 'principal');
  const teacherName = teacher?.profiles ? 
    `${teacher.profiles.first_name} ${teacher.profiles.last_name}`.trim() :
    'Teacher';

  return (
    <ParentShell 
      tenantSlug={tenantSlug} 
      userEmail={profile?.email}
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName}
    >
      {/* Main Container with flex column */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - var(--topnav-h))',
        overflow: 'hidden',
      }}>
        {/* Header - Fixed Top */}
        <div style={{
          padding: '16px 20px',
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => router.push('/dashboard/parent/messages')}
            className="btn btnSecondary"
            style={{ marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <ArrowLeft size={16} />
            Back to Messages
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}>
              <User size={28} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                {teacherName}
              </h2>
              {thread?.student && (
                <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>
                  📚 About: {thread.student.first_name} {thread.student.last_name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area - Scrollable */}
        <div 
          className="hide-scrollbar"
          style={{ 
            flex: 1,
            overflowY: 'auto',
            padding: '24px 20px 100px',
            background: 'var(--background)',
            backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.03) 0%, transparent 50%)',
          }}
        >
          {messagesLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
              <div className="spinner"></div>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              textAlign: 'center',
              minHeight: 300,
              padding: 40,
            }}>
              <div style={{
                padding: '32px 24px',
                borderRadius: 16,
                background: 'var(--surface-2)',
                border: '2px dashed var(--border)',
              }}>
                <div style={{
                  width: 64,
                  height: 64,
                  margin: '0 auto 16px',
                  borderRadius: 32,
                  background: 'linear-gradient(135deg, var(--primary-subtle) 0%, rgba(139, 92, 246, 0.1) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Send size={28} color="var(--primary)" />
                </div>
                <p style={{ 
                  color: 'var(--text-primary)', 
                  marginBottom: 8, 
                  fontSize: 16,
                  fontWeight: 600,
                }}>
                  No messages yet
                </p>
                <p style={{ 
                  color: 'var(--muted)', 
                  fontSize: 14,
                  maxWidth: 280,
                  lineHeight: 1.5,
                }}>
                  Start the conversation below
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map((message) => {
                const isOwn = message.sender_id === userId;
                const senderName = message.sender ? 
                  `${message.sender.first_name} ${message.sender.last_name}` :
                  'Unknown';
                
                return (
                  <div
                    key={message.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isOwn ? 'flex-end' : 'flex-start',
                      animation: 'fadeIn 0.3s ease-in',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '75%',
                        padding: '14px 18px',
                        borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isOwn 
                          ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)' 
                          : 'var(--surface-2)',
                        color: isOwn ? 'white' : 'var(--text-primary)',
                        boxShadow: isOwn 
                          ? '0 2px 8px rgba(59, 130, 246, 0.25)' 
                          : '0 2px 8px rgba(0, 0, 0, 0.08)',
                        border: isOwn ? 'none' : '1px solid var(--border)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
                        {message.content}
                      </p>
                      <div style={{ 
                        marginTop: 6, 
                        fontSize: 11, 
                        opacity: 0.7,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {!isOwn && <span>{senderName}</span>}
                          <span>{formatMessageTime(message.created_at)}</span>
                        </div>
                        {isOwn && (
                          <span style={{ display: 'flex', alignItems: 'center', marginLeft: 6 }}>
                            <span style={{ fontSize: 14 }}>✓✓</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input - Fixed Bottom like WhatsApp */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: 'var(--background)',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.2)',
          zIndex: 100,
        }}>
          <form onSubmit={handleSendMessage}>
            <div style={{ 
              display: 'flex', 
              gap: 8, 
              alignItems: 'flex-end',
              maxWidth: 900,
              margin: '0 auto',
            }}>
              {/* Left icons group */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface-2)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted)';
                  }}
                >
                  <Smile size={24} />
                </button>
                
                <button
                  type="button"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface-2)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted)';
                  }}
                >
                  <Paperclip size={22} />
                </button>
              </div>
              
              {/* Input field */}
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                rows={1}
                className="message-input"
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
                  transition: 'border-color 0.2s ease',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              
              {/* Send/Mic button */}
              {messageText.trim() ? (
                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    background: sending ? 'var(--muted)' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: sending ? 'not-allowed' : 'pointer',
                    boxShadow: sending ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                  }}
                >
                  <Send size={20} color="white" />
                </button>
              ) : (
                <button
                  type="button"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    background: 'var(--surface-2)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface-2)';
                  }}
                >
                  <Mic size={22} color="var(--muted)" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </ParentShell>
  );
}
