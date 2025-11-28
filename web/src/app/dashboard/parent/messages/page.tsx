'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { ChatMessageBubble, type ChatMessage } from '@/components/messaging/ChatMessageBubble';
import { useComposerEnhancements, EMOJI_OPTIONS } from '@/lib/messaging/useComposerEnhancements';
import { CallInterface, useCallInterface } from '@/components/calls/CallInterface';
import { useTypingIndicator } from '@/lib/hooks/useTypingIndicator';
import { MessageActionsMenu } from '@/components/messaging/MessageActionsMenu';
import { MessageOptionsMenu } from '@/components/messaging/MessageOptionsMenu';
import { ChatWallpaperPicker } from '@/components/messaging/ChatWallpaperPicker';
import { MessageSquare, Send, Search, User, School, Paperclip, Smile, Mic, Loader2, ArrowLeft, Phone, Video, MoreVertical, Trash2, Image } from 'lucide-react';

interface ParticipantProfile {
  first_name: string;
  last_name: string;
  role: string;
}

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
    profiles?: ParticipantProfile;
  }>;
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count?: number;
}

const CONTACT_PANEL_WIDTH = 296;

const formatMessageTime = (timestamp: string | undefined | null): string => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  
  // Handle invalid dates
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface ThreadItemProps {
  thread: MessageThread;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (threadId: string) => void;
  isDesktop: boolean;
}

