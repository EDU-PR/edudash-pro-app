/**
 * Teacher Message Thread Screen
 * Full-featured WhatsApp-style chat interface with:
 * - Online status indicator
 * - 3-dot settings menu
 * - Message context menu (long press)
 * - Clean message container with proper bounds
 * - Adaptive composer matching wallpaper/theme
 * - Voice recording with waveform
 * 
 * Refactored to use shared messaging components from components/messaging/
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ImageBackground, Keyboard, Vibration, NativeScrollEvent, NativeSyntheticEvent, LayoutChangeEvent } from 'react-native';
import { toast } from '@/components/ui/ToastProvider';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallSafe } from '@/components/calls/CallProvider';
import { FlashList, type FlashListRef } from '@shopify/flash-list';

// Shared messaging components
import {
  Message,
  DateSeparator,
  MessageBubble,
  MessageComposer,
  SmartQuickReplies,
  getDateKey,
  getDateSeparatorLabel,
} from '@/components/messaging';
import { ChatHeader } from '@/components/messaging/ChatHeader';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
// Safe imports with fallbacks
let useTheme: () => { theme: any; isDark: boolean };
let useAuth: () => { user: any; profile: any };
let useTeacherThreadMessages: (id: string | null) => { data: any[]; isLoading: boolean; error: any; refetch: () => void };
let useTeacherSendMessage: () => { mutateAsync: (args: any) => Promise<any>; isPending: boolean };
let useTeacherMarkThreadRead: () => { mutate: (threadId: string) => void };
let useTeacherMessagesRealtime: (id: string | null) => void = () => {};
let assertSupabase: () => any;

// Component imports
let ChatWallpaperPicker: React.FC<any> | null = null;
let MessageActionsMenu: React.FC<any> | null = null;
let ThreadOptionsMenu: React.FC<any> | null = null;
let getStoredWallpaper: (() => Promise<any>) | null = null;
let WALLPAPER_PRESETS: any[] = [];

// Voice storage service
let uploadVoiceNote: ((uri: string, duration: number, conversationId?: string) => Promise<{ publicUrl: string; storagePath: string }>) | null = null;
try { uploadVoiceNote = require('@/services/VoiceStorageService').uploadVoiceNote; } catch {}

try {
  const m = require('@/components/messaging/ChatWallpaperPicker');
  ChatWallpaperPicker = m.ChatWallpaperPicker;
  getStoredWallpaper = m.getStoredWallpaper;
  WALLPAPER_PRESETS = m.WALLPAPER_PRESETS || [];
} catch {}
try { MessageActionsMenu = require('@/components/messaging/MessageActionsMenu').MessageActionsMenu; } catch {}
try { ThreadOptionsMenu = require('@/components/messaging/ThreadOptionsMenu').ThreadOptionsMenu; } catch {}

const defaultTheme = {
  background: '#0f172a',
  surface: '#1e293b',
  primary: '#3b82f6',
  text: '#e2e8f0',
  textSecondary: '#94a3b8',
  border: 'rgba(148, 163, 184, 0.15)',
  error: '#ef4444',
};

const COMPOSER_OVERLAY_HEIGHT = 84;
const QUICK_REPLIES_OVERLAY_HEIGHT = 86;
const WALLPAPER_ACCENTS: Record<string, string> = {
  'purple-glow': '#a78bfa',
  midnight: '#60a5fa',
  'ocean-deep': '#38bdf8',
  'forest-night': '#4ade80',
  'sunset-warm': '#fb923c',
  'dark-slate': '#93c5fd',
};

try { useTheme = require('@/contexts/ThemeContext').useTheme; } catch { useTheme = () => ({ theme: defaultTheme, isDark: true }); }
try { useAuth = require('@/contexts/AuthContext').useAuth; } catch { useAuth = () => ({ user: null, profile: null }); }
try { assertSupabase = require('@/lib/supabase').assertSupabase; } catch { assertSupabase = () => { throw new Error('Supabase not available'); }; }
try {
  const h = require('@/hooks/useTeacherMessaging');
  useTeacherThreadMessages = h.useTeacherThreadMessages;
  useTeacherSendMessage = h.useTeacherSendMessage;
  useTeacherMarkThreadRead = h.useTeacherMarkThreadRead;
  useTeacherMessagesRealtime = h.useTeacherMessagesRealtime;
} catch {
  useTeacherThreadMessages = () => ({ data: [], isLoading: false, error: null, refetch: () => {} });
  useTeacherSendMessage = () => ({ mutateAsync: async () => ({}), isPending: false });
  useTeacherMarkThreadRead = () => ({ mutate: () => {} });
}

// ==================== MAIN COMPONENT ====================

export default function TeacherMessageThreadScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const params = useLocalSearchParams<{
    threadId?: string; threadid?: string;
    title?: string; parentName?: string;
    parentId?: string; parentid?: string;
  }>();
  
  const threadId = params.threadId || params.threadid || null;
  const displayName = params.title || params.parentName || 'Parent';
  const parentId = params.parentId || params.parentid;
  
  // Get CallProvider context (unified presence + calls)
  const callContext = useCallSafe();
  const isOnline = parentId && callContext ? callContext.isUserOnline(parentId) : false;
  const lastSeenText = parentId && callContext ? callContext.getLastSeenText(parentId) : 'Offline';
  const isAway = !isOnline && lastSeenText === 'Away';
  const onlineStatus: 'online' | 'away' | 'offline' = isOnline ? 'online' : isAway ? 'away' : 'offline';
  
  // Typing indicator hook
  const { isOtherTyping, typingText, setTyping, clearTyping } = useTypingIndicator({
    threadId: threadId || null,
    userId: user?.id || null,
    userName: user?.email?.split('@')[0] || 'Teacher',
  });
  
  // State
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);
  const [wallpaper, setWallpaper] = useState<any>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [sending, setSending] = useState(false);
  const [currentlyPlayingVoiceId, setCurrentlyPlayingVoiceId] = useState<string | null>(null);
  const [composerHeight, setComposerHeight] = useState(COMPOSER_OVERLAY_HEIGHT);
  const [quickRepliesHeight, setQuickRepliesHeight] = useState(QUICK_REPLIES_OVERLAY_HEIGHT);
  
  const listRef = useRef<FlashListRef<any> | null>(null);
  const isAtBottomRef = useRef(true);
  
  // Data
  const { data: messages = [], isLoading, error, refetch } = useTeacherThreadMessages(threadId);
  const { mutateAsync: sendMessage, isPending } = useTeacherSendMessage();
  const { mutate: markRead } = useTeacherMarkThreadRead();
  
  // Subscribe to real-time message updates
  useTeacherMessagesRealtime(threadId);
  
  const otherIds = useMemo(() => parentId ? [parentId] : [], [parentId]);
  
  // Mark messages as delivered and read when thread is opened
  // Delivered (gray ticks): When user comes online or opens thread
  // Read (blue ticks): When user actively views the thread
  useEffect(() => {
    if (threadId && messages.length > 0 && !isLoading && user?.id) {
      // First, mark messages as delivered (if not already)
      // This ensures ticks update even if no push notification was received
      try {
        assertSupabase().rpc('mark_messages_delivered', {
            p_thread_id: threadId,
          p_user_id: user.id,
        }).then(() => {
          if (__DEV__) {
            console.log('[TeacherThread] ✅ Marked messages as delivered');
          }
        }).catch((err: any) => {
          if (__DEV__) {
          console.warn('[TeacherThread] Failed to mark messages as delivered:', err);
        }
        });
      } catch {}
      
      // Then mark as read (this adds user to read_by array, showing blue ticks)
      markRead(threadId);
    }
  }, [threadId, messages.length, isLoading, markRead, user?.id]);
  
  useEffect(() => {
    if (getStoredWallpaper) getStoredWallpaper().then(setWallpaper);
  }, []);
  
  useEffect(() => {
    if (!messages.length) return;
    if (!isAtBottomRef.current) return;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages.length]);
  
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      // Keep the newest message visible when keyboard opens
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
  
  // Handlers
  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || !threadId || !user?.id) return;
    setSending(true);
    try {
      await sendMessage({ threadId, content, senderId: user.id });
      refetch();
      clearTyping();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }, [threadId, user?.id, sendMessage, refetch, clearTyping]);
  
  const handleVoiceRecording = useCallback(async (uri: string, dur: number) => {
    if (!threadId || !user?.id) return;
    
    const durationSecs = Math.round(dur / 1000);
    setSending(true);
    
    try {
      if (uploadVoiceNote) {
        const result = await uploadVoiceNote(uri, dur, threadId);
        // Store storagePath (not publicUrl) - signed URLs expire!
        // VoiceMessageBubble will generate fresh signed URLs for playback
        await sendMessage({ 
          threadId, 
          content: `🎤 Voice (${durationSecs}s)`,
          voiceUrl: result.storagePath,
          voiceDuration: durationSecs,
        });
      } else {
        await sendMessage({ 
          threadId, 
          content: `🎤 Voice message (${durationSecs}s)`,
        });
      }
      refetch();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (error) {
      console.error('Voice send error:', error);
      toast.error('Failed to send voice message');
    } finally {
      setSending(false);
    }
  }, [threadId, user?.id, sendMessage, refetch]);
  
  const handleLongPress = useCallback((msg: Message) => {
    setSelectedMsg(msg);
    setShowActions(true);
    Vibration.vibrate(30);
  }, []);
  
  const handleReply = useCallback(() => {
    if (selectedMsg) {
      setReplyTo(selectedMsg);
      setShowActions(false);
    }
  }, [selectedMsg]);
  
  // Message action handlers - only one reaction allowed per user per message
  const handleReact = useCallback(async (emoji: string) => {
    if (!selectedMsg?.id || !user?.id) {
      setShowActions(false);
      return;
    }
    
    try {
      const client = require('@/lib/supabase').assertSupabase();
      
      // Delete any existing reaction from this user on this message first
      await client
        .from('message_reactions')
        .delete()
        .eq('message_id', selectedMsg.id)
        .eq('user_id', user.id);
      
      // Add the new reaction
      await client.from('message_reactions').insert({
        message_id: selectedMsg.id,
        user_id: user.id,
        emoji: emoji,
      });
      
      // Refresh messages to show updated reactions
      refetch();
    } catch (err) {
      console.error('Error reacting to message:', err);
      toast.error('Failed to add reaction');
    }
    
    setShowActions(false);
  }, [selectedMsg, user?.id, refetch]);

  // Handler for clicking on a reaction to delete it
  const handleReactionPress = useCallback(async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    
    try {
      const client = require('@/lib/supabase').assertSupabase();
      
      // Delete the user's reaction
      await client
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
      
      // Refresh messages
      refetch();
      toast.success('Reaction removed');
    } catch (err) {
      console.error('Error removing reaction:', err);
      toast.error('Failed to remove reaction');
    }
  }, [user?.id, refetch]);

  const handleVoiceCall = useCallback(() => {
    if (!callContext) {
      toast.warn('Voice calling is not available', 'Voice Call');
      return;
    }
    if (!parentId) {
      toast.warn('Cannot identify recipient', 'Voice Call');
      return;
    }
    callContext.startVoiceCall(parentId, displayName);
  }, [callContext, parentId, displayName]);

  const handleVideoCall = useCallback(() => {
    if (!callContext) {
      toast.warn('Video calling is not available', 'Video Call');
      return;
    }
    if (!parentId) {
      toast.warn('Cannot identify recipient', 'Video Call');
      return;
    }
    callContext.startVideoCall(parentId, displayName);
  }, [callContext, parentId, displayName]);
  
  // Wallpaper/background
  const bgSource =
    wallpaper?.type === 'url'
      ? { uri: wallpaper.value }
      : (wallpaper?.uri ? { uri: wallpaper.uri } : undefined);
  const bgColor = wallpaper?.color || theme.background;
  const getWallpaperGradient = useCallback((): [string, string, ...string[]] => {
    if (!wallpaper || wallpaper.type !== 'preset') {
      return ['#0f172a', '#1e1b4b', '#0f172a'];
    }
    const preset = WALLPAPER_PRESETS.find((p: any) => p.key === wallpaper.value);
    return preset?.colors || ['#0f172a', '#1e1b4b', '#0f172a'];
  }, [wallpaper]);
  
  type ChatRow =
    | { type: 'date'; key: string; label: string }
    | { type: 'message'; key: string; msg: Message };

  const messagesAsc = useMemo(() => {
    const sorted = [...messages].sort((a: any, b: any) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    return sorted as Message[];
  }, [messages]);

  const voiceMessageIdsAsc = useMemo(() => {
    return messagesAsc.filter((m) => m.voice_url).map((m) => m.id);
  }, [messagesAsc]);

  const rowsAsc = useMemo<ChatRow[]>(() => {
    const rows: ChatRow[] = [];
    let lastDateKey = '';

    for (const msg of messagesAsc) {
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
  }, [messagesAsc]);

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
        onLongPress={() => handleLongPress(msg)}
        onPlaybackFinished={handleVoiceFinished}
        onPlayNext={handlePlayNext}
        onPlayPrevious={handlePlayPrevious}
        hasNextVoice={hasNextVoice}
        hasPreviousVoice={hasPreviousVoice}
        autoPlayVoice={shouldAutoPlay}
        otherParticipantIds={otherIds}
        onReactionPress={handleReactionPress}
      />
    );
  }, [currentlyPlayingVoiceId, handleLongPress, handleReactionPress, otherIds, user?.id, voiceMessageIdsAsc]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Track "near bottom" so we only auto-scroll when the user is already at the latest messages.
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingToBottom = 120;
    isAtBottomRef.current =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  }, []);

  const lastReceivedMessage = useMemo(() => {
    const received = messagesAsc
      .filter((m) => m.sender_id !== user?.id && m.content && typeof m.content === 'string')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return received[0]?.content;
  }, [messagesAsc, user?.id]);

  const handleComposerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    if (nextHeight > 0 && Math.abs(nextHeight - composerHeight) > 1) {
      setComposerHeight(nextHeight);
    }
  }, [composerHeight]);

  const handleQuickRepliesLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    if (nextHeight > 0 && Math.abs(nextHeight - quickRepliesHeight) > 1) {
      setQuickRepliesHeight(nextHeight);
    }
  }, [quickRepliesHeight]);

  const quickRepliesVisible = !!lastReceivedMessage && !replyTo && !sending && !isPending;
  const composerBottomInset = Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 2);
  const composerKeyboardOffset =
    keyboardHeight > 0 ? keyboardHeight - (Platform.OS === 'ios' ? insets.bottom : 0) + 8 : 0;
  const safeComposerHeight = Math.max(composerHeight, COMPOSER_OVERLAY_HEIGHT);
  const safeQuickRepliesHeight = quickRepliesVisible
    ? Math.max(quickRepliesHeight, QUICK_REPLIES_OVERLAY_HEIGHT)
    : 0;
  const quickRepliesBottom =
    composerKeyboardOffset +
    composerBottomInset +
    safeComposerHeight -
    2;
  const messageViewportInset =
    composerKeyboardOffset +
    composerBottomInset +
    safeComposerHeight +
    safeQuickRepliesHeight;
  const messageBottomReserve = 24;
  const wallpaperAccent =
    wallpaper?.type === 'preset' ? (WALLPAPER_ACCENTS[wallpaper.value] || '#93c5fd') : '#93c5fd';
  const quickRepliesSurface =
    bgSource ? 'rgba(15, 23, 42, 0.94)' : 'rgba(15, 23, 42, 0.9)';
  const wallpaperVariant = bgSource ? 'image' : 'gradient';
  
  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{displayName}</Text>
        </View>
        <View style={styles.center}>
          <EduDashSpinner size="large" color={theme.primary} />
        </View>
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{displayName}</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load messages</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ChatHeader
        displayName={displayName}
        isOnline={onlineStatus === 'online'}
        lastSeenText={lastSeenText}
        isLoading={isLoading}
        isTyping={isOtherTyping}
        typingText={typingText}
        onVoiceCall={handleVoiceCall}
        onVideoCall={handleVideoCall}
        onOptionsPress={() => setShowOptions(true)}
        recipientRole="parent"
      />
      
      {/* Messages Container */}
      <View style={[styles.messagesWrapper, { marginBottom: messageViewportInset }]}>
        {bgSource ? (
          <ImageBackground source={bgSource} style={styles.messagesArea} resizeMode="cover">
            <FlashList
              ref={listRef}
              data={rowsAsc}
              renderItem={renderRow}
              keyExtractor={(item) => item.key}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: messageBottomReserve },
              ]}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={64} color="rgba(148,163,184,0.4)" />
                  <Text style={styles.emptyTitle}>Start the Conversation</Text>
                  <Text style={styles.emptySubtitle}>Send a message to {displayName}</Text>
                </View>
              }
            />
          </ImageBackground>
        ) : wallpaper?.type === 'preset' ? (
          <LinearGradient colors={getWallpaperGradient()} style={styles.messagesArea}>
            <FlashList
              ref={listRef}
              data={rowsAsc}
              renderItem={renderRow}
              keyExtractor={(item) => item.key}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: messageBottomReserve },
              ]}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={64} color="rgba(148,163,184,0.4)" />
                  <Text style={styles.emptyTitle}>Start the Conversation</Text>
                  <Text style={styles.emptySubtitle}>Send a message to {displayName}</Text>
                </View>
              }
            />
          </LinearGradient>
        ) : (
          <FlashList
            ref={listRef}
            data={rowsAsc}
            renderItem={renderRow}
            keyExtractor={(item) => item.key}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: messageBottomReserve },
            ]}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={64} color="rgba(148,163,184,0.4)" />
                <Text style={styles.emptyTitle}>Start the Conversation</Text>
                <Text style={styles.emptySubtitle}>Send a message to {displayName}</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Smart Quick Replies */}
      <View
        pointerEvents={quickRepliesVisible ? 'auto' : 'none'}
        onLayout={handleQuickRepliesLayout}
        style={[
          styles.quickRepliesArea,
          {
            bottom: quickRepliesBottom,
            opacity: quickRepliesVisible ? 1 : 0,
          },
        ]}
      >
        <SmartQuickReplies
          lastReceivedMessage={lastReceivedMessage}
          onSelectReply={handleSend}
          visible={quickRepliesVisible}
          wallpaperMode
          accentColor={wallpaperAccent}
          surfaceColor={quickRepliesSurface}
          wallpaperVariant={wallpaperVariant}
        />
      </View>
      
      {/* Floating Composer */}
      <View style={[
        styles.composerKeyboard,
        { bottom: composerKeyboardOffset }
      ]}>
        <View style={[
          styles.composerArea,
          { 
            paddingBottom: keyboardHeight > 0 ? 8 : composerBottomInset,
            backgroundColor: bgSource ? 'rgba(15, 23, 42, 0.97)' : theme.background,
          }
        ]}
          onLayout={handleComposerLayout}
        >
          <MessageComposer
            onSend={handleSend}
            onVoiceRecording={handleVoiceRecording}
            sending={sending || isPending}
            replyingTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
          />
        </View>
      </View>
      
      {/* Thread Options Menu */}
      {ThreadOptionsMenu && (
        <ThreadOptionsMenu
          visible={showOptions}
          onClose={() => setShowOptions(false)}
          onChangeWallpaper={() => { setShowOptions(false); setShowWallpaper(true); }}
          onMuteNotifications={() => { setShowOptions(false); toast.success('Notifications muted'); }}
          onSearchInChat={() => { setShowOptions(false); toast.info('Coming soon', 'Search'); }}
          onClearChat={async () => { 
            setShowOptions(false);
            try {
              const { assertSupabase } = await import('@/lib/supabase');
              const supabase = assertSupabase();
              
              if (!threadId) return;
              
              const { error } = await supabase
                .from('messages')
                .delete()
                .eq('thread_id', threadId);
              
              if (error) throw error;
              
              refetch();
              toast.success('Chat cleared');
            } catch (error) {
              console.error('[ClearChat] Error:', error);
              toast.error('Failed to clear chat');
            }
          }}
          onBlockUser={() => { setShowOptions(false); toast.warn('User blocked'); }}
          onViewContact={() => { setShowOptions(false); toast.info(displayName, 'Contact'); }}
          onExportChat={() => { setShowOptions(false); toast.info('Coming soon', 'Export'); }}
          onMediaLinksAndDocs={() => { setShowOptions(false); toast.info('Coming soon', 'Media'); }}
          onStarredMessages={() => { setShowOptions(false); toast.info('Coming soon', 'Starred'); }}
          contactName={displayName}
        />
      )}
      
      {/* Message Actions Menu */}
      {MessageActionsMenu && selectedMsg && (
        <MessageActionsMenu
          visible={showActions}
          onClose={() => setShowActions(false)}
          messageId={selectedMsg.id}
          messageContent={selectedMsg.content}
          isOwnMessage={selectedMsg.sender_id === user?.id}
          onReact={handleReact}
          onReply={handleReply}
          onCopy={() => setShowActions(false)}
          onForward={() => { setShowActions(false); toast.info('Coming soon', 'Forward'); }}
          onDelete={() => { setShowActions(false); toast.success('Message deleted'); }}
        />
      )}
      
      {/* Wallpaper Picker */}
      {ChatWallpaperPicker && (
        <ChatWallpaperPicker
          isOpen={showWallpaper}
          onClose={() => setShowWallpaper(false)}
          onSelect={(w: any) => { setWallpaper(w); setShowWallpaper(false); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  headerBtn: {
    padding: 8,
  },
  avatarContainer: {
    marginLeft: 4,
    marginRight: 10,
    position: 'relative',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Messages Area
  messagesWrapper: {
    flex: 1,
    overflow: 'hidden',
    zIndex: 1,
  },
  messagesArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
  },
  
  // Composer
  composerKeyboard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 30,
  },
  composerArea: {
    paddingHorizontal: 0,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.18)',
  },
  quickRepliesArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 90,
    elevation: 24,
  },
});
