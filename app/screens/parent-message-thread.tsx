/**
 * Parent Message Thread Screen
 * Full-featured WhatsApp-style chat interface with PWA parity
 * Features: Voice recording, wallpaper, message actions, options menu,
 *           date separators, message ticks, reply preview, typing indicators
 * 
 * Refactored to use shared messaging components from components/messaging/
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, KeyboardAvoidingView, Alert, ImageBackground, Keyboard, Vibration, TouchableOpacity, NativeScrollEvent, NativeSyntheticEvent, LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { toast } from '@/components/ui/ToastProvider';
import { useCallSafe } from '@/components/calls/CallProvider';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from '@/components/messaging/TypingIndicator';
import { logger } from '@/lib/logger';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useThreadOptions } from '@/hooks/useThreadOptions';
import { FlashList, type FlashListRef } from '@shopify/flash-list';

// Shared messaging components
import {
  Message,
  DateSeparator,
  MessageBubble,
  ChatHeader,
  MessageComposer,
  getDateKey,
  getDateSeparatorLabel,
  ForwardMessagePicker,
  ChatSearchOverlay,
  MediaGalleryView,
  StarredMessagesView,
} from '@/components/messaging';
import { MessageScheduler } from '@/components/messaging/MessageScheduler';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
// Safe imports with fallbacks
let useTheme: () => { theme: any; isDark: boolean };
let useAuth: () => { user: any; profile: any };
let useThreadMessages: (id: string | null) => { data: any[]; isLoading: boolean; error: any; refetch: () => void };
let useSendMessage: () => { mutateAsync: (args: any) => Promise<any>; isLoading: boolean };
let useMarkThreadRead: () => { mutate: (args: any) => void };
let useRealtimeMessages: (threadId: string | null) => void = () => {};
let assertSupabase: () => any;

// Component imports with fallbacks
let ChatWallpaperPicker: React.FC<any> | null = null;
let MessageActionsMenu: React.FC<any> | null = null;
let ThreadOptionsMenu: React.FC<any> | null = null;
let getStoredWallpaper: (() => Promise<any>) | null = null;
let WALLPAPER_PRESETS: any[] = [];

try {
  const wallpaperModule = require('@/components/messaging/ChatWallpaperPicker');
  ChatWallpaperPicker = wallpaperModule.ChatWallpaperPicker;
  getStoredWallpaper = wallpaperModule.getStoredWallpaper;
  WALLPAPER_PRESETS = wallpaperModule.WALLPAPER_PRESETS || [];
} catch {}

try {
  MessageActionsMenu = require('@/components/messaging/MessageActionsMenu').MessageActionsMenu;
} catch {}

try {
  ThreadOptionsMenu = require('@/components/messaging/ThreadOptionsMenu').ThreadOptionsMenu;
} catch {}

// Voice storage service
let uploadVoiceNote: ((uri: string, duration: number, conversationId?: string) => Promise<{ publicUrl: string; storagePath: string }>) | null = null;
try { uploadVoiceNote = require('@/services/VoiceStorageService').uploadVoiceNote; } catch {}

// Default theme matching PWA dark mode
const defaultTheme = {
  background: '#0f172a',
  surface: '#1e293b',
  primary: '#3b82f6',
  onPrimary: '#FFFFFF',
  text: '#e2e8f0',
  textSecondary: '#94a3b8',
  border: 'rgba(148, 163, 184, 0.15)',
  error: '#ef4444',
  elevated: '#1e293b',
};

const COMPOSER_OVERLAY_HEIGHT = 84;
const WALLPAPER_ACCENTS: Record<string, string> = {
  'purple-glow': '#a78bfa',
  midnight: '#60a5fa',
  'ocean-deep': '#38bdf8',
  'forest-night': '#4ade80',
  'sunset-warm': '#fb923c',
  'dark-slate': '#93c5fd',
};

function hexToRgba(color: string, alpha: number, fallback: string): string {
  if (!color.startsWith('#')) return fallback;
  const hex = color.slice(1);
  const normalized = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (normalized.length !== 6) return fallback;
  const intValue = Number.parseInt(normalized, 16);
  if (Number.isNaN(intValue)) return fallback;
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

try {
  useTheme = require('@/contexts/ThemeContext').useTheme;
} catch {
  useTheme = () => ({ theme: defaultTheme, isDark: true });
}

try {
  useAuth = require('@/contexts/AuthContext').useAuth;
} catch {
  useAuth = () => ({ user: null, profile: null });
}

try {
  assertSupabase = require('@/lib/supabase').assertSupabase;
} catch {
  assertSupabase = () => { throw new Error('Supabase not available'); };
}

try {
  const hooks = require('@/hooks/useParentMessaging');
  useThreadMessages = hooks.useThreadMessages;
  useSendMessage = hooks.useSendMessage;
  useMarkThreadRead = hooks.useMarkThreadRead;
  // Real-time hook - MUST be called at top-level of component, NOT inside useEffect
  useRealtimeMessages = hooks.useParentMessagesRealtime || (() => {});
} catch {
  useThreadMessages = () => ({ data: [], isLoading: false, error: null, refetch: () => {} });
  useSendMessage = () => ({ mutateAsync: async () => ({}), isLoading: false });
  useMarkThreadRead = () => ({ mutate: () => {} });
}

// ==================== MAIN SCREEN COMPONENT ====================

export default function ParentMessageThreadScreen() {
  // Route params
  const params = useLocalSearchParams<{ threadId?: string; title?: string; teacherName?: string }>();
  const threadId = params.threadId || '';
  const teacherName = params.teacherName || params.title || '';

  // Hooks
  let theme = defaultTheme;
  let user: any = null;
  
  try {
    const themeResult = useTheme();
    theme = themeResult.theme || defaultTheme;
  } catch {
    // Use default theme
  }

  try {
    const authResult = useAuth();
    user = authResult.user;
  } catch {
    // No user
  }

  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<any> | null>(null);
  const isAtBottomRef = useRef(true);

  // Typing indicator hook
  const { isOtherTyping, typingText, setTyping, clearTyping } = useTypingIndicator({
    threadId: threadId || null,
    userId: user?.id || null,
    userName: user?.email?.split('@')[0] || 'User',
  });

  // Core state
  const [sending, setSending] = useState(false);
  const [optimisticMsgs, setOptimisticMsgs] = useState<Message[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(COMPOSER_OVERLAY_HEIGHT);

  
  // Wallpaper state
  const [currentWallpaper, setCurrentWallpaper] = useState<{ type: string; value: string } | null>(null);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  
  // Menu state
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  
  // Message actions state
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  
  // Continuous voice playback state
  const [currentlyPlayingVoiceId, setCurrentlyPlayingVoiceId] = useState<string | null>(null);
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  
  // Scroll-to-bottom FAB state
  const [showScrollFab, setShowScrollFab] = useState(false);
  
  // Message scheduler state
  const [showScheduler, setShowScheduler] = useState(false);
  
  // Keyboard listeners
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  
  // Load wallpaper from storage
  useEffect(() => {
    if (getStoredWallpaper) {
      getStoredWallpaper().then(wp => {
        if (wp) setCurrentWallpaper(wp);
      }).catch(() => {});
    }
  }, []);

  // Data hooks - wrapped safely
  let messages: Message[] = [];
  let loading = false;
  let error: any = null;
  let refetch = () => {};
  let sendMessage = async (_: any) => ({});
  let markRead = (_: any) => {};

  try {
    const threadResult = useThreadMessages(threadId || null);
    messages = threadResult.data || [];
    loading = threadResult.isLoading;
    error = threadResult.error;
    refetch = threadResult.refetch;
  } catch (e) {
    if (__DEV__) logger.warn('ParentThread', 'useThreadMessages error:', e);
  }

  try {
    const sendResult = useSendMessage();
    sendMessage = sendResult.mutateAsync;
  } catch (e) {
    if (__DEV__) logger.warn('ParentThread', 'useSendMessage error:', e);
  }

  try {
    const markResult = useMarkThreadRead();
    markRead = markResult.mutate;
  } catch (e) {
    if (__DEV__) logger.warn('ParentThread', 'useMarkThreadRead error:', e);
  }

  // Combined messages with optimistic updates
  // Deduplicates by ID AND by content+sender+time match to prevent the brief
  // duplication that occurs when the realtime INSERT fires before the optimistic
  // message is removed from state.
  const allMessages = useMemo(() => {
    const ids = new Set(messages.map(m => m.id));
    const unique = optimisticMsgs.filter(m => {
      // Already replaced by real message with same ID
      if (ids.has(m.id)) return false;
      // Also filter if a real message with same content from same sender arrived within 30s
      return !messages.some(real =>
        real.sender_id === m.sender_id &&
        real.content === m.content &&
        Math.abs(new Date(real.created_at).getTime() - new Date(m.created_at).getTime()) < 30000
      );
    });
    return [...messages, ...unique].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages, optimisticMsgs]);

  // Real-time subscription for messages, delivery/read status, and reactions
  // Called at top-level (not inside useEffect) to respect Rules of Hooks
  useRealtimeMessages(threadId || null);

  // Mark messages as delivered and read when thread is opened
  // Delivered (gray ticks): When user comes online or opens thread
  // Read (blue ticks): When user actively views the thread
  useEffect(() => {
    if (threadId && messages.length > 0 && !loading && user?.id) {
      // First, mark messages as delivered (if not already)
      // This ensures ticks update even if no push notification was received
      try {
        assertSupabase().rpc('mark_messages_delivered', {
          p_thread_id: threadId,
          p_user_id: user.id,
        }).then(() => {
          if (__DEV__) {
            logger.debug('ParentThread', '✅ Marked messages as delivered');
          }
        }).catch((err: any) => {
          if (__DEV__) {
            logger.warn('ParentThread', 'Failed to mark messages as delivered:', err);
          }
        });
      } catch {}
      
      // Then mark as read (this adds user to read_by array, showing blue ticks)
      try { markRead({ threadId }); } catch {}
    }
  }, [threadId, messages.length, loading, user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!allMessages.length) return;
    if (!isAtBottomRef.current) return;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, [allMessages.length]);

  // Display name
  const displayName = useMemo(() => {
    try {
      return teacherName ? decodeURIComponent(teacherName) : t('parent.teacher', { defaultValue: 'Teacher' });
    } catch {
      return teacherName || 'Teacher';
    }
  }, [teacherName, t]);

  // Get wallpaper gradient colors
  const getWallpaperGradient = useCallback((): [string, string, ...string[]] => {
    if (!currentWallpaper || currentWallpaper.type === 'url') {
      return ['#0f172a', '#1e1b4b', '#0f172a'];
    }
    const preset = WALLPAPER_PRESETS.find((p: any) => p.key === currentWallpaper.value);
    return preset?.colors || ['#0f172a', '#1e1b4b', '#0f172a'];
  }, [currentWallpaper]);

  // Send message handler
  const handleSend = useCallback(async (content: string) => {
    if (!content || !threadId || sending) return;

    // Clear typing indicator when message is sent
    clearTyping();
    
    setSending(true);
    setReplyingTo(null);

    try {
      await sendMessage({ threadId, content });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (err) {
      logger.error('ParentMessageThread', 'Send failed:', err);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }, [threadId, sending, user?.id, sendMessage, clearTyping]);
  
  // Voice recording handler
  const handleVoiceRecording = useCallback(async (uri: string, duration: number) => {
    if (!threadId) return;
    Vibration.vibrate([0, 30, 50, 30]);
    
    const durationSecs = Math.round(duration / 1000);
    const content = `🎤 Voice (${durationSecs}s)`;
    
    try {
      // Upload to Supabase Storage
      if (uploadVoiceNote) {
        const result = await uploadVoiceNote(uri, duration, threadId);
        // Store storagePath (not publicUrl) - signed URLs expire!
        // VoiceMessageBubble will generate fresh signed URLs for playback
        await sendMessage({ 
          threadId, 
          content,
          voiceUrl: result.storagePath,
          voiceDuration: durationSecs,
        });
      } else {
        // Fallback: send as text only
        if (__DEV__) logger.warn('ParentThread', 'uploadVoiceNote not available, sending text only');
        await sendMessage({ threadId, content });
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (err) {
      logger.error('ParentThread', 'Voice send failed:', err);
      toast.error('Failed to send voice message.');
    }
  }, [threadId, user?.id, sendMessage]);

  // Image attachment handler
  const handleImageAttach = useCallback(async (uri: string, mimeType: string) => {
    if (!threadId || !user?.id) return;
    Vibration.vibrate([0, 30, 50, 30]);
    
    try {
      // Get supabase client for image upload
      const supabase = assertSupabase();
      
      // Upload image to Supabase Storage
      const extension = mimeType.split('/')[1] || 'jpg';
      const fileName = `${user.id}/${threadId}/${Date.now()}.${extension}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, blob, { contentType: mimeType });
        
      if (uploadError) throw uploadError;
      
      // Get public URL for the image
      const { data: urlData } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(fileName);
        
      // Send message with image URL embedded in content
      // Format: [image](url) - this can be parsed by message bubble component
      const content = `📷 Photo\n[image](${urlData.publicUrl})`;
      
      await sendMessage({ 
        threadId, 
        content,
      });
      
      toast.success('Photo sent');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (err) {
      logger.error('ParentThread', 'Image send failed:', err);
      toast.error('Failed to send photo.');
    }
  }, [threadId, user?.id, sendMessage]);

  // Message long press handler
  const handleMessageLongPress = useCallback((msg: Message) => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(10);
    }
    setSelectedMessage(msg);
    setShowMessageActions(true);
  }, []);

  // Get other participant info (must be defined before useThreadOptions)
  const otherParticipant = useMemo(() => messages.find(m => m.sender_id !== user?.id), [messages, user?.id]);

  // Message action handlers - extracted to hook per WARP.md
  const {
    handleReact,
    handleReactionPress,
    handleReply,
    handleCopy,
    handleForward,
    handleDelete,
    handleEdit,
    handleToggleStar,
    // Edit state & controls
    editingMessage,
    confirmEdit,
    cancelEdit,
    // Forward state & controls
    showForwardPicker,
    forwardingMessage,
    confirmForward,
    cancelForward,
  } = useMessageActions({
    selectedMessage,
    user,
    refetch,
    setSelectedMessage,
    setShowMessageActions,
    setReplyingTo,
    setOptimisticMsgs,
  });

  // Thread options handlers - extracted to hook per WARP.md
  const {
    handleClearChat,
    handleMuteNotifications,
    handleSearchInChat,
    handleExportChat,
    handleMediaLinksAndDocs,
    handleStarredMessages,
    handleDisappearingMessages,
    handleAddShortcut,
    handleReport,
    handleBlockUser,
    handleViewContact,
    // Search overlay state
    showSearchOverlay,
    searchResults,
    searchQuery,
    isSearching,
    performSearch,
    closeSearch,
    // Media gallery state
    showMediaGallery,
    closeMediaGallery,
    // Starred messages state
    showStarredMessages: showStarredView,
    closeStarredMessages,
    // Option state
    isMuted,
    isUserBlocked,
    disappearingStatusLabel,
  } = useThreadOptions({
    threadId,
    userId: user?.id,
    otherUserId: otherParticipant?.sender_id,
    refetch,
    setShowOptionsMenu,
    setOptimisticMsgs,
    displayName,
  });

  // CallProvider context for calls + presence (unified single source)
  const callContext = useCallSafe();
  
  // Derived from otherParticipant (defined above useThreadOptions)
  const recipientId = otherParticipant?.sender_id;
  const recipientName = otherParticipant?.sender?.first_name || displayName;
  const recipientRole = otherParticipant?.sender?.role || null;
  
  // Presence tracking (unified from CallProvider - no duplicate subscriptions!)
  const isOnline = recipientId && callContext ? callContext.isUserOnline(recipientId) : false;
  const lastSeenText = recipientId && callContext ? callContext.getLastSeenText(recipientId) : 'Offline';

  const handleVoiceCall = useCallback(() => {
    if (!callContext) {
      toast.warn('Voice calling is not available. Please ensure calls are enabled.', 'Voice Call');
      return;
    }
    if (!recipientId) {
      toast.warn('Cannot identify recipient. Please try again later.', 'Voice Call');
      return;
    }
    callContext.startVoiceCall(recipientId, recipientName);
  }, [callContext, recipientId, recipientName]);

  const handleVideoCall = useCallback(() => {
    if (!callContext) {
      toast.warn('Video calling is not available. Please ensure calls are enabled.', 'Video Call');
      return;
    }
    if (!recipientId) {
      toast.warn('Cannot identify recipient. Please try again later.', 'Video Call');
      return;
    }
    callContext.startVideoCall(recipientId, recipientName);
  }, [callContext, recipientId, recipientName]);

  type ChatRow =
    | { type: 'date'; key: string; label: string }
    | { type: 'message'; key: string; msg: Message };

  const voiceMessageIdsAsc = useMemo(() => {
    return allMessages.filter((m) => m.voice_url).map((m) => m.id);
  }, [allMessages]);

  const rowsAsc = useMemo<ChatRow[]>(() => {
    const rows: ChatRow[] = [];
    let lastDateKey = '';

    for (const msg of allMessages) {
      const dateKey = getDateKey(msg.created_at);
      if (dateKey !== lastDateKey) {
        rows.push({
          type: 'date',
          key: `date-${dateKey}`,
          label: getDateSeparatorLabel(msg.created_at),
        });
        lastDateKey = dateKey;
      }
      rows.push({ type: 'message', key: `msg-${msg.id}`, msg });
    }

    return rows;
  }, [allMessages]);

  const renderRow = useCallback(({ item }: { item: ChatRow }) => {
    if (item.type === 'date') {
      return <DateSeparator label={item.label} />;
    }

    const msg = item.msg;
    const voiceIndex = msg.voice_url ? voiceMessageIdsAsc.indexOf(msg.id) : -1;
    const hasNextVoice = voiceIndex >= 0 && voiceIndex < voiceMessageIdsAsc.length - 1;
    const hasPreviousVoice = voiceIndex > 0;

    const handleVoiceFinished = msg.voice_url
      ? () => {
          if (__DEV__) logger.debug('ParentThread', 'Voice finished, hasNextVoice:', hasNextVoice, 'voiceIndex:', voiceIndex);
          if (hasNextVoice) {
            setCurrentlyPlayingVoiceId(voiceMessageIdsAsc[voiceIndex + 1]);
          } else {
            setCurrentlyPlayingVoiceId(null);
          }
        }
      : undefined;

    const handlePlayNext = hasNextVoice
      ? () => setCurrentlyPlayingVoiceId(voiceMessageIdsAsc[voiceIndex + 1])
      : undefined;

    const handlePlayPrevious = hasPreviousVoice
      ? () => setCurrentlyPlayingVoiceId(voiceMessageIdsAsc[voiceIndex - 1])
      : undefined;

    const shouldAutoPlay = !!msg.voice_url && currentlyPlayingVoiceId === msg.id;

    return (
      <MessageBubble
        msg={msg}
        isOwn={msg.sender_id === user?.id}
        onLongPress={() => handleMessageLongPress(msg)}
        onPlaybackFinished={handleVoiceFinished}
        onPlayNext={handlePlayNext}
        onPlayPrevious={handlePlayPrevious}
        hasNextVoice={hasNextVoice}
        hasPreviousVoice={hasPreviousVoice}
        autoPlayVoice={shouldAutoPlay}
        onReactionPress={handleReactionPress}
      />
    );
  }, [currentlyPlayingVoiceId, handleMessageLongPress, handleReactionPress, logger, user?.id, voiceMessageIdsAsc]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingToBottom = 120;
    const atBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    isAtBottomRef.current = atBottom;
    setShowScrollFab(!atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
    setShowScrollFab(false);
  }, []);

  const handleComposerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    if (nextHeight > 0 && Math.abs(nextHeight - composerHeight) > 1) {
      setComposerHeight(nextHeight);
    }
  }, [composerHeight]);

  const composerBottomInset = Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 2);
  const safeComposerHeight = Math.max(composerHeight, COMPOSER_OVERLAY_HEIGHT);
  const messageViewportInset =
    keyboardHeight +
    composerBottomInset +
    safeComposerHeight;
  const messageBottomReserve = 24;
  const wallpaperAccent =
    currentWallpaper?.type === 'preset'
      ? (WALLPAPER_ACCENTS[currentWallpaper.value] || '#93c5fd')
      : '#93c5fd';
  const composerSurfaceColor =
    currentWallpaper?.type === 'url'
      ? 'rgba(15, 23, 42, 0.9)'
      : currentWallpaper?.type === 'preset'
      ? hexToRgba(wallpaperAccent, 0.28, 'rgba(15, 23, 42, 0.82)')
      : 'rgba(15, 23, 42, 0.75)';
  const composerBorderColor =
    currentWallpaper?.type === 'preset'
      ? hexToRgba(wallpaperAccent, 0.45, 'rgba(148, 163, 184, 0.22)')
      : 'rgba(148, 163, 184, 0.22)';

  // No thread ID error state
  if (!threadId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.text }]}>Invalid message thread</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={() => router.back()}>
            <Text style={[styles.btnText, { color: theme.onPrimary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <ChatHeader
        displayName={displayName}
        isOnline={isOnline}
        lastSeenText={lastSeenText}
        isLoading={loading}
        isTyping={isOtherTyping}
        typingText={typingText}
        recipientRole={recipientRole}
        onVoiceCall={handleVoiceCall}
        onVideoCall={handleVideoCall}
        onOptionsPress={() => setShowOptionsMenu(true)}
      />

      {/* Content area below header - wallpaper covers messages + composer */}
      <View style={styles.contentArea}>
        {/* Full-screen wallpaper layer */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {currentWallpaper?.type === 'url' ? (
            <ImageBackground
              source={{ uri: currentWallpaper.value }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            >
              <View style={styles.wallpaperOverlay} />
            </ImageBackground>
          ) : (
            <LinearGradient
              colors={getWallpaperGradient()}
              style={StyleSheet.absoluteFillObject}
            />
          )}
        </View>

        {/* Messages area - clips messages at boundary */}
        <View style={[styles.messagesClip, { marginBottom: messageViewportInset }]}>
          {loading ? (
            <View style={styles.center}>
              <EduDashSpinner size="large" color={theme.primary} />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
              <Text style={styles.errorText}>Failed to load messages</Text>
              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={refetch}>
                <Text style={[styles.btnText, { color: theme.onPrimary }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : allMessages.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color="rgba(255,255,255,0.4)" />
              <Text style={styles.emptyTitle}>Start the Conversation</Text>
              <Text style={styles.emptySub}>
                Send your first message to {displayName}
              </Text>
            </View>
          ) : (
            <FlashList
              ref={listRef}
              data={rowsAsc}
              renderItem={renderRow}
              keyExtractor={(item) => item.key}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.messagesContent,
                {
                  // Keep the final bubble clear of quick replies + composer overlays.
                  paddingBottom: messageBottomReserve,
                },
              ]}
            />
          )}

          {/* Subtle bottom fade - works with any wallpaper */}
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)']}
            style={styles.messagesBottomFade}
          />
        </View>

        {/* Scroll to bottom FAB */}
        {showScrollFab && (
          <TouchableOpacity
            style={[
              styles.scrollToBottomFab,
              {
                bottom:
                  messageViewportInset +
                  8,
              },
            ]}
            onPress={scrollToBottom}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-down" size={22} color="#e2e8f0" />
          </TouchableOpacity>
        )}

        {/* Typing Indicator - show above composer */}
        {isOtherTyping && (
          <View style={[
            styles.typingIndicatorContainer,
            { 
              bottom:
                messageViewportInset +
                4,
            }
          ]}>
            <View style={styles.typingIndicatorBubble}>
              <TypingIndicator color="#94a3b8" size={5} />
              <Text style={styles.typingIndicatorText}>{typingText}</Text>
            </View>
          </View>
        )}

        {/* Floating Composer - glass effect lets wallpaper show through */}
        <View style={[
          styles.composerArea,
          { 
            bottom: keyboardHeight,
            paddingBottom: composerBottomInset,
          }
        ]}
          onLayout={handleComposerLayout}
        >
          <View
            style={[
              styles.composerGlass,
              {
                backgroundColor: composerSurfaceColor,
                borderTopColor: composerBorderColor,
              },
            ]}
          />
          <MessageComposer
            onSend={editingMessage ? confirmEdit : handleSend}
            onVoiceRecording={handleVoiceRecording}
            onImageAttach={handleImageAttach}
            sending={sending}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onTyping={setTyping}
            editingMessage={editingMessage}
            onCancelEdit={cancelEdit}
          />
        </View>
      </View>
      
      {/* Thread Options Menu */}
      {ThreadOptionsMenu && (
        <ThreadOptionsMenu
          visible={showOptionsMenu}
          onClose={() => setShowOptionsMenu(false)}
          onChangeWallpaper={() => {
            setShowOptionsMenu(false);
            setShowWallpaperPicker(true);
          }}
          onMuteNotifications={handleMuteNotifications}
          onSearchInChat={handleSearchInChat}
          onClearChat={handleClearChat}
          onExportChat={handleExportChat}
          onMediaLinksAndDocs={handleMediaLinksAndDocs}
          onStarredMessages={handleStarredMessages}
          onDisappearingMessages={handleDisappearingMessages}
          onAddShortcut={handleAddShortcut}
          onReport={handleReport}
          onBlockUser={handleBlockUser}
          onViewContact={handleViewContact}
          isMuted={isMuted}
          isBlocked={isUserBlocked}
          disappearingLabel={disappearingStatusLabel}
          contactName={displayName}
        />
      )}
      
      {/* Wallpaper Picker */}
      {ChatWallpaperPicker && (
        <ChatWallpaperPicker
          isOpen={showWallpaperPicker}
          onClose={() => setShowWallpaperPicker(false)}
          onSelect={(selection: any) => {
            setCurrentWallpaper(selection);
            setShowWallpaperPicker(false);
          }}
        />
      )}
      
      {/* Message Actions Menu */}
      {MessageActionsMenu && selectedMessage && (
        <MessageActionsMenu
          visible={showMessageActions}
          onClose={() => {
            setShowMessageActions(false);
            setSelectedMessage(null);
          }}
          messageId={selectedMessage.id}
          messageContent={selectedMessage.content}
          isOwnMessage={selectedMessage.sender_id === user?.id}
          onReact={handleReact}
          onReply={handleReply}
          onCopy={handleCopy}
          onForward={handleForward}
          onDelete={handleDelete}
          onEdit={selectedMessage.sender_id === user?.id ? handleEdit : undefined}
          onStar={handleToggleStar}
        />
      )}

      {/* Forward Message Picker */}
      <ForwardMessagePicker
        visible={showForwardPicker}
        onSelect={confirmForward}
        onCancel={cancelForward}
      />

      {/* Chat Search Overlay */}
      <ChatSearchOverlay
        visible={showSearchOverlay}
        query={searchQuery}
        results={searchResults as any[]}
        isSearching={isSearching}
        onSearch={performSearch}
        onClose={closeSearch}
      />

      {/* Media Gallery */}
      <MediaGalleryView
        visible={showMediaGallery}
        threadId={threadId}
        onClose={closeMediaGallery}
      />

      {/* Starred Messages */}
      <StarredMessagesView
        visible={showStarredView}
        threadId={threadId}
        onClose={closeStarredMessages}
      />

      {/* Message Scheduler */}
      <MessageScheduler
        visible={showScheduler}
        onClose={() => setShowScheduler(false)}
        onSchedule={(scheduledAt) => {
          toast.success(`Message scheduled for ${scheduledAt.toLocaleString()}`);
          setShowScheduler(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#0f172a',
  },
  contentArea: {
    flex: 1,
    position: 'relative',
  },
  wallpaperOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  messagesClip: {
    flex: 1,
    overflow: 'hidden',
    zIndex: 1,
  },
  messagesBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  messages: { 
    flex: 1,
  },
  messagesContent: { 
    paddingHorizontal: 12,
    paddingTop: 16,
    flexGrow: 1,
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 32, 
    minHeight: 300,
  },
  loadingText: { 
    marginTop: 12, 
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  errorText: { 
    marginTop: 12, 
    fontSize: 16, 
    fontWeight: '500', 
    textAlign: 'center',
    color: '#fff',
  },
  emptyTitle: { 
    marginTop: 16, 
    fontSize: 18, 
    fontWeight: '600', 
    textAlign: 'center',
    color: '#fff',
  },
  emptySub: { 
    marginTop: 8, 
    fontSize: 14, 
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
  },
  btn: { 
    marginTop: 16, 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 8,
  },
  btnText: { 
    fontSize: 15, 
    fontWeight: '600',
  },
  composerArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 30,
  },
  composerGlass: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  scrollToBottomFab: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  typingIndicatorContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 99,
  },
  typingIndicatorBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
  },
  typingIndicatorText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});
