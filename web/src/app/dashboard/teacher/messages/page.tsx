'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { MessageCircle, Search, Send, Smile, Paperclip, Mic, Loader2, ArrowLeft, MoreVertical, Phone, Video, Image as ImageIcon, Camera, Plus, Sparkles } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { ChatMessageBubble, type ChatMessage } from '@/components/messaging/ChatMessageBubble';
import { useComposerEnhancements, EMOJI_OPTIONS } from '@/lib/messaging/useComposerEnhancements';
import { useTypingIndicator } from '@/lib/hooks/useTypingIndicator';
import { useCall, QuickCallModal } from '@/components/calls';
import { ChatWallpaperPicker } from '@/components/messaging/ChatWallpaperPicker';
import { MessageOptionsMenu } from '@/components/messaging/MessageOptionsMenu';
import { MessageActionsMenu } from '@/components/messaging/MessageActionsMenu';
import { NewChatModal } from '@/components/messaging/NewChatModal';
import { InviteContactModal } from '@/components/messaging/InviteContactModal';
import { DashAIAvatar } from '@/components/dash/DashAIAvatar';
import { TypingIndicatorBubble } from '@/components/messaging/TypingIndicatorBubble';
import { VoiceRecordingOverlay } from '@/components/messaging/VoiceRecordingOverlay';

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
    read_at?: string | null;
    delivered_at?: string | null;
  };
  unread_count?: number;
}

const formatMessageTime = (timestamp: string | undefined | null): string => {
  if (!timestamp) return '';
  
  const now = new Date();
  const messageTime = new Date(timestamp);
  
  // Handle invalid dates
  if (isNaN(messageTime.getTime())) return '';
  
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
  currentUserId?: string;
}

// Dash AI Virtual Contact Constants (same as parent page)
const DASH_AI_THREAD_ID = 'dash-ai-assistant';
const DASH_AI_USER_ID = 'dash-ai-system';

// Create virtual Dash AI thread that appears as a contact
const createDashAIThread = (lastMessage?: string, lastMessageAt?: string): MessageThread => ({
  id: DASH_AI_THREAD_ID,
  type: 'dash_ai',
  subject: 'Dash AI',
  student_id: null,
  last_message_at: lastMessageAt || new Date().toISOString(),
  message_participants: [
    {
      user_id: DASH_AI_USER_ID,
      role: 'ai_assistant',
      user_profile: {
        first_name: 'Dash',
        last_name: 'AI',
        role: 'ai_assistant',
      },
    },
  ],
  last_message: lastMessage ? {
    content: lastMessage,
    created_at: lastMessageAt || new Date().toISOString(),
    sender_id: DASH_AI_USER_ID,
  } : {
    content: 'Hi! I\'m Dash, your AI teaching assistant. I can help with lesson plans, activities, and more! 🎓',
    created_at: new Date().toISOString(),
    sender_id: DASH_AI_USER_ID,
  },
  unread_count: 0,
});

