'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { MessageCircle, Search, Send, Smile, Paperclip, Mic, Loader2, ArrowLeft, MoreVertical, Phone, Video, Image as ImageIcon, Camera } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { ChatMessageBubble, type ChatMessage } from '@/components/messaging/ChatMessageBubble';
import { useComposerEnhancements, EMOJI_OPTIONS } from '@/lib/messaging/useComposerEnhancements';
import { useTypingIndicator } from '@/lib/hooks/useTypingIndicator';
import { CallInterface, useCallInterface } from '@/components/calls/CallInterface';
import { ChatWallpaperPicker } from '@/components/messaging/ChatWallpaperPicker';
import { MessageOptionsMenu } from '@/components/messaging/MessageOptionsMenu';
import { MessageActionsMenu } from '@/components/messaging/MessageActionsMenu';

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
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0]?.[0]?.toUpperCase() || '?';
  };

  return (
    <div
      onClick={onSelect}
      className={`p-3 mb-2 rounded-[12px] cursor-pointer flex gap-3 items-center transition ${isActive ? 'bg-[var(--surface-2)] border border-[var(--primary)] shadow-[0_2px_12px_rgba(124,58,237,0.15)]' : 'border border-transparent hover:bg-[var(--surface)]'}`}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-[14px] font-semibold flex-shrink-0 ${isActive ? 'bg-[var(--primary)] shadow-[0_4px_12px_rgba(124,58,237,0.3)]' : 'bg-[var(--surface-2)]'}`}
      >
        {getInitials(parentName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[14px] ${hasUnread ? 'font-bold' : 'font-semibold'} truncate text-[var(--text)]`}>
            {parentName}
          </span>
          {thread.last_message?.created_at && (
            <span className="text-[11px] text-[var(--muted)] ml-2 flex-shrink-0">
              {formatMessageTime(thread.last_message.created_at)}
            </span>
          )}
        </div>
        {studentName && (
          <p className="m-0 mb-1 text-[12px] text-[var(--cyan)] truncate font-medium">📚 {studentName}</p>
        )}
        <p className={`m-0 text-[13px] truncate ${hasUnread ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>
          {thread.last_message?.content || 'No messages yet'}
        </p>
      </div>
      {hasUnread && (
        <div className="min-w-[22px] h-[22px] rounded-[11px] bg-[var(--primary)] text-white text-[11px] font-bold px-1.5 flex items-center justify-center shadow-[0_2px_8px_rgba(124,58,237,0.4)] flex-shrink-0">
          {thread.unread_count && thread.unread_count > 9 ? '9+' : thread.unread_count}
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  // Typing indicator and calling
  const { typingText, startTyping, stopTyping } = useTypingIndicator({ supabase, threadId: selectedThreadId, userId });
  const { callState, startVoiceCall, startVideoCall, closeCall } = useCallInterface();

  // Chat wallpaper state
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [wallpaperCss, setWallpaperCss] = useState<string | null>(null);

  // Message options menu state
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [optionsMenuAnchor, setOptionsMenuAnchor] = useState<HTMLElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // Message actions menu state
  const [messageActionsOpen, setMessageActionsOpen] = useState(false);
  const [messageActionsPosition, setMessageActionsPosition] = useState({ x: 0, y: 0 });
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const applyWallpaper = (sel: { type: 'preset' | 'url'; value: string }) => {
    if (sel.type === 'url') {
      setWallpaperCss(`url(${sel.value}) center/cover no-repeat, linear-gradient(180deg, #0f172a 0%, #1e293b 100%)`);
      return;
    }
    // Presets mapping (mirror of ChatWallpaperPicker presets)
    const presetMap: Record<string, string> = {
      'purple-glow': 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%), radial-gradient(circle at 15% 85%, rgba(99, 102, 241, 0.08) 0%, transparent 45%), radial-gradient(circle at 85% 15%, rgba(139, 92, 246, 0.08) 0%, transparent 45%)',
      'midnight': 'linear-gradient(135deg, #0b1020 0%, #151a2f 100%)',
      'deep-space': 'radial-gradient(1000px 600px at 10% 10%, rgba(124, 58, 237, 0.08), transparent), radial-gradient(1000px 600px at 90% 90%, rgba(236, 72, 153, 0.08), transparent), #0a0f1e',
    };
    setWallpaperCss(presetMap[sel.value] || presetMap['purple-glow']);
  };

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
    uploadProgress,
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

  const getThreadContactKey = (thread: MessageThread) => {
    const participants = thread.message_participants || thread.participants || [];
    const parentParticipant = participants.find((p) => p.role === 'parent');
    if (!parentParticipant?.user_id) {
      return `thread:${thread.id}`;
    }
    const studentKey = thread.student_id || 'no-student';
    return `${parentParticipant.user_id}:${studentKey}`;
  };

  const getThreadRecencyValue = (thread: MessageThread) => {
    const rawTimestamp = thread.last_message?.created_at || thread.last_message_at;
    return rawTimestamp ? new Date(rawTimestamp).getTime() : 0;
  };

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
      
      const uniqueThreadMap = new Map<string, any>();
      (threads || []).forEach((thread: any) => {
        if (!thread?.id) return;
        const existing = uniqueThreadMap.get(thread.id);
        if (!existing) {
          uniqueThreadMap.set(thread.id, thread);
          return;
        }
        const mergedParticipants = [
          ...(existing.message_participants || []),
          ...(thread.message_participants || []),
        ];
        const uniqueParticipants = Array.from(
          new Map(
            mergedParticipants
              .filter((participant) => participant?.user_id)
              .map((participant) => [participant.user_id, participant])
          ).values()
        );
        uniqueThreadMap.set(thread.id, {
          ...existing,
          ...thread,
          message_participants: uniqueParticipants,
        });
      });
      const dedupedThreads = Array.from(uniqueThreadMap.values());
      
      const teacherThreads = dedupedThreads.filter((thread: any) => 
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
            .maybeSingle();
          
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
      
      // Collapse duplicates so each parent/student pair only shows a single conversation entry.
      const uniqueParentThreadMap = new Map<string, MessageThread>();
      threadsWithDetails.forEach((thread) => {
        const key = getThreadContactKey(thread);
        const existing = uniqueParentThreadMap.get(key);
        if (!existing || getThreadRecencyValue(thread) >= getThreadRecencyValue(existing)) {
          uniqueParentThreadMap.set(key, thread);
        }
      });

      const uniqueThreads = Array.from(uniqueParentThreadMap.values()).sort(
        (a, b) => getThreadRecencyValue(b) - getThreadRecencyValue(a)
      );

      setThreads(uniqueThreads);

      if (selectedThreadId) {
        const stillSelected = uniqueThreads.some((t) => t.id === selectedThreadId);
        if (!stillSelected) {
          const originalSelected = threadsWithDetails.find((t) => t.id === selectedThreadId);
          if (originalSelected) {
            const replacementKey = getThreadContactKey(originalSelected);
            const replacement = uniqueParentThreadMap.get(replacementKey);
            setSelectedThreadId(replacement?.id || null);
          } else {
            setSelectedThreadId(null);
          }
        }
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

  // Message options menu handlers
  const handleDeleteThread = async () => {
    if (!selectedThreadId || !confirm('Are you sure you want to delete this conversation? This cannot be undone.')) return;
    try {
      await supabase.from('message_threads').delete().eq('id', selectedThreadId);
      setSelectedThreadId(null);
      setRefreshTrigger(prev => prev + 1);
      alert('Conversation deleted successfully.');
    } catch (err) {
      console.error('Error deleting thread:', err);
      alert('Failed to delete conversation.');
    }
  };

  const handleClearConversation = async () => {
    if (!selectedThreadId || !confirm('Are you sure you want to clear all messages in this conversation?')) return;
    try {
      await supabase.from('messages').delete().eq('thread_id', selectedThreadId);
      setRefreshTrigger(prev => prev + 1);
      alert('Conversation cleared successfully.');
    } catch (err) {
      console.error('Error clearing conversation:', err);
      alert('Failed to clear conversation.');
    }
  };

  const handleBlockUser = () => {
    alert('Block/Unblock functionality coming soon!');
  };

  const handleExportChat = () => {
    alert('Export chat functionality coming soon!');
  };

  const handleReportIssue = () => {
    alert('Report issue functionality coming soon!');
  };

  // Message action handlers
  const handleMessageContextMenu = (e: React.MouseEvent | React.TouchEvent, messageId: string) => {
    const x = 'clientX' in e ? e.clientX : e.touches?.[0]?.clientX || 0;
    const y = 'clientY' in e ? e.clientY : e.touches?.[0]?.clientY || 0;
    setMessageActionsPosition({ x, y });
    setSelectedMessageId(messageId);
    setMessageActionsOpen(true);
  };

  const handleReplyMessage = () => {
    const msg = messages.find(m => m.id === selectedMessageId);
    if (msg) {
      alert(`Reply to: "${msg.content}"\n\n(Reply functionality coming soon)`);
    }
  };

  const handleForwardMessage = () => {
    alert('Forward message functionality coming soon!');
  };

  const handleEditMessage = () => {
    const msg = messages.find(m => m.id === selectedMessageId);
    if (msg) {
      const newContent = prompt('Edit message:', msg.content);
      if (newContent && newContent.trim()) {
        supabase
          .from('messages')
          .update({ content: newContent.trim() })
          .eq('id', selectedMessageId)
          .then(() => {
            setRefreshTrigger(prev => prev + 1);
            alert('Message updated!');
          })
          .catch((err: any) => {
            console.error('Error editing message:', err);
            alert('Failed to edit message.');
          });
      }
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessageId || !confirm('Delete this message? This cannot be undone.')) return;
    try {
      await supabase.from('messages').delete().eq('id', selectedMessageId);
      setRefreshTrigger(prev => prev + 1);
      alert('Message deleted.');
    } catch (err) {
      console.error('Error deleting message:', err);
      alert('Failed to delete message.');
    }
  };

  const handleCopyMessage = () => {
    const msg = messages.find(m => m.id === selectedMessageId);
    if (msg) {
      navigator.clipboard.writeText(msg.content).then(() => {
        alert('Message copied to clipboard!');
      }).catch(() => {
        alert('Failed to copy message.');
      });
    }
  };

  const handleReactToMessage = () => {
    alert('Message reactions coming soon!');
  };

  return (
    <>
      {/* Hide global header on small screens for a focused messaging UI */}
      <style jsx global>{`
        @media (max-width: 1023px) {
          header.topbar { display: none !important; }
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
        contentStyle={{ padding: 0, margin: 0, overflow: 'hidden', height: '100%', position: 'relative' }}
      >
        <div className="flex h-[calc(100vh-var(--topnav-h))] w-full overflow-hidden bg-[var(--bg)]">
          {/* Collapsible Sidebar */}
          <div
            style={{
              order: isDesktop ? 2 : 0,
              width: isDesktop ? '340px' : '100%',
              height: '100%',
              display: (!isDesktop && selectedThread) ? 'none' : 'flex',
              flexDirection: 'column',
              background: 'var(--surface)',
              borderLeft: isDesktop ? '1px solid var(--border)' : 'none',
              boxShadow: isDesktop ? '-2px 0 12px rgba(0, 0, 0, 0.1)' : 'none',
              position: isDesktop ? 'relative' : 'fixed',
              top: isDesktop ? 0 : 0,
              right: isDesktop ? 0 : 'auto',
              left: isDesktop ? 'auto' : 0,
              bottom: isDesktop ? 0 : 0,
              zIndex: isDesktop ? 1 : 1000,
              flexShrink: 0,
            }}
          >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-2)] shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between mb-4">
              {!isDesktop && (
                <button
                  onClick={() => router.push('/dashboard/teacher')}
                  className="w-9 h-9 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center cursor-pointer text-[var(--text)]"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <h3 className={`m-0 text-[18px] font-bold text-[var(--text)] flex-1 ${!isDesktop ? 'text-center' : 'text-left'}`}>
                Messages
              </h3>
              {totalUnread > 0 && (
                <span className="bg-[var(--primary)] text-white text-[12px] font-bold px-2.5 py-1 rounded-[12px] shadow-[0_2px_8px_rgba(124,58,237,0.3)]">
                  {totalUnread}
                </span>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-[14px] outline-none transition"
              />
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
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
          order: 1,
          flex: 1,
          display: (!isDesktop && !selectedThread) ? 'none' : 'flex',
          flexDirection: 'column',
          background: wallpaperCss || 'var(--bg)',
          position: 'relative',
          height: '100%',
          overflow: 'hidden',
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
              <div className={`${isDesktop ? 'py-5 px-7' : 'p-4'} ${isDesktop ? 'border-b border-[var(--border)]' : ''} bg-[var(--surface)] [backdrop-filter:blur(12px)] flex items-center gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] ${isDesktop ? 'sticky' : 'fixed'} ${isDesktop ? 'top-0' : 'top-0'} z-10 w-full ${isDesktop ? '' : 'left-0 right-0'}`}>
                {!isDesktop && (
                  <button
                    onClick={() => setSelectedThreadId(null)}
                    className="w-10 h-10 rounded-[10px] bg-transparent border-none flex items-center justify-center cursor-pointer text-[var(--text)]"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <div
                  className={`${isDesktop ? 'w-[52px] h-[52px] text-[18px]' : 'w-9 h-9 text-[13px]'} rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--cyan)_100%)] flex items-center justify-center text-white font-bold shadow-[0_4px_16px_rgba(124,58,237,0.3)] flex-shrink-0`}
                >
                  {parentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`${isDesktop ? 'text-[18px]' : 'text-[16px]'} m-0 font-bold text-[var(--text)] truncate`}>
                    {parentName}
                  </h3>
                  {isDesktop && selectedThread.student && (
                    <p className="mt-1 text-[13px] text-[var(--cyan)] font-medium flex items-center gap-1.5">
                      <span>📚</span>
                      <span>{selectedThread.student.first_name} {selectedThread.student.last_name}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isDesktop ? (
                    <>
                      <button
                        onClick={() => setWallpaperOpen(true)}
                        title="Chat wallpaper"
                        className="w-10 h-10 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)]"
                      >
                        <ImageIcon size={18} />
                      </button>
                      <button
                        onClick={() => parentParticipant?.user_id && startVoiceCall(parentParticipant.user_id, parentName)}
                        title="Start voice call"
                        className="w-10 h-10 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)]"
                      >
                        <Phone size={18} />
                      </button>
                      <button
                        onClick={() => parentParticipant?.user_id && startVideoCall(parentParticipant.user_id, parentName)}
                        title="Start video call"
                        className="w-10 h-10 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)]"
                      >
                        <Video size={18} />
                      </button>
                      <button
                        ref={moreButtonRef}
                        onClick={() => {
                          setOptionsMenuAnchor(moreButtonRef.current);
                          setOptionsMenuOpen(true);
                        }}
                        className="w-10 h-10 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)]"
                      >
                        <MoreVertical size={20} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => parentParticipant?.user_id && startVoiceCall(parentParticipant.user_id, parentName)}
                        title="Voice call"
                        className="w-10 h-10 rounded-[10px] bg-transparent border-none flex items-center justify-center text-[var(--muted)]"
                      >
                        <Phone size={18} />
                      </button>
                      <button
                        onClick={() => parentParticipant?.user_id && startVideoCall(parentParticipant.user_id, parentName)}
                        title="Video call"
                        className="w-10 h-10 rounded-[10px] bg-transparent border-none flex items-center justify-center text-[var(--muted)]"
                      >
                        <Video size={18} />
                      </button>
                      <button
                        ref={moreButtonRef}
                        type="button"
                        onClick={() => {
                          setOptionsMenuAnchor(moreButtonRef.current);
                          setOptionsMenuOpen(true);
                        }}
                        className="w-10 h-10 rounded-[10px] bg-transparent border-none flex items-center justify-center text-[var(--muted)]"
                        title="More"
                      >
                        <MoreVertical size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Mobile: Fixed student name subtitle */}
              {!isDesktop && selectedThread.student && (
                <div className="fixed top-[68px] left-0 right-0 z-[999] px-4 py-2 flex items-center justify-center gap-1.5">
                  <span className="text-[13px] text-[var(--cyan)] font-medium">📚</span>
                  <span className="text-[13px] text-[#cbd5e1] font-medium">
                    {selectedThread.student.first_name} {selectedThread.student.last_name}
                  </span>
                </div>
              )}

              {/* Typing indicator */}
              {typingText && (
                <div style={{
                  padding: '8px 16px',
                  color: 'var(--muted)',
                  fontSize: '12px'
                }}>
                  {typingText}
                </div>
              )}

              {/* Messages Area */}
              <div
                className="hide-scrollbar"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: isDesktop ? '24px 28px' : '16px',
                  paddingTop: !isDesktop ? (selectedThread.student ? '116px' : '88px') : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  paddingBottom: isDesktop ? undefined : selectedThread.student ? '70px' : '60px',
                }}
              >
                <div className={`w-full ${isDesktop ? 'max-w-[860px] mx-auto px-3' : 'px-1'}`}>
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
                  <div className="flex flex-col gap-4">
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
                          hideAvatars={!isDesktop}
                          onContextMenu={handleMessageContextMenu}
                        />
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
                </div>
              </div>

              {/* Message Composer */}
              <div className={`${isDesktop ? 'py-3 px-7 border-t border-[var(--border)]' : 'fixed bottom-0 left-0 right-0 px-3 py-2.5'} bg-[var(--surface)] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-40`}>
                <div className={`w-full ${isDesktop ? 'max-w-[860px] mx-auto' : ''}`}>
                <input
                  type="file"
                  accept="image/*,audio/*,video/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleAttachmentChange}
                />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  className="hidden"
                  onChange={handleAttachmentChange}
                />
                <form onSubmit={handleSendMessage} className="relative" style={{ marginLeft: isDesktop ? 0 : '-8px' }}>
                  {showEmojiPicker && (
                    <div
                      ref={emojiPickerRef}
                      className="absolute bottom-[70px] left-3 bg-[var(--surface)] border border-[var(--border)] rounded-[16px] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.2)] grid grid-cols-5 gap-2 z-20"
                    >
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleEmojiSelect(emoji)}
                          className="text-[22px] p-1.5 rounded hover:bg-[var(--surface-2)] transition"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={`flex gap-2.5 ${isDesktop ? 'items-end' : 'items-center'}`}>
                    {isDesktop && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          ref={emojiButtonRef}
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="w-11 h-11 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center cursor-pointer text-[var(--muted)] transition"
                        >
                          <Smile size={22} />
                        </button>
                        <button
                          type="button"
                          onClick={triggerFilePicker}
                          disabled={attachmentUploading}
                          className={`w-11 h-11 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] transition ${attachmentUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <Paperclip size={20} />
                        </button>
                      </div>
                    )}

                    {!isDesktop && (
                      <>
                        {/* Emoji outside on the left */}
                        <button
                          type="button"
                          ref={emojiButtonRef}
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="w-[44px] h-[44px] rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] shrink-0 self-end mb-[2px]"
                          aria-label="Emoji"
                        >
                          <Smile size={20} />
                        </button>
                        <div className="flex flex-row items-end flex-1 gap-3 px-4 py-4 rounded-[24px] border-0 bg-[var(--surface-2)]">
                          {/* Textarea */}
                          <textarea
                            value={messageText}
                            onChange={(e) => { 
                              setMessageText(e.target.value); 
                              startTyping();
                              const ta = e.target as HTMLTextAreaElement;
                              ta.style.height = 'auto';
                              ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
                            }}
                            onBlur={() => { try { stopTyping(); } catch {} }}
                            placeholder="Type a message"
                            disabled={sending || attachmentUploading}
                            rows={1}
                            className="flex-1 min-h-[28px] py-1 bg-transparent text-[var(--text)] text-[16px] outline-none resize-none max-h-[120px] leading-[24px] placeholder:text-[var(--muted)] focus:outline-none focus:ring-0 focus:border-0"
                            style={{ height: '28px', border: 'none', outline: 'none' }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                                (e.currentTarget as HTMLTextAreaElement).style.height = '28px';
                              }
                            }}
                          />
                          {/* Camera (auto-hides when typing) */}
                          {!messageText.trim() && (
                            <button
                              type="button"
                              onClick={() => cameraInputRef.current?.click()}
                              disabled={attachmentUploading}
                              className={`text-[var(--muted)] shrink-0 mb-1 ${attachmentUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                              aria-label="Camera"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                <circle cx="12" cy="13" r="4"/>
                              </svg>
                            </button>
                          )}
                          {/* Clip */}
                          <button
                            type="button"
                            onClick={triggerFilePicker}
                            disabled={attachmentUploading}
                            className={`text-[var(--muted)] shrink-0 mb-1 ${attachmentUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            aria-label="Attach file"
                          >
                            <Paperclip size={20} />
                          </button>
                        </div>
                        {messageText.trim() ? (
                          <button
                            type="submit"
                            disabled={sending || attachmentUploading}
                            className={`w-[40px] h-[40px] rounded-full border-0 flex items-center justify-center ml-1 self-end ${sending || attachmentUploading ? 'bg-[var(--muted)] cursor-not-allowed' : 'bg-[var(--primary)] shadow-[0_4px_12px_rgba(124,58,237,0.4)]'}`}
                          >
                            {sending || attachmentUploading ? (
                              <Loader2 size={16} className="animate-spin" color="white" />
                            ) : (
                              <Send size={16} color="white" />
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleMicClick}
                            className={`w-[40px] h-[40px] rounded-full border-0 flex items-center justify-center ml-1 self-end ${isRecording ? 'bg-[var(--warning)] shadow-[0_4px_12px_rgba(245,158,11,0.4)]' : 'bg-[var(--cyan)] shadow-[0_4px_12px_rgba(0,245,255,0.4)]'}`}
                          >
                            <Mic size={18} color="white" />
                          </button>
                        )}
                      </>
                    )}

                    {isDesktop && (
                      messageText.trim() ? (
                        <button
                          type="submit"
                          disabled={sending || attachmentUploading}
                          className={`w-[50px] h-[50px] rounded-[14px] border-0 flex items-center justify-center flex-shrink-0 ${sending || attachmentUploading ? 'bg-[var(--muted)] cursor-not-allowed' : 'bg-[var(--primary)] shadow-[0_4px_16px_rgba(124,58,237,0.4)]'}`}
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
                          className={`w-[50px] h-[50px] rounded-[14px] border-0 flex items-center justify-center flex-shrink-0 ${isRecording ? 'bg-[var(--warning)] shadow-[0_4px_16px_rgba(245,158,11,0.4)]' : 'bg-[var(--cyan)] shadow-[0_4px_16px_rgba(0,245,255,0.4)]'}`}
                        >
                          <Mic size={22} color="white" />
                        </button>
                      )
                    )}
                  </div>
                </form>
                {statusMessage && (
                  <p className="mt-2.5 text-[13px] text-[var(--danger)] text-center">
                    {statusMessage}
                  </p>
                )}
                {attachmentUploading && uploadProgress !== null && (
                  <div className="mt-2.5">
                    <div className="flex items-center justify-center gap-2 text-[13px] text-[var(--muted)] mb-1.5">
                      <Loader2 size={14} className="animate-spin" />
                      <span>Uploading... {Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--primary)] transition-all duration-300 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
        {/* Call overlay */}
        <CallInterface
          isOpen={callState.isOpen}
          onClose={closeCall}
          callType={callState.callType}
          remoteUserId={callState.remoteUserId}
          remoteUserName={callState.remoteUserName}
        />
        <ChatWallpaperPicker
          isOpen={wallpaperOpen}
          onClose={() => setWallpaperOpen(false)}
          userId={userId || ''}
          onSelect={applyWallpaper}
        />
        <MessageOptionsMenu
          isOpen={optionsMenuOpen}
          onClose={() => setOptionsMenuOpen(false)}
          onDeleteThread={handleDeleteThread}
          onClearConversation={handleClearConversation}
          onBlockUser={handleBlockUser}
          onExportChat={handleExportChat}
          onReportIssue={handleReportIssue}
          anchorEl={optionsMenuAnchor}
        />
        <MessageActionsMenu
          isOpen={messageActionsOpen}
          onClose={() => setMessageActionsOpen(false)}
          position={messageActionsPosition}
          isOwnMessage={messages.find(m => m.id === selectedMessageId)?.sender_id === userId}
          onReply={handleReplyMessage}
          onForward={handleForwardMessage}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
          onCopy={handleCopyMessage}
          onReact={handleReactToMessage}
        />
      </TeacherShell>
    </>
  );
}
