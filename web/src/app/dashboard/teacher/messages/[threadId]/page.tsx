'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { ArrowLeft, Send, User, Loader2 } from 'lucide-react';

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
  participants?: Array<{
    user_id: string;
    role: string;
    user_profile?: {
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

export default function TeacherMessageThreadPage() {
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
      .channel(`thread-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload: any) => {
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
    if (!threadId) return;
    
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
            user_profile:profiles(first_name, last_name, role)
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

  const parent = thread?.participants?.find((p: any) => p.role === 'parent');
  const parentName = parent?.user_profile ? 
    `${parent.user_profile.first_name} ${parent.user_profile.last_name}`.trim() :
    'Parent';

  return (
    <TeacherShell 
      tenantSlug={tenantSlug} 
      userEmail={profile?.email}
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName}
      preschoolId={profile?.preschoolId}
      userId={userId}
    >
      <div className="container" style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div className="section">
          <button
            onClick={() => router.push('/dashboard/teacher/messages')}
            className="btn btnSecondary"
            style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <ArrowLeft size={16} />
            Back to Messages
          </button>
          
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                background: 'var(--primary-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <User size={24} color="var(--primary)" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                  {parentName}
                </h2>
                {thread?.student && (
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>
                    RE: {thread.student.first_name} {thread.student.last_name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="section">
          <div 
            className="card" 
            style={{ 
              padding: 20, 
              minHeight: 400, 
              maxHeight: 600, 
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {messagesLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
              </div>
            ) : messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div>
                  <p style={{ color: 'var(--muted)', marginBottom: 8 }}>No messages yet</p>
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>Start the conversation below</p>
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
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '70%',
                          padding: '12px 16px',
                          borderRadius: 12,
                          background: isOwn ? 'var(--primary)' : 'var(--surface-2)',
                          color: isOwn ? 'white' : 'var(--text-primary)',
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
                        }}>
                          {!isOwn && <span>{senderName}</span>}
                          <span>{formatMessageTime(message.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Message Input */}
        <div className="section">
          <form onSubmit={handleSendMessage}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message..."
                disabled={sending}
                rows={3}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                  fontSize: 15,
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: 80,
                  fontFamily: 'inherit',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={sending || !messageText.trim()}
                className="btn btnPrimary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  minWidth: 100,
                  height: 48,
                }}
              >
                {sending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send
                  </>
                )}
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              Press Enter to send, Shift+Enter for new line
            </p>
          </form>
        </div>
      </div>
    </TeacherShell>
  );
}