const ThreadItem = ({ thread, isActive, onSelect, currentUserId }: ThreadItemProps) => {
  const isDashAI = thread.id === DASH_AI_THREAD_ID || thread.type === 'dash_ai';
  const participants = thread.message_participants || thread.participants || [];
  // Find the OTHER participant (the contact, not the current user)
  const otherParticipant = participants.find((p) => p.user_id !== currentUserId) || participants.find((p) => p.role === 'parent');
  const contactName = isDashAI ? 'Dash AI' : (otherParticipant?.user_profile
    ? `${otherParticipant.user_profile.first_name} ${otherParticipant.user_profile.last_name}`.trim()
    : 'Contact');
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

  // Get message status ticks for own messages
  const getMessageStatus = () => {
    if (!thread.last_message || thread.last_message.sender_id !== currentUserId) return null;
    const msg = thread.last_message;
    // read = double tick blue, delivered = double tick gray, sent = single tick
    if (msg.read_at) return { ticks: '✓✓', color: '#34d399' }; // Green double tick for read
    if (msg.delivered_at) return { ticks: '✓✓', color: 'rgba(148, 163, 184, 0.6)' }; // Gray double tick
    return { ticks: '✓', color: 'rgba(148, 163, 184, 0.6)' }; // Single gray tick
  };

  const messageStatus = getMessageStatus();

  // Role-based gradient backgrounds
  const getBackgroundGradient = () => {
    if (isDashAI) {
      return isActive 
        ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(236, 72, 153, 0.2) 100%)'
        : 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.05) 100%)';
    }
    return isActive
      ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%)'
      : 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)';
  };

  const getAvatarGradient = () => {
    if (isDashAI) return 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)';
    return 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)';
  };

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '14px 16px',
        margin: '4px 8px',
        borderRadius: 16,
        cursor: 'pointer',
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        transition: 'all 0.25s ease',
        background: getBackgroundGradient(),
        border: isActive 
          ? isDashAI
            ? '1px solid rgba(168, 85, 247, 0.3)'
            : '1px solid rgba(59, 130, 246, 0.3)'
          : '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: isActive 
          ? isDashAI
            ? '0 4px 20px rgba(168, 85, 247, 0.2), 0 0 30px rgba(168, 85, 247, 0.1)'
            : '0 4px 16px rgba(59, 130, 246, 0.15)'
          : 'none',
        width: 'calc(100% - 16px)',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = isDashAI 
            ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(236, 72, 153, 0.15) 100%)'
            : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)';
          e.currentTarget.style.transform = 'translateX(4px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = getBackgroundGradient();
          e.currentTarget.style.transform = 'translateX(0)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      {/* Avatar - All contacts get gradient avatars */}
      {isDashAI ? (
        <DashAIAvatar size={48} showStars={true} animated={isActive} />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            background: getAvatarGradient(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            transition: 'all 0.25s ease',
          }}
        >
          {getInitials(contactName)}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: hasUnread ? 700 : 600,
                color: isDashAI ? '#e879f9' : (hasUnread ? '#f1f5f9' : '#e2e8f0'),
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '0.01em',
              }}
            >
              {contactName}
            </span>
            {isDashAI && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                color: '#fff',
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                padding: '3px 8px',
                borderRadius: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: '0 2px 8px rgba(168, 85, 247, 0.4)',
              }}>
                AI
              </span>
            )}
          </div>
          {thread.last_message?.created_at && (
            <span style={{ 
              fontSize: 11, 
              color: hasUnread ? '#a78bfa' : '#64748b', 
              fontWeight: hasUnread ? 600 : 400,
              flexShrink: 0,
              marginLeft: 8,
            }}>
              {formatMessageTime(thread.last_message.created_at)}
            </span>
          )}
        </div>
        {isDashAI ? (
          <p style={{
            margin: '0 0 4px 0',
            fontSize: 12,
            color: '#22d3ee',
            fontWeight: 500,
          }}>
            ✨ AI Assistant for lesson planning & grading
          </p>
        ) : studentName && (
          <p style={{
            margin: '0 0 4px 0',
            fontSize: 12,
            color: '#a78bfa',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}>
            📚 {studentName}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {messageStatus && (
            <span style={{ 
              fontSize: 13, 
              fontWeight: 600,
              color: messageStatus.color,
              letterSpacing: '-3px',
              marginRight: 4,
              flexShrink: 0,
            }}>
              {messageStatus.ticks}
            </span>
          )}
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
        </div>
      </div>
      {hasUnread && (
        <div
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>
            {thread.unread_count && thread.unread_count > 9 ? '9+' : thread.unread_count}
          </span>
        </div>
      )}
    </div>
  );
};

function TeacherMessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadFromUrl = searchParams.get('thread');
  useBodyScrollLock(true);
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(threadFromUrl);
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
  const { startVoiceCall, startVideoCall } = useCall();

  // Chat wallpaper state with localStorage persistence
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [wallpaperCss, setWallpaperCss] = useState<string | null>(null);

  // Presets mapping (shared)
  const presetMapTeacher: Record<string, string> = {
    'purple-glow': 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
    'midnight': 'linear-gradient(180deg, #0a0f1e 0%, #1a1a2e 50%, #0a0f1e 100%)',
    'ocean-deep': 'linear-gradient(180deg, #0c4a6e 0%, #164e63 50%, #0f172a 100%)',
    'forest-night': 'linear-gradient(180deg, #14532d 0%, #1e3a3a 50%, #0f172a 100%)',
    'sunset-warm': 'linear-gradient(180deg, #7c2d12 0%, #4a1d1d 50%, #0f172a 100%)',
    'dark-slate': 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
  };

  // Load wallpaper from localStorage on mount
  useEffect(() => {
    const savedWallpaper = localStorage.getItem('edudash-chat-wallpaper');
    if (savedWallpaper) {
      try {
        const parsed = JSON.parse(savedWallpaper);
        if (parsed.type === 'url') {
          setWallpaperCss(`url(${parsed.value}) center/cover no-repeat fixed`);
        } else if (parsed.type === 'preset' && presetMapTeacher[parsed.value]) {
          setWallpaperCss(presetMapTeacher[parsed.value]);
        }
      } catch (e) {
        console.error('Failed to load wallpaper:', e);
      }
    }
  }, []);

  // Message options menu state
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [optionsMenuAnchor, setOptionsMenuAnchor] = useState<HTMLElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // Message actions menu state
  const [messageActionsOpen, setMessageActionsOpen] = useState(false);
  const [messageActionsPosition, setMessageActionsPosition] = useState({ x: 0, y: 0 });
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  // New Chat modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showQuickCallModal, setShowQuickCallModal] = useState(false);

  // Dash AI state
  const [dashAIMessages, setDashAIMessages] = useState<ChatMessage[]>([]);
  const [dashAILastMessage, setDashAILastMessage] = useState<string>('Hi! I\'m Dash, your AI teaching assistant. I can help with lesson plans, activities, and more! 🎓');
  const [dashAILastMessageAt, setDashAILastMessageAt] = useState<string>(new Date().toISOString());
  const [dashAILoading, setDashAILoading] = useState(false);

  const applyWallpaper = (sel: { type: 'preset' | 'url'; value: string }) => {
    // Save to localStorage for persistence
    localStorage.setItem('edudash-chat-wallpaper', JSON.stringify(sel));
    
    if (sel.type === 'url') {
      setWallpaperCss(`url(${sel.value}) center/cover no-repeat fixed`);
      return;
    }
    // Presets mapping (mirror of ChatWallpaperPicker presets)
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

  // Auto-select thread from URL query param
  useEffect(() => {
    if (threadFromUrl && threadFromUrl !== selectedThreadId) {
      setSelectedThreadId(threadFromUrl);
    }
  }, [threadFromUrl]);

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
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
    recordingDuration,
    recordingLocked,
    handleRecordingLock,
    handleRecordingCancel,
    handleRecordingSend,
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

  // Initial scroll to bottom when messages load - use instant scroll
  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (messages.length > 0) {
      // Use instant scroll for initial load, smooth for new messages
      scrollToBottom(!initialScrollDone.current);
      initialScrollDone.current = true;
    }
  }, [messages]);

  // Reset initial scroll flag when thread changes
  useEffect(() => {
    initialScrollDone.current = false;
  }, [selectedThreadId]);

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

  useEffect(() => {
    if (selectedThreadId && userId) {
      const markAndRefresh = async () => {
        await markThreadAsRead(selectedThreadId);
        // Refresh threads to get updated last_read_at
        setTimeout(() => setRefreshTrigger(prev => prev + 1), 500);
      };
      // Mark thread as read after a brief delay to let UI render
      setTimeout(markAndRefresh, 300);
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
          read_by
        `)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      
      // Fetch sender profiles separately to avoid ambiguous FK issue
      if (!error && data && data.length > 0) {
        const senderIds = [...new Set(data.map((m: any) => m.sender_id))];
        const { data: senderProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, role')
          .in('id', senderIds);
        
        const profileMap = new Map((senderProfiles || []).map((p: any) => [p.id, p]));
        data.forEach((msg: any) => {
          msg.sender = profileMap.get(msg.sender_id) || null;
        });
      }

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

  const getThreadContactKey = (thread: MessageThread, currentUserId: string | undefined) => {
    const participants = thread.message_participants || thread.participants || [];
    // Find the OTHER participant (not the current teacher) for deduplication
    const otherParticipant = participants.find((p) => p.user_id !== currentUserId);
    if (!otherParticipant?.user_id) {
      return `thread:${thread.id}`;
    }
    // Use the other participant's user_id as the unique key for one conversation per contact
    return `contact:${otherParticipant.user_id}`;
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
      // First fetch threads with participants (no FK to profiles, so fetch separately)
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
            last_read_at
          )
        `)
        .eq('preschool_id', profile.preschoolId)
        .order('last_message_at', { ascending: false });
      
      if (threadsError) throw threadsError;
      
      // Collect unique user IDs from all participants to fetch their profiles
      const allUserIds = new Set<string>();
      (threads || []).forEach((thread: any) => {
        (thread.message_participants || []).forEach((p: any) => {
          if (p.user_id) allUserIds.add(p.user_id);
        });
      });
      
      // Fetch all participant profiles in one query
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .in('id', Array.from(allUserIds));
      
      // Create a lookup map for profiles
      const profilesMap = new Map<string, any>();
      (profilesData || []).forEach((p: any) => {
        profilesMap.set(p.id, p);
      });
      
      // Attach user_profile to each participant
      const threadsWithProfiles = (threads || []).map((thread: any) => ({
        ...thread,
        message_participants: (thread.message_participants || []).map((p: any) => ({
          ...p,
          user_profile: profilesMap.get(p.user_id) || null
        }))
      }));
      
      const uniqueThreadMap = new Map<string, any>();
      threadsWithProfiles.forEach((thread: any) => {
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
            const lastReadAt = teacherParticipant.last_read_at || '2000-01-01';
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
            last_message: lastMessage,
            unread_count: unreadCount,
          };
        })
      );
      
      // Collapse duplicates so each contact only shows a single conversation (one inbox per contact)
      const uniqueParentThreadMap = new Map<string, MessageThread>();
      threadsWithDetails.forEach((thread) => {
        const key = getThreadContactKey(thread, userId);
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
            const replacementKey = getThreadContactKey(originalSelected, userId);
            const replacement = uniqueParentThreadMap.get(replacementKey);
            setSelectedThreadId(replacement?.id || null);
          } else {
            setSelectedThreadId(null);
          }
        }
      }
    } catch (err: any) {
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
    } else {
      setMessages([]);
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
        async (payload: { new: Record<string, unknown> }) => {
          // Fetch the complete message with sender info
          const newMsg = payload.new as { id: string; thread_id: string };
          const { data: newMessage } = await supabase
            .from('messages')
            .select(`
              id,
              thread_id,
              sender_id,
              content,
              created_at,
              read_by
            `)
            .eq('id', newMsg.id)
            .single();

          if (newMessage) {
            // Fetch sender profile
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, role')
              .eq('id', newMessage.sender_id)
              .single();
            
            const messageWithSender = {
              ...newMessage,
              sender: senderProfile || null
            };

            // Add new message to state immediately (avoid full re-fetch)
            setMessages((prev) => {
              // Avoid duplicate messages
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, messageWithSender];
            });

            // Play notification sound for incoming messages
            if (newMessage.sender_id !== userId) {
              try {
                const audio = new Audio('/sounds/notification.mp3');
                audio.volume = 0.5;
                audio.play().catch(() => {});
                // Vibrate on mobile if supported
                if ('vibrate' in navigator) {
                  navigator.vibrate(100);
                }
              } catch (e) {
                // Ignore audio errors
              }
            }

            // Update thread's last message in local state
            setThreads((prev) => prev.map(t => 
              t.id === selectedThreadId 
                ? { 
                    ...t, 
                    last_message: {
                      content: newMessage.content,
                      created_at: newMessage.created_at,
                      sender_id: newMessage.sender_id
                    },
                    last_message_at: newMessage.created_at,
                    unread_count: newMessage.sender_id !== userId ? (t.unread_count || 0) + 1 : t.unread_count
                  } 
                : t
            ));

            // Scroll to bottom
            setTimeout(() => scrollToBottom(), 100);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedThreadId, supabase, userId]);

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

  // Dash AI message handling
  const loadDashAIMessages = useCallback(() => {
    try {
      const stored = localStorage.getItem('teacher-dash-ai-messages');
      if (stored) {
        const parsed = JSON.parse(stored);
        setDashAIMessages(parsed);
        if (parsed.length > 0) {
          const lastMsg = parsed[parsed.length - 1];
          setDashAILastMessage(lastMsg.content);
          setDashAILastMessageAt(lastMsg.created_at);
        }
      } else {
        // Create welcome message
        const welcomeMessage: ChatMessage = {
          id: 'dash-welcome',
          thread_id: DASH_AI_THREAD_ID,
          sender_id: DASH_AI_USER_ID,
          content: 'Hi! I\'m Dash, your AI teaching assistant. I can help with lesson plans, activities, parent communication templates, and more! 🎓',
          created_at: new Date().toISOString(),
          sender: {
            first_name: 'Dash',
            last_name: 'AI',
            role: 'ai_assistant',
          },
        };
        setDashAIMessages([welcomeMessage]);
      }
    } catch (e) {
      console.error('Failed to load Dash AI messages:', e);
      setDashAIMessages([]);
    }
  }, []);

  const saveDashAIMessages = useCallback((msgs: ChatMessage[]) => {
    try {
      localStorage.setItem('teacher-dash-ai-messages', JSON.stringify(msgs));
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        setDashAILastMessage(lastMsg.content);
        setDashAILastMessageAt(lastMsg.created_at);
      }
    } catch (e) {
      console.error('Failed to save Dash AI messages:', e);
    }
  }, []);

  const sendDashAIMessage = useCallback(async (content: string) => {
    if (!content.trim() || !userId) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      thread_id: DASH_AI_THREAD_ID,
      sender_id: userId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      sender: {
        first_name: profile?.firstName || 'Teacher',
        last_name: profile?.lastName || '',
        role: 'teacher',
      },
    };

    const updatedMessages = [...dashAIMessages, userMsg];
    setDashAIMessages(updatedMessages);
    saveDashAIMessages(updatedMessages);
    setDashAILoading(true);
    setTimeout(() => scrollToBottom(), 100);

    try {
      // Call the AI proxy
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          context: 'teacher_assistant',
          history: dashAIMessages.slice(-10).map(m => ({
            role: m.sender_id === DASH_AI_USER_ID ? 'assistant' : 'user',
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error('AI request failed');

      const data = await response.json();
      const aiResponse = data.response || data.message || 'I apologize, I couldn\'t process that request. Please try again.';

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        thread_id: DASH_AI_THREAD_ID,
        sender_id: DASH_AI_USER_ID,
        content: aiResponse,
        created_at: new Date().toISOString(),
        sender: {
          first_name: 'Dash',
          last_name: 'AI',
          role: 'ai_assistant',
        },
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setDashAIMessages(finalMessages);
      saveDashAIMessages(finalMessages);
    } catch (err) {
      console.error('Dash AI error:', err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        thread_id: DASH_AI_THREAD_ID,
        sender_id: DASH_AI_USER_ID,
        content: 'I\'m having trouble connecting right now. Please try again in a moment. 🔄',
        created_at: new Date().toISOString(),
        sender: {
          first_name: 'Dash',
          last_name: 'AI',
          role: 'ai_assistant',
        },
      };
      const errorMessages = [...updatedMessages, errorMsg];
      setDashAIMessages(errorMessages);
      saveDashAIMessages(errorMessages);
    } finally {
      setDashAILoading(false);
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [dashAIMessages, userId, profile, saveDashAIMessages]);

  // Load Dash AI messages when thread is selected
  useEffect(() => {
    if (selectedThreadId === DASH_AI_THREAD_ID) {
      loadDashAIMessages();
    }
  }, [selectedThreadId, loadDashAIMessages]);

  // Early return for loading state - MUST be after all hooks
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

    // Handle Dash AI messages separately
    if (selectedThreadId === DASH_AI_THREAD_ID) {
      const content = messageText.trim();
      setMessageText('');
      await sendDashAIMessage(content);
      return;
    }

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

  const filteredThreads = (() => {
    const query = searchQuery.toLowerCase();
    
    // Create the Dash AI virtual thread
    const dashAIThread = createDashAIThread(dashAILastMessage, dashAILastMessageAt);
    
    // Filter regular threads
    const filtered = threads.filter((thread) => {
      if (!query) return true;
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
    
    // Check if Dash AI matches search
    const dashAIMatches = !query || 
      'dash ai'.includes(query) || 
      'ai assistant'.includes(query) ||
      'teaching assistant'.includes(query) ||
      dashAIThread.last_message?.content?.toLowerCase().includes(query);
    
    // Always put Dash AI at the top if it matches the search
    return dashAIMatches ? [dashAIThread, ...filtered] : filtered;
  })();

  const totalUnread = threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);
  const isDashAISelected = selectedThreadId === DASH_AI_THREAD_ID;
  const selectedThread = isDashAISelected 
    ? createDashAIThread(dashAILastMessage, dashAILastMessageAt)
    : threads.find((thread) => thread.id === selectedThreadId);
  const selectedParticipants = selectedThread?.message_participants || selectedThread?.participants || [];
  // Find the other participant (the contact) for the chat header
  const contactParticipant = selectedParticipants?.find((p: any) => p.user_id !== userId) || selectedParticipants?.find((p: any) => p.role === 'parent');
  const contactName = isDashAISelected 
    ? 'Dash AI' 
    : contactParticipant?.user_profile
      ? `${contactParticipant.user_profile.first_name} ${contactParticipant.user_profile.last_name}`.trim()
      : 'Contact';
  
  // Display messages - use Dash AI messages when that thread is selected
  const displayMessages = isDashAISelected ? dashAIMessages : messages;

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
      // Clear local messages immediately
      setMessages([]);
      setRefreshTrigger(prev => prev + 1);
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
      <TeacherShell
        tenantSlug={tenantSlug}
        userEmail={profile?.email}
        userName={profile?.firstName}
        preschoolName={profile?.preschoolName}
        preschoolId={profile?.preschoolId}
        userId={userId}
        unreadCount={totalUnread}
        contentStyle={{ padding: 0, margin: 0, overflow: 'hidden', height: '100vh', maxHeight: '100vh', position: 'relative' }}
      >
        <div className="flex h-screen w-full overflow-hidden bg-[var(--bg)]">
          {/* Collapsible Sidebar */}
          <div
            style={{
              order: isDesktop ? 2 : 0,
              width: isDesktop ? '340px' : '100%',
              height: '100%',
              display: (!isDesktop && selectedThread) ? 'none' : 'flex',
              flexDirection: 'column',
              background: isDesktop ? '#0f172a' : '#0f172a',
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
          <div style={{
            padding: !isDesktop ? '16px 12px' : '16px',
            borderBottom: !isDesktop ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            gap: 12,
            position: !isDesktop ? 'fixed' : 'relative',
            top: !isDesktop ? 0 : 'auto',
            left: !isDesktop ? 0 : 'auto',
            right: !isDesktop ? 0 : 'auto',
            background: !isDesktop ? '#111827' : 'var(--surface-2)',
            backdropFilter: !isDesktop ? 'blur(12px)' : 'none',
            boxShadow: !isDesktop ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0_2px_8px_rgba(0,0,0,0.05)',
            zIndex: !isDesktop ? 1000 : 'auto',
            flexDirection: 'column',
            alignItems: 'stretch'
          }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              {!isDesktop && (
                <button
                  onClick={() => router.push('/dashboard/teacher')}
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
              )}
              <h2 style={{ 
                fontSize: 20, 
                fontWeight: 700, 
                color: 'var(--text-primary)', 
                margin: 0,
                flex: 1,
                textAlign: !isDesktop ? 'left' : 'left',
                marginLeft: !isDesktop ? 0 : 0
              }}>
                Messages
              </h2>
              {totalUnread > 0 && (
                <span className="bg-[var(--primary)] text-white text-[12px] font-bold px-2.5 py-1 rounded-[12px] shadow-[0_2px_8px_rgba(124,58,237,0.3)]">
                  {totalUnread}
                </span>
              )}
              <button
                onClick={() => setShowNewChatModal(true)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  border: 'none',
                  background: 'var(--primary)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
                }}
              >
                <Plus size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder={!isDesktop ? "Search..." : "Search conversations..."}
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
                  outline: 'none'
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

          {/* Threads List */}
          <div className="hide-scrollbar" style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '12px',
            paddingTop: !isDesktop ? '136px' : '12px'
          }}>
            {/* Dash AI Assistant - Always at top like Meta AI in WhatsApp */}
            <div
              onClick={() => router.push('/dashboard/teacher/dash-chat')}
              className="flex items-center gap-3 p-3.5 cursor-pointer rounded-xl mb-2 transition-all hover:scale-[1.01]"
              style={{
                background: 'linear-gradient(90deg, rgba(124, 58, 237, 0.12) 0%, rgba(6, 182, 212, 0.08) 50%, rgba(236, 72, 153, 0.08) 100%)',
                border: '1px solid rgba(124, 58, 237, 0.25)',
              }}
            >
              <DashAIAvatar size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[16px] font-semibold text-[var(--text)]">Dash AI</span>
                  <Sparkles size={14} className="text-[#a78bfa]" />
                </div>
                <p className="text-[13px] text-[var(--muted)] mt-0.5 truncate">
                  AI assistant for lesson planning & grading
                </p>
              </div>
            </div>
            
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
                  currentUserId={userId}
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
          background: wallpaperCss || 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
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
              <div className={`${isDesktop ? 'py-7 px-7' : 'py-15 px-2'} ${isDesktop ? 'border-b border-[var(--border)]' : ''} bg-[var(--surface)] [backdrop-filter:blur(12px)] flex items-center gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.08)] ${isDesktop ? 'sticky' : 'fixed'} ${isDesktop ? 'top-0' : 'top-0'} z-10 w-full ${isDesktop ? '' : 'left-0 right-0'}`}>
                {!isDesktop && (
                  <button
                    onClick={() => setSelectedThreadId(null)}
                    className="w-9 h-9 rounded-[10px] bg-transparent border-none flex items-center justify-center cursor-pointer text-[var(--text)] -ml-1"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                {isDashAISelected ? (
                  <div className={`${isDesktop ? 'w-[52px] h-[52px]' : 'w-8 h-8'} flex-shrink-0`}>
                    <DashAIAvatar size={isDesktop ? 52 : 32} />
                  </div>
                ) : (
                  <div
                    className={`${isDesktop ? 'w-[52px] h-[52px] text-[18px]' : 'w-8 h-8 text-[12px]'} rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--cyan)_100%)] flex items-center justify-center text-white font-bold shadow-[0_4px_16px_rgba(124,58,237,0.3)] flex-shrink-0`}
                  >
                    {contactName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className={`${isDesktop ? 'text-[18px]' : 'text-[16px]'} m-0 font-bold text-[var(--text)] truncate`}>
                    {contactName}
                  </h3>
                  {isDashAISelected ? (
                    <p className="mt-1 text-[13px] text-[#8b5cf6] font-medium flex items-center gap-1.5">
                      <Sparkles size={12} />
                      <span>AI Teaching Assistant</span>
                    </p>
                  ) : isDesktop && selectedThread.student && (
                    <p className="mt-1 text-[13px] text-[var(--cyan)] font-medium flex items-center gap-1.5">
                      <span>📚</span>
                      <span>{selectedThread.student.first_name} {selectedThread.student.last_name}</span>
                    </p>
                  )}
                </div>
                {!isDashAISelected && (
                <div className="flex items-center gap-2">
                  {isDesktop ? (
                    <>
                      <button
                        onClick={() => contactParticipant?.user_id && startVoiceCall(contactParticipant.user_id, contactName)}
                        title="Start voice call"
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                        style={{
                          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                          boxShadow: '0 3px 10px rgba(34, 197, 94, 0.35)',
                        }}
                      >
                        <Phone size={18} color="white" />
                      </button>
                      <button
                        onClick={() => contactParticipant?.user_id && startVideoCall(contactParticipant.user_id, contactName)}
                        title="Start video call"
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                          boxShadow: '0 3px 10px rgba(59, 130, 246, 0.35)',
                        }}
                      >
                        <Video size={18} color="white" />
                      </button>
                      <button
                        ref={moreButtonRef}
                        onClick={() => {
                          setOptionsMenuAnchor(moreButtonRef.current);
                          setOptionsMenuOpen(true);
                        }}
                        className="w-10 h-10 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] cursor-pointer hover:bg-[var(--surface)] transition-colors"
                      >
                        <MoreVertical size={20} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => contactParticipant?.user_id && startVoiceCall(contactParticipant.user_id, contactName)}
                        title="Voice call"
                        className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95"
                        style={{
                          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                          boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
                        }}
                      >
                        <Phone size={16} color="white" />
                      </button>
                      <button
                        onClick={() => contactParticipant?.user_id && startVideoCall(contactParticipant.user_id, contactName)}
                        title="Video call"
                        className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95"
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                        }}
                      >
                        <Video size={16} color="white" />
                      </button>
                      <button
                        ref={moreButtonRef}
                        type="button"
                        onClick={() => {
                          setOptionsMenuAnchor(moreButtonRef.current);
                          setOptionsMenuOpen(true);
                        }}
                        className="w-10 h-10 rounded-[10px] bg-transparent border-none flex items-center justify-center text-[var(--muted)] cursor-pointer"
                        title="More"
                      >
                        <MoreVertical size={20} />
                      </button>
                    </>
                  )}
                </div>
                )}
              </div>

              {/* Mobile: Fixed student name subtitle */}
              {!isDesktop && selectedThread.student && (
                <div 
                  className="fixed top-[40px]  left-0 right-0 z-[999] px-4 py-8 flex items-center justify-center gap-1.5"
                  style={{ background: 'var(--surface)' }}
                >
                  <span className="text-[13px] text-[var(--cyan)] font-medium">📚</span>
                  <span className="text-[13px] text-[#cbd5e1] font-medium padding-[8px]">
                    {selectedThread.student.first_name} {selectedThread.student.last_name}
                  </span>
                </div>
              )}

              {/* Messages Area */}
              <div
                className="hide-scrollbar"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: isDesktop ? '24px 28px' : '0px',
                  paddingTop: !isDesktop ? (selectedThread.student ? '100px' : '80px') : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  paddingBottom: isDesktop ? undefined : selectedThread.student ? '70px' : '60px',
                }}
              >
                <div className={`w-full ${isDesktop ? 'max-w-[860px] mx-auto px-3' : 'px-1'}`}>
                {(messagesLoading || (isDashAISelected && dashAILoading && dashAIMessages.length === 0)) ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    <div className="spinner"></div>
                  </div>
                ) : displayMessages.length === 0 ? (
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
                        background: isDashAISelected 
                          ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)'
                          : 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(0, 245, 255, 0.15) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                      }}>
                        {isDashAISelected ? <Sparkles size={32} color="#8b5cf6" /> : <Send size={32} color="var(--primary)" />}
                      </div>
                      <p style={{ color: 'var(--text)', fontSize: '17px', fontWeight: '600', marginBottom: '8px' }}>
                        {isDashAISelected ? 'Ask Dash anything!' : 'Start a conversation'}
                      </p>
                      <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.5' }}>
                        {isDashAISelected 
                          ? 'I can help with lesson plans, activity ideas, parent communication, and more! 🎓'
                          : 'Send your first message to connect with this parent'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {displayMessages.map((message) => {
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
                          onContextMenu={isDashAISelected ? undefined : handleMessageContextMenu}
                        />
                      );
                    })}
                    
                    {/* Typing indicator - shows at bottom as a chat bubble */}
                    {typingText && !isDashAISelected && (
                      <TypingIndicatorBubble 
                        senderName={contactName}
                        isDesktop={isDesktop}
                      />
                    )}
                    
                    {/* Dash AI typing indicator */}
                    {isDashAISelected && dashAILoading && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        marginTop: '8px',
                        paddingLeft: isDesktop ? 8 : 10,
                      }}>
                        <div style={{ width: isDesktop ? 36 : 32, height: isDesktop ? 36 : 32, flexShrink: 0 }}>
                          <DashAIAvatar size={isDesktop ? 36 : 32} />
                        </div>
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(236, 72, 153, 0.1) 100%)',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          borderRadius: '16px 16px 16px 4px',
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', animation: 'typing-bounce 1.2s ease-in-out infinite', animationDelay: '0s' }} />
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', animation: 'typing-bounce 1.2s ease-in-out infinite', animationDelay: '0.15s' }} />
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', animation: 'typing-bounce 1.2s ease-in-out infinite', animationDelay: '0.3s' }} />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
                </div>
              </div>

              {/* Message Composer */}
              <div className={`${isDesktop ? 'py-3 px-7 border-t border-[var(--border)]' : 'fixed bottom-0 left-0 right-0 px-3 pt-2.5'} z-[100]`} style={{ 
                background: isDesktop ? 'var(--surface)' : 'linear-gradient(180deg, rgba(15, 23, 42, 0.0) 0%, rgba(15, 23, 42, 0.95) 15%, rgba(15, 23, 42, 1) 100%)',
                backdropFilter: 'blur(12px)',
                paddingBottom: isDesktop ? undefined : 'max(10px, env(safe-area-inset-bottom))',
                boxShadow: isDesktop ? '0 -4px 20px rgba(0,0,0,0.08)' : 'none',
              }}>
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
                      <div className="wa-composer">
                        {/* Emoji button */}
                        <button
                          type="button"
                          ref={emojiButtonRef}
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="wa-composer-btn bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted)]"
                          aria-label="Emoji"
                        >
                          <Smile className="wa-icon-sm" />
                        </button>
                        
                        {/* Input container */}
                        <div className="wa-composer-input-wrap">
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
                            className="flex-1 min-w-0 min-h-[var(--composer-btn)] py-2 px-2 bg-transparent text-[var(--text)] wa-text outline-none resize-none max-h-[120px] leading-relaxed placeholder:text-[var(--muted)] focus:outline-none focus:ring-0 focus:border-0"
                            style={{ border: 'none', outline: 'none' }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                                (e.currentTarget as HTMLTextAreaElement).style.height = 'auto';
                              }
                            }}
                          />
                          {/* Camera (auto-hides when typing) */}
                          {!messageText.trim() && (
                            <button
                              type="button"
                              onClick={() => cameraInputRef.current?.click()}
                              disabled={attachmentUploading}
                              className={`text-[var(--muted)] shrink-0 p-1 ${attachmentUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                              aria-label="Camera"
                            >
                              <svg className="wa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                            className={`text-[var(--muted)] shrink-0 p-1 ${attachmentUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            aria-label="Attach file"
                          >
                            <Paperclip className="wa-icon" />
                          </button>
                        </div>
                        
                        {/* Send/Mic button */}
                        {messageText.trim() ? (
                          <button
                            type="submit"
                            disabled={sending || attachmentUploading}
                            className={`wa-composer-btn ${sending || attachmentUploading ? 'bg-[var(--muted)] cursor-not-allowed' : 'bg-[var(--primary)] shadow-[0_4px_12px_rgba(124,58,237,0.4)]'}`}
                          >
                            {sending || attachmentUploading ? (
                              <Loader2 className="wa-icon-sm animate-spin" color="white" />
                            ) : (
                              <Send className="wa-icon-sm" color="white" />
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleMicClick}
                            className="wa-composer-btn"
                            style={{
                              background: isRecording 
                                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                                : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                              boxShadow: isRecording
                                ? '0 4px 16px rgba(245, 158, 11, 0.5), 0 0 20px rgba(245, 158, 11, 0.3)'
                                : '0 4px 16px rgba(0, 212, 255, 0.4), 0 0 20px rgba(0, 212, 255, 0.25)',
                              border: '1px solid rgba(0, 212, 255, 0.3)',
                            }}
                          >
                            <Mic className="wa-icon-sm" color={isRecording ? 'white' : '#00d4ff'} />
                          </button>
                        )}
                      </div>
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
        {/* Call interface is now handled by CallProvider wrapping the app */}
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
        
        {/* New Chat Modal */}
        <NewChatModal
          isOpen={showNewChatModal}
          onClose={() => setShowNewChatModal(false)}
          onSelectContact={(contact) => {
            // TODO: Create or find thread with this contact
            console.log('Selected contact:', contact);
            setShowNewChatModal(false);
            // For now, just show an alert
            alert(`Starting chat with ${contact.first_name} ${contact.last_name}`);
          }}
          onSelectDashAI={() => {
            setShowNewChatModal(false);
            router.push('/dashboard/teacher/dash-chat');
          }}
          onInviteNew={() => {
            setShowNewChatModal(false);
            setShowInviteModal(true);
          }}
          currentUserId={userId || null}
          currentUserRole="teacher"
          preschoolId={profile?.preschoolId}
        />

        {/* Invite Contact Modal */}
        <InviteContactModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          inviterName={profile?.firstName || 'A teacher'}
          preschoolName={profile?.preschoolName}
        />
        
        {/* Quick Call Modal */}
        <QuickCallModal
          isOpen={showQuickCallModal}
          onClose={() => setShowQuickCallModal(false)}
          onVoiceCall={(userId, userName) => startVoiceCall(userId, userName)}
          onVideoCall={(userId, userName) => startVideoCall(userId, userName)}
          currentUserId={userId}
          preschoolId={profile?.preschoolId}
        />
        
        {/* Quick Call FAB - Shows when no conversation is selected */}
        {!selectedThread && (
          <button
            onClick={() => setShowQuickCallModal(true)}
            style={{
              position: 'fixed',
              bottom: isDesktop ? 24 : 'calc(150px + env(safe-area-inset-bottom))',
              right: isDesktop ? 24 : 16,
              width: 52,
              height: 52,
              borderRadius: 26,
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(34, 197, 94, 0.4), 0 0 24px rgba(34, 197, 94, 0.2)',
              zIndex: 998,
              transition: 'transform 0.2s ease',
            }}
            className="active:scale-95 hover:scale-105"
            title="Quick Call"
          >
            <Phone size={22} color="white" />
          </button>
        )}
        
        {/* Voice Recording Overlay */}
        <VoiceRecordingOverlay
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          onCancel={handleRecordingCancel}
          onSend={handleRecordingSend}
          onLock={handleRecordingLock}
          isLocked={recordingLocked}
        />
      </TeacherShell>
    </>
  );
}

// Wrap with Suspense for useSearchParams
export default function TeacherMessagesPageWrapper() {
  return (
    <Suspense fallback={
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: 'var(--bg)'
      }}>
        <div className="spinner" />
      </div>
    }>
      <TeacherMessagesPage />
    </Suspense>
  );
}