const ThreadItem = ({ thread, isActive, onSelect, onDelete, isDesktop }: ThreadItemProps) => {
  const participants = thread.message_participants || [];
  const educator = participants.find((p) => {
    const role = p.role || p.profiles?.role;
    return role !== 'parent';
  });
  const educatorName = educator?.profiles
    ? `${educator.profiles.first_name} ${educator.profiles.last_name}`.trim()
    : 'Teacher';
  const educatorRole = educator?.profiles?.role || educator?.role || 'teacher';
  const studentName = thread.student
    ? `${thread.student.first_name} ${thread.student.last_name}`
    : null;
  const hasUnread = (thread.unread_count || 0) > 0;
  
  // Get initials for avatar
  const getInitials = (name: string) => {
    if (!name || name.trim() === '') return '?';
    const parts = name.trim().split(' ').filter(part => part.length > 0);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() || '?';
  };

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px 16px',
        cursor: 'pointer',
        background: isActive 
          ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)' 
          : 'transparent',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        transition: 'all 0.2s ease',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
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
          width: 36,
          height: 36,
          borderRadius: 18,
          background: isActive 
            ? educatorRole === 'principal' 
              ? 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)' 
              : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
            : educatorRole === 'principal'
              ? 'linear-gradient(135deg, #6d28d9 0%, #581c87 100%)'
              : 'linear-gradient(135deg, #475569 0%, #334155 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          transition: 'all 0.2s ease',
        }}
      >
        {educatorRole === 'principal' ? <School size={16} /> : getInitials(educatorName)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: hasUnread ? 700 : 600,
              color: hasUnread ? '#f1f5f9' : '#e2e8f0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '0.01em',
            }}
          >
            {educatorName}
          </span>
        </div>
        {studentName && (
          <p
            style={{
              margin: '0 0 2px 0',
              fontSize: 11,
              color: '#a78bfa',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 500,
            }}
          >
            📚 {studentName}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: hasUnread ? '#cbd5e1' : '#64748b',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            {thread.last_message?.content 
              ? thread.last_message.content.startsWith('__media__') 
                ? '📷 Photo' 
                : thread.last_message.content 
              : 'No messages yet'}
          </p>
          {thread.last_message?.created_at && (
            <span style={{ 
              fontSize: 11, 
              color: hasUnread ? '#a78bfa' : '#64748b', 
              fontWeight: hasUnread ? 600 : 400,
              flexShrink: 0,
            }}>
              {formatMessageTime(thread.last_message.created_at)}
            </span>
          )}
        </div>
      </div>
      {hasUnread && (
        <div
          style={{
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            boxShadow: '0 2px 6px rgba(59, 130, 246, 0.4)',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>
            {thread.unread_count && thread.unread_count > 9 ? '9+' : thread.unread_count}
          </span>
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Delete conversation with ${educatorName}?`)) {
            onDelete(thread.id);
          }
        }}
        style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8,
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#ef4444',
          flexShrink: 0,
          marginLeft: 'auto',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
        }}
        title="Delete conversation"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

export default function ParentMessagesPage() {
  useBodyScrollLock(true);
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string>();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const { slug } = useTenantSlug(userId);
  const { profile, loading: profileLoading } = useUserProfile(userId);

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
  const [messageActionsOpen, setMessageActionsOpen] = useState(false);
  const [messageActionsPosition, setMessageActionsPosition] = useState({ x: 0, y: 0 });
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [optionsMenuAnchor, setOptionsMenuAnchor] = useState<HTMLElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  
  // Chat wallpaper state
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [wallpaperCss, setWallpaperCss] = useState<string | null>(null);
  
  const applyWallpaper = (sel: { type: 'preset' | 'url'; value: string }) => {
    if (sel.type === 'url') {
      setWallpaperCss(`url(${sel.value}) center/cover no-repeat fixed`);
      return;
    }
    // Presets mapping
    const presetMap: Record<string, string> = {
      'purple-glow': 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      'midnight': 'linear-gradient(180deg, #0a0f1e 0%, #1a1a2e 50%, #0a0f1e 100%)',
      'ocean-deep': 'linear-gradient(180deg, #0c4a6e 0%, #164e63 50%, #0f172a 100%)',
      'forest-night': 'linear-gradient(180deg, #14532d 0%, #1e3a3a 50%, #0f172a 100%)',
      'sunset-warm': 'linear-gradient(180deg, #7c2d12 0%, #4a1d1d 50%, #0f172a 100%)',
      'dark-slate': 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
    };
    setWallpaperCss(presetMap[sel.value] || presetMap['purple-glow']);
  };

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Call useComposerEnhancements early to satisfy Rules of Hooks
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
    onRefresh: () => {
      setRefreshTrigger(prev => prev + 1);
    },
    onEmojiInsert: (emoji) => setMessageText((prev) => `${prev}${emoji}`),
  });

  // Call interface hook
  const { callState, startVoiceCall, startVideoCall, closeCall } = useCallInterface();

  // Typing indicator hook
  const { typingText, startTyping, stopTyping } = useTypingIndicator({ supabase, threadId: selectedThreadId, userId });

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/sign-in');
        return;
      }

      setUserEmail(session.user.email);
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
      const { error } = await supabase.rpc('mark_thread_messages_as_read', {
        thread_id: threadId,
        reader_id: userId,
      });
      if (!error) {
        // Immediately update local state to show 0 unread for this thread
        setThreads(prev => prev.map(t => 
          t.id === threadId ? { ...t, unread_count: 0 } : t
        ));
      }
    } catch (err) {
      // Silent fail - marking as read is not critical
    }
  }, [supabase, userId]);

  // Mark thread as read when selected (with delay to ensure messages are loaded)
  useEffect(() => {
    if (selectedThreadId && userId) {
      // Mark as read and trigger refresh
      const markAndRefresh = async () => {
        await markThreadAsRead(selectedThreadId);
        // Wait a bit for DB to update, then trigger refresh
        setTimeout(() => {
          setRefreshTrigger(prev => prev + 1);
        }, 500);
      };
      
      // Delay slightly to ensure messages are loaded first
      setTimeout(markAndRefresh, 300);
    }
  }, [selectedThreadId, userId, markThreadAsRead]);

  // Deduplication helpers
  const getThreadContactKey = (thread: MessageThread) => {
    const participants = thread.message_participants || [];
    
    // Find the educator (teacher or principal) - anyone who is not a parent
    // Check both direct role and profile role for compatibility
    const educator = participants.find((p) => {
      const role = p.role || p.profiles?.role;
      return role !== 'parent';
    });
    const educatorUserId = educator?.user_id;
    
    if (!educatorUserId) {
      return `thread:${thread.id}`;
    }
    
    const educatorRole = educator.role || educator.profiles?.role;
    
    // Use educator user_id as the unique identifier for deduplication
    // This ensures one conversation per educator (teacher/principal) regardless of students
    return `educator:${educatorUserId}`;
  };

  const getThreadRecencyValue = (thread: MessageThread) => {
    const rawTimestamp = thread.last_message?.created_at || thread.last_message_at;
    return rawTimestamp ? new Date(rawTimestamp).getTime() : 0;
  };

  const fetchThreads = useCallback(async () => {
    if (!userId) return;

    setThreadsLoading(true);
    setError(null);

    try {
      // Get all threads, then fetch participants separately to avoid Supabase nested query issues
      const { data: userThreadIds, error: userThreadIdsError } = await supabase
        .from('message_participants')
        .select('thread_id')
        .eq('user_id', userId)
        .eq('role', 'parent');

      if (userThreadIdsError) throw userThreadIdsError;

      const threadIdsList = userThreadIds?.map((t: { thread_id: string }) => t.thread_id) || [];
      
      if (threadIdsList.length === 0) {
        setThreads([]);
        return;
      }

      // Get thread basic info
      const { data: threadsData, error: threadsError } = await supabase
        .from('message_threads')
        .select(`
          id,
          type,
          subject,
          student_id,
          last_message_at,
          student:students(id, first_name, last_name)
        `)
        .in('id', threadIdsList)
        .order('last_message_at', { ascending: false });

      if (threadsError) throw threadsError;

      // Get participants without profiles first (should include educators due to RLS policy)
      const { data: rawParticipants, error: participantsError } = await supabase
        .from('message_participants')
        .select('thread_id, user_id, role, last_read_at')
        .in('thread_id', threadIdsList);

      if (participantsError) {
        throw participantsError;
      }
      
      // Get profiles for all participants
      const allUserIds = [...new Set((rawParticipants || []).map((p: { user_id: string }) => p.user_id))];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .in('id', allUserIds);

      // Profiles error is non-fatal, continue with available data

      // Combine participants with profiles
      const allParticipants = (rawParticipants || []).map((participant: { thread_id: string; user_id: string; role: string; last_read_at?: string }) => ({
        ...participant,
        profiles: profilesData?.find((profile: { id: string }) => profile.id === participant.user_id) || null
      }));

      // Combine threads with their participants
      const threadsWithParticipants = (threadsData || []).map((thread: { id: string }) => ({
        ...thread,
        message_participants: allParticipants?.filter((p: { thread_id: string }) => p.thread_id === thread.id) || []
      }));

      const parentThreads = threadsWithParticipants;

      const threadsWithDetails = await Promise.all(
        parentThreads.map(async (thread: any) => {
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('thread_id', thread.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const parentParticipant = thread.message_participants?.find(
            (p: any) => p.user_id === userId && p.role === 'parent'
          );

          let unreadCount = 0;
          if (parentParticipant) {
            const lastReadAt = parentParticipant.last_read_at || '2000-01-01';
            const { count } = await supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('thread_id', thread.id)
              .neq('sender_id', userId)
              .gt('created_at', lastReadAt);
            unreadCount = count || 0;
          }

          return {
            ...thread,
            last_message: lastMessage || thread.last_message,
            unread_count: unreadCount,
          } as MessageThread;
        })
      );

      // Collapse duplicates so each teacher/student pair only shows once
      const uniqueContactThreadMap = new Map<string, MessageThread>();
      threadsWithDetails.forEach((thread) => {
        const key = getThreadContactKey(thread);
        const existing = uniqueContactThreadMap.get(key);
        if (!existing || getThreadRecencyValue(thread) >= getThreadRecencyValue(existing)) {
          uniqueContactThreadMap.set(key, thread);
        }
      });

      const uniqueThreads = Array.from(uniqueContactThreadMap.values()).sort(
        (a, b) => getThreadRecencyValue(b) - getThreadRecencyValue(a)
      );

      setThreads(uniqueThreads);
      // Don't auto-select threads - let user choose
      // Only ensure selection is still valid if one exists
      if (selectedThreadId) {
        const stillSelected = threadsWithDetails.some((t) => t.id === selectedThreadId);
        if (!stillSelected) {
          setSelectedThreadId(null);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setThreadsLoading(false);
    }
  }, [selectedThreadId, supabase, userId]);

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
      // Silent fail for messages fetch
    } finally {
      setMessagesLoading(false);
    }
  }, [markThreadAsRead, supabase]);

  const refreshConversation = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (userId) {
      fetchThreads();
    }
  }, [userId, fetchThreads, refreshTrigger]);

  useEffect(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId);
    }
  }, [selectedThreadId, fetchMessages]);

  useEffect(() => {
    if (!selectedThreadId) return;

    const channel = supabase
      .channel(`parent-thread-${selectedThreadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${selectedThreadId}`,
        },
        async (payload: any) => {
          // Fetch the complete message with sender info
          const { data: newMessage } = await supabase
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
            .eq('id', payload.new.id)
            .single();

          if (newMessage) {
            // Add new message to state immediately
            setMessages((prev) => [...prev, newMessage]);
            // Refresh thread list to update last message
            fetchThreads();
            // Scroll to bottom
            setTimeout(() => scrollToBottom(), 100);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedThreadId, supabase, fetchThreads]);

  // Stable keyboard listener with empty deps array - MUST be before any conditional returns
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

  // Compute derived values BEFORE early return (hooks must always be called)
  const filteredThreads = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return threads.filter((thread) => {
      if (!query) return true;
      const participants = thread.message_participants || [];
      const educator = participants.find((p) => p.role !== 'parent');
      const educatorName = educator?.profiles
        ? `${educator.profiles.first_name} ${educator.profiles.last_name}`.toLowerCase()
        : '';
      const studentName = thread.student
        ? `${thread.student.first_name} ${thread.student.last_name}`.toLowerCase()
        : '';
      const lastMessage = thread.last_message?.content?.toLowerCase() || '';

      return (
        educatorName.includes(query) ||
        studentName.includes(query) ||
        lastMessage.includes(query) ||
        thread.subject.toLowerCase().includes(query)
      );
    });
  }, [threads, searchQuery]);

  // Early return for loading states (AFTER all hooks)
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const handleDeleteThread = async (threadId: string) => {
    try {
      // First delete all messages in the thread
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('thread_id', threadId);

      if (messagesError) throw messagesError;

      // Delete message_participants
      const { error: participantsError } = await supabase
        .from('message_participants')
        .delete()
        .eq('thread_id', threadId);

      // Participants error is non-fatal

      // Then delete the thread itself
      const { error: threadError } = await supabase
        .from('message_threads')
        .delete()
        .eq('id', threadId);

      if (threadError) throw threadError;

      // Remove from local state
      setThreads(prev => prev.filter(t => t.id !== threadId));
      
      // If it was selected, clear selection
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
      }
    } catch (err: any) {
      alert('Failed to delete conversation. Please try again.');
    }
  };

  // Options menu handlers
  const handleOptionsDeleteThread = async () => {
    if (!selectedThreadId || !confirm('Are you sure you want to delete this conversation? This cannot be undone.')) return;
    await handleDeleteThread(selectedThreadId);
  };

  const handleClearConversation = async () => {
    if (!selectedThreadId || !confirm('Are you sure you want to clear all messages in this conversation?')) return;
    try {
      await supabase.from('messages').delete().eq('thread_id', selectedThreadId);
      setMessages([]);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedThreadId || !userId) return;

    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
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
      
      // Scroll to bottom after sending
      setTimeout(() => scrollToBottom(), 100);
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleMessageContextMenu = (e: React.MouseEvent | React.TouchEvent, messageId: string) => {
    const x = 'clientX' in e ? e.clientX : e.touches?.[0]?.clientX || 0;
    const y = 'clientY' in e ? e.clientY : e.touches?.[0]?.clientY || 0;
    setSelectedMessageId(messageId);
    setMessageActionsPosition({ x, y });
    setMessageActionsOpen(true);
  };

  const handleReplyMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      alert('Reply feature coming soon!');
    }
    setMessageActionsOpen(false);
  };

  const handleForwardMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      alert('Forward feature coming soon!');
    }
    setMessageActionsOpen(false);
  };

  const handleEditMessage = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || message.sender_id !== userId) return;

    const newContent = prompt('Edit message:', message.content);
    if (newContent && newContent.trim() && newContent !== message.content) {
      try {
        const { error } = await supabase
          .from('messages')
          .update({ content: newContent.trim() })
          .eq('id', messageId);

        if (error) throw error;
        setRefreshTrigger(prev => prev + 1);
      } catch (err) {
        console.error('Error editing message:', err);
        alert('Failed to edit message.');
      }
    }
    setMessageActionsOpen(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || message.sender_id !== userId) return;

    if (confirm('Are you sure you want to delete this message?')) {
      try {
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', messageId);

        if (error) throw error;
        setRefreshTrigger(prev => prev + 1);
      } catch (err) {
        console.error('Error deleting message:', err);
        alert('Failed to delete message.');
      }
    }
    setMessageActionsOpen(false);
  };

  const handleCopyMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      navigator.clipboard.writeText(message.content);
      alert('Message copied to clipboard!');
    }
    setMessageActionsOpen(false);
  };

  const handleReactToMessage = (messageId: string) => {
    alert('Reactions feature coming soon!');
    setMessageActionsOpen(false);
  };

  const totalUnread = threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);
  const currentThread = selectedThreadId
    ? threads.find((thread) => thread.id === selectedThreadId)
    : null;
  const educator = currentThread?.message_participants?.find((p) => p.role !== 'parent');
  const educatorName = educator?.profiles
    ? `${educator.profiles.first_name} ${educator.profiles.last_name}`.trim()
    : 'Teacher';

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
  };

  const handleClearSelection = () => {
    setSelectedThreadId(null);
    // Refresh threads to update unread counts
    fetchThreads();

    // On mobile, don't use router.back() - just clear selection to show contact list
    // Router navigation is not needed since we're staying on the same page
  };

  return (
    <ParentShell
      tenantSlug={slug}
      userEmail={userEmail}
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName}
      unreadCount={totalUnread}
      contentStyle={{ padding: 0, overflow: 'hidden', height: '100vh', maxHeight: '100vh' }}
    >
      <style>{`
        @media (max-width: 1023px) {
          header.topbar {
            display: none !important;
          }
          .frame {
            padding: 0 !important;
            gap: 0 !important;
          }
          .content {
            padding: 0 !important;
            padding-bottom: 0 !important;
            max-height: 100vh !important;
            max-height: 100dvh !important;
            height: 100vh !important;
            height: 100dvh !important;
          }
          .app {
            height: 100vh !important;
            height: 100dvh !important;
            overflow: hidden !important;
          }
        }
      `}</style>
      <div
        className="parent-messages-page"
        style={{
          display: 'flex',
          height: '100vh',
          overflow: 'hidden',
          width: '100%',
          margin: 0,
          boxSizing: 'border-box',
          background: '#0f172a',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            marginRight: 0,
          }}
        >
          {/* Mobile: Show thread list when no selection, otherwise show chat */}
          {!isDesktop && !currentThread ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '100vh', background: '#0f172a' }}>
              {/* Mobile contacts header with back arrow */}
              <div style={{ 
                padding: '16px 12px', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                background: '#111827',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                zIndex: 1000,
              }}>
                <button
                  onClick={() => router.back()}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    padding: 0,
                  }}
                >
                  <ArrowLeft size={22} />
                </button>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Contacts
                </h2>
              </div>
              
              {/* Search bar fixed below header */}
              <div style={{ 
                position: 'fixed',
                top: '68px',
                left: 0,
                right: 0,
                padding: '12px 16px',
                background: '#111827',
                backdropFilter: 'blur(12px)',
                zIndex: 999,
              }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 40px',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-primary)',
                      fontSize: 15,
                    }}
                  />
                  <Search
                    size={18}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--muted)',
                    }}
                  />
                </div>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', paddingTop: '136px', minHeight: 'calc(100vh - 136px)', background: '#0f172a' }}>
              {threadsLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }}></div>
                </div>
              ) : filteredThreads.length > 0 ? (
                filteredThreads.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isActive={false}
                    onSelect={() => handleSelectThread(thread.id)}
                    onDelete={handleDeleteThread}
                    isDesktop={isDesktop}
                  />
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <MessageSquare size={48} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
                  <p style={{ color: 'var(--muted)', fontSize: 15 }}>No conversations yet</p>
                </div>
                )}
              </div>
            </div>
          ) : currentThread ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: wallpaperCss || 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
              position: 'relative',
              height: '100%',
              overflow: 'hidden',
            }}>
              <div
                style={{
                  position: 'fixed',
                  top: isDesktop ? 'auto' : 0,
                  left: isDesktop ? 'auto' : 0,
                  right: isDesktop ? 'auto' : 0,
                  width: isDesktop ? 'auto' : '100%',
                  zIndex: isDesktop ? 'auto' : 1000,
                  padding: isDesktop ? '20px 28px' : '16px 12px',
                  borderBottom: isDesktop ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
                  background: isDesktop
                    ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)'
                    : 'var(--surface)',
                  backdropFilter: 'blur(12px)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: isDesktop ? 18 : 12,
                  boxShadow: isDesktop ? '0 2px 12px rgba(0, 0, 0, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}
              >
                {!isDesktop && (
                  <button
                    onClick={handleClearSelection}
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
                      color: '#e2e8f0',
                      padding: 0,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <div
                  style={{
                    width: isDesktop ? 52 : 36,
                    height: isDesktop ? 52 : 36,
                    borderRadius: isDesktop ? 26 : 18,
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                    fontSize: isDesktop ? 17 : 13,
                    fontWeight: 600,
                    color: '#fff',
                  }}
                >
                  {educatorName.trim().split(' ').filter(n => n.length > 0).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ 
                    margin: 0, 
                    fontSize: isDesktop ? 18 : 16, 
                    fontWeight: 700, 
                    color: '#f1f5f9',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {educatorName}
                  </h2>
                  {isDesktop && currentThread.student && (
                    <p style={{ 
                      margin: '4px 0 0', 
                      fontSize: 13, 
                      color: '#a78bfa', 
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <span>📚</span>
                      <span>{currentThread.student.first_name} {currentThread.student.last_name}</span>
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 10 : 8 }}>
                  {isDesktop ? (
                    <button
                      onClick={handleClearSelection}
                      style={{
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: 10,
                        padding: '8px 14px',
                        background: 'rgba(100, 116, 139, 0.1)',
                        color: '#94a3b8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <ArrowLeft size={14} />
                      Clear
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => educator?.user_id && startVoiceCall(educator.user_id, educatorName)}
                        title="Voice call"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: 'transparent',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#e2e8f0',
                          padding: 0,
                        }}
                      >
                        <Phone size={18} />
                      </button>
                      <button
                        onClick={() => educator?.user_id && startVideoCall(educator.user_id, educatorName)}
                        title="Video call"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: 'transparent',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#e2e8f0',
                          padding: 0,
                        }}
                      >
                        <Video size={18} />
                      </button>
                      <button
                        onClick={() => setWallpaperOpen(true)}
                        title="Chat wallpaper"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: 'transparent',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#e2e8f0',
                          padding: 0,
                        }}
                      >
                        <Image size={18} />
                      </button>
                      <button
                        ref={moreButtonRef}
                        onClick={() => {
                          setOptionsMenuAnchor(moreButtonRef.current);
                          setOptionsMenuOpen(true);
                        }}
                        title="More"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: 'transparent',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#e2e8f0',
                          padding: 0,
                        }}
                      >
                        <MoreVertical size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Mobile: Fixed student name subtitle */}
              {!isDesktop && currentThread.student && (
                <div
                  style={{
                    position: 'fixed',
                    top: 68,
                    left: 0,
                    right: 0,
                    zIndex: 999,
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: 'var(--surface)',
                  }}
                >
                  <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 500 }}>📚</span>
                  <span style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>
                    {currentThread.student.first_name} {currentThread.student.last_name}
                  </span>
                </div>
              )}

              {/* Typing indicator */}
              {typingText && (
                <div style={{
                  padding: '8px 16px',
                  color: 'var(--muted)',
                  fontSize: '12px',
                  position: isDesktop ? 'relative' : 'fixed',
                  top: !isDesktop ? (currentThread.student ? 108 : 68) : undefined,
                  left: !isDesktop ? 0 : undefined,
                  right: !isDesktop ? 0 : undefined,
                  zIndex: !isDesktop ? 998 : undefined,
                  background: !isDesktop ? 'transparent' : undefined,
                }}>
                  {typingText}
                </div>
              )}

              <div
                className="hide-scrollbar"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  minHeight: 0,
                  padding: isDesktop ? '28px 0px' : '0 8px',
                  paddingTop: isDesktop ? '32px' : (currentThread.student ? '120px' : '88px'),
                  paddingBottom: isDesktop ? 100 : (currentThread.student ? 110 : 100),
                  paddingRight: isDesktop ? 340 : 8,
                  width: '100%',
                  boxSizing: 'border-box',
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
                        padding: '40px 32px',
                        borderRadius: 20,
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                      }}
                    >
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          margin: '0 auto 20px',
                          borderRadius: 36,
                          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 16px rgba(99, 102, 241, 0.2)',
                        }}
                      >
                        <Send size={30} color="#818cf8" />
                      </div>
                      <p style={{ color: '#f1f5f9', marginBottom: 10, fontSize: 17, fontWeight: 600 }}>
                        Start a conversation
                      </p>
                      <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 280, lineHeight: 1.6 }}>
                        Send a message below to connect with your educator.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? 20 : 16 }}>
                    {messages.map((message) => {
                      const isOwn = message.sender_id === userId;
                      const senderName = message.sender
                        ? `${message.sender.first_name} ${message.sender.last_name}`
                        : 'Unknown';

                      // Get other participant IDs (excluding current user) for read status
                      const otherParticipantIds = (currentThread?.message_participants || [])
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

              <div
                style={{
                  position: isDesktop ? 'absolute' : 'fixed',
                  bottom: 0,
                  left: 0,
                  right: isDesktop ? 320 : 0,
                  padding: isDesktop ? '16px 28px' : '12px 16px',
                  paddingBottom: isDesktop ? 16 : 'max(12px, env(safe-area-inset-bottom))',
                  background: isDesktop ? 'rgba(15, 23, 42, 0.95)' : 'linear-gradient(180deg, rgba(15, 23, 42, 0.0) 0%, rgba(15, 23, 42, 0.95) 15%, rgba(15, 23, 42, 1) 100%)',
                  backdropFilter: 'blur(12px)',
                  zIndex: 100,
                }}
              >
                <input
                  type="file"
                  accept="image/*,audio/*,video/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleAttachmentChange}
                />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  style={{ display: 'none' }}
                  onChange={handleAttachmentChange}
                />
                <form onSubmit={handleSendMessage} style={{ position: 'relative', marginLeft: isDesktop ? 0 : '-8px' }}>
                  {showEmojiPicker && (
                    <div
                      ref={emojiPickerRef}
                      style={{
                        position: 'absolute',
                        bottom: 70,
                        left: 12,
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        borderRadius: 16,
                        padding: 12,
                        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: 8,
                        zIndex: 20,
                      }}
                    >
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleEmojiSelect(emoji)}
                          style={{
                            fontSize: 22,
                            lineHeight: 1,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: 6,
                            borderRadius: 8,
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(100, 116, 139, 0.2)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: isDesktop ? 10 : 8, alignItems: isDesktop ? 'flex-end' : 'center', maxWidth: isDesktop ? 800 : 'none', margin: isDesktop ? '0 auto' : 0, position: 'relative' }}>
                    {/* Desktop: Icons outside input */}
                    {isDesktop && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          ref={emojiButtonRef}
                          onClick={() => setShowEmojiPicker((prev) => !prev)}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            background: 'rgba(100, 116, 139, 0.1)',
                            border: '1px solid rgba(148, 163, 184, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Smile size={22} />
                        </button>
                        <button
                          type="button"
                          onClick={triggerFilePicker}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            background: 'rgba(100, 116, 139, 0.1)',
                            border: '1px solid rgba(148, 163, 184, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Paperclip size={18} />
                        </button>
                      </div>
                    )}

                    {/* Mobile & Desktop: Input field */}
                    <div style={{ position: 'relative', flex: 1, display: 'flex', gap: 8, alignItems: 'center', zIndex: 101 }}>
                      {/* Mobile: Emoji button outside left */}
                      {!isDesktop && (
                        <button
                          type="button"
                          ref={emojiButtonRef}
                          onClick={() => setShowEmojiPicker((prev) => !prev)}
                          className="w-[44px] h-[44px] rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] shrink-0 self-end z-[101]"
                        >
                          <Smile size={20} />
                        </button>
                      )}

                      {/* Flex row container for mobile */}
                      <div style={isDesktop ? { position: 'relative', flex: 1 } : undefined} className={!isDesktop ? 'flex flex-row items-end flex-1 gap-4 px-5 py-4 rounded-[28px] border-0 bg-[rgba(30,41,59,0.95)] backdrop-blur-xl z-[101]' : ''}>
                        <textarea
                          value={messageText}
                          onChange={(e) => {
                            setMessageText(e.target.value);
                            startTyping();
                            if (!isDesktop) {
                              const ta = e.target as HTMLTextAreaElement;
                              ta.style.height = 'auto';
                              ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
                            }
                          }}
                          onBlur={() => { try { stopTyping(); } catch {} }}
                          placeholder="Type a message"
                          disabled={sending || attachmentUploading}
                          rows={1}
                          className={!isDesktop ? 'flex-1 min-h-[36px] py-2 px-1 bg-transparent text-[var(--text)] text-[16px] outline-none resize-none max-h-[120px] leading-[28px] placeholder:text-[var(--muted)] placeholder:pb-[10px] focus:outline-none focus:ring-0 focus:border-0' : ''}
                          style={isDesktop ? {
                            width: '100%',
                            padding: '14px 20px',
                            borderRadius: 26,
                            border: '1px solid var(--border)',
                            background: 'var(--bg)',
                            color: 'var(--text)',
                            fontSize: 15,
                            outline: 'none',
                            resize: 'none',
                            maxHeight: 120,
                          } : { height: '36px', border: 'none', outline: 'none', paddingBottom: '10px' }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage(e);
                              if (!isDesktop) (e.currentTarget as HTMLTextAreaElement).style.height = '36px';
                            }
                          }}
                        />
                        {/* Mobile: Camera (autohides), Clip - SMALLER ICONS */}
                        {!isDesktop && (
                          <>
                            {!messageText.trim() && (
                              <button
                                type="button"
                                onClick={() => cameraInputRef.current?.click()}
                                disabled={attachmentUploading}
                                className={`text-[var(--muted)] shrink-0 p-1 ${attachmentUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ paddingBottom: '10px' }}>
                                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                  <circle cx="12" cy="13" r="4"/>
                                </svg>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={triggerFilePicker}
                              disabled={attachmentUploading}
                              className={`text-[var(--muted)] shrink-0 p-1 ${attachmentUploading ? 'opacity-50' : ''}`}
                            >
                              <Paperclip size={28} style={{ paddingBottom: '10px', paddingRight: '5' }} />
                            </button>
                          </>
                        )}
                      </div>

                      {/* Mobile: Send/Mic outside right */}
                      {!isDesktop && (
                        messageText.trim() ? (
                          <button
                            type="submit"
                            disabled={sending || attachmentUploading}
                            className={`w-[40px] h-[40px] rounded-full border-0 flex items-center justify-center ml-1 self-end z-[99999] ${sending || attachmentUploading ? 'bg-[var(--muted)] cursor-not-allowed' : 'bg-[var(--primary)] shadow-[0_4px_12px_rgba(124,58,237,0.4)]'}`}
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
                              className={`w-[40px] h-[40px] rounded-full border-0 flex items-center justify-center ml-1 self-end z-[101] ${isRecording ? 'bg-[var(--warning)] shadow-[0_4px_12px_rgba(245,158,11,0.4)]' : 'bg-[var(--cyan)] shadow-[0_4px_12px_rgba(0,245,255,0.4)]'}`}
                            >
                              <Mic size={18} color="white" />
                            </button>
                          )
                      )}
                    </div>

                    {/* Desktop: Send/Mic button outside */}
                    {isDesktop && (
                      messageText.trim() ? (
                        <button
                          type="submit"
                          disabled={sending || attachmentUploading}
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            background:
                              sending || attachmentUploading
                                ? '#475569'
                                : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: sending || attachmentUploading ? 'not-allowed' : 'pointer',
                            boxShadow:
                              sending || attachmentUploading ? 'none' : '0 4px 14px rgba(59, 130, 246, 0.4)',
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
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            background: isRecording 
                              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                              : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            flexShrink: 0,
                            boxShadow: isRecording 
                              ? '0 4px 14px rgba(245, 158, 11, 0.4)' 
                              : '0 4px 14px rgba(34, 197, 94, 0.4)',
                          }}
                        >
                          <Mic size={22} color="white" />
                        </button>
                      )
                    )}
                  </div>
                </form>
                {statusMessage && (
                  <p style={{ marginTop: 10, fontSize: 13, color: '#f87171', textAlign: 'center' }}>{statusMessage}</p>
                )}
                {attachmentUploading && uploadProgress !== null && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Uploading... {Math.round(uploadProgress)}%</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(100, 116, 139, 0.2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                          transition: 'width 0.3s ease',
                          width: `${uploadProgress}%`,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            isDesktop && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                paddingRight: 0,
                background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
              }}
            >
              <div
                style={{
                  maxWidth: 360,
                  padding: 40,
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 20px 80px rgba(15, 23, 42, 0.25)',
                }}
              >
                <div style={{ 
                  width: 120, 
                  height: 120, 
                  margin: '0 auto 24px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)'
                }}>
                  <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
                    <path d="M20 30L50 60L80 30" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20 50L50 80L80 50" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 12, textAlign: 'center' }}>
                  EduDash Pro Messages
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 15, lineHeight: 1.5, textAlign: 'center' }}>
                  Send private, secure messages between parents and teachers.
                </p>
              </div>
            </div>
            )
          )}
        </div>

        {false && isDesktop && (
          <div
            style={{
              position: 'fixed',
              right: 0,
              top: 'var(--topnav-h)',
              bottom: 0,
              width: 320,
              borderLeft: '1px solid rgba(148, 163, 184, 0.1)',
              background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 20,
              boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div style={{ 
              padding: '20px 16px 16px', 
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              background: 'rgba(15, 23, 42, 0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: 18, 
                  fontWeight: 700, 
                  color: '#f1f5f9',
                  letterSpacing: '-0.01em',
                }}>
                  Conversations
                </h3>
                {totalUnread > 0 && (
                  <span style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 12,
                    boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
                  }}>
                    {totalUnread} new
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: 12,
                    border: '1px solid rgba(148, 163, 184, 0.15)',
                    background: 'rgba(30, 41, 59, 0.6)',
                    color: '#e2e8f0',
                    fontSize: 14,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                />
                <Search
                  size={18}
                  color="#64748b"
                  style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
              {threadsLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }}></div>
                </div>
              ) : error ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <p style={{ color: '#f87171', fontSize: 14, marginBottom: 16 }}>Failed to load messages</p>
                  <button 
                    className="btn btnSecondary" 
                    onClick={fetchThreads}
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#60a5fa',
                      padding: '8px 16px',
                      borderRadius: 8,
                      cursor: 'pointer',
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
                    onSelect={() => handleSelectThread(thread.id)}
                    onDelete={handleDeleteThread}
                    isDesktop={isDesktop}
                  />
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    margin: '0 auto 16px',
                    borderRadius: 32,
                    background: 'rgba(100, 116, 139, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <MessageSquare size={28} color="#64748b" />
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: 15, fontWeight: 500 }}>No conversations yet</p>
                  <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Messages will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <CallInterface
        isOpen={callState.isOpen}
        onClose={closeCall}
        callType={callState.callType}
        remoteUserId={callState.remoteUserId}
        remoteUserName={callState.remoteUserName}
      />
      <MessageOptionsMenu
        isOpen={optionsMenuOpen}
        onClose={() => setOptionsMenuOpen(false)}
        onDeleteThread={handleOptionsDeleteThread}
        onClearConversation={handleClearConversation}
        onBlockUser={handleBlockUser}
        onExportChat={handleExportChat}
        onReportIssue={handleReportIssue}
        anchorEl={optionsMenuAnchor}
      />
      <ChatWallpaperPicker
        isOpen={wallpaperOpen}
        onClose={() => setWallpaperOpen(false)}
        userId={userId || ''}
        onSelect={applyWallpaper}
      />
      <MessageActionsMenu
        isOpen={messageActionsOpen}
        onClose={() => setMessageActionsOpen(false)}
        position={messageActionsPosition}
        isOwnMessage={messages.find(m => m.id === selectedMessageId)?.sender_id === userId}
        onReply={() => selectedMessageId && handleReplyMessage(selectedMessageId)}
        onForward={() => selectedMessageId && handleForwardMessage(selectedMessageId)}
        onEdit={() => selectedMessageId && handleEditMessage(selectedMessageId)}
        onDelete={() => selectedMessageId && handleDeleteMessage(selectedMessageId)}
        onCopy={() => selectedMessageId && handleCopyMessage(selectedMessageId)}
        onReact={() => selectedMessageId && handleReactToMessage(selectedMessageId)}
      />
    </ParentShell>
  );
}
