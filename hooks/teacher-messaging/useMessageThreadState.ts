/** Teacher Message Thread — State & Derived Data */
import { useState, useRef, useEffect, useMemo } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { type FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import { useCallSafe } from '@/components/calls/CallProvider';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useThreadOptions } from '@/hooks/useThreadOptions';
import { type Message, getDateKey, getDateSeparatorLabel } from '@/components/messaging';
import {
  COMPOSER_OVERLAY_HEIGHT, COMPOSER_FLOAT_GAP,
} from '@/features/teacher-messaging/teacher-message-thread.styles';

let useTheme: () => { theme: any; isDark: boolean };
let useAuth: () => { user: any; profile: any };
let assertSupabase: () => any;
let getStoredWallpaper: (() => Promise<any>) | null = null;
let WALLPAPER_PRESETS: any[] = [];
let useTeacherThreadMessages: (id: string | null) => { data: any[]; isLoading: boolean; error: any; refetch: () => void };
let useTeacherSendMessage: () => { mutateAsync: (args: any) => Promise<any>; isPending: boolean };
let useTeacherMarkThreadRead: () => { mutate: (threadId: string) => void };
let useTeacherMessagesRealtime: (id: string | null) => void = () => {};

const defaultTheme = {
  background: '#0f172a', surface: '#1e293b', primary: '#3b82f6',
  text: '#e2e8f0', textSecondary: '#94a3b8', border: 'rgba(148, 163, 184, 0.15)', error: '#ef4444',
};

try { useTheme = require('@/contexts/ThemeContext').useTheme; } catch { useTheme = () => ({ theme: defaultTheme, isDark: true }); }
try { useAuth = require('@/contexts/AuthContext').useAuth; } catch { useAuth = () => ({ user: null, profile: null }); }
try { assertSupabase = require('@/lib/supabase').assertSupabase; } catch { assertSupabase = () => { throw new Error('Supabase not available'); }; }
try { const m = require('@/components/messaging/ChatWallpaperPicker'); getStoredWallpaper = m.getStoredWallpaper; WALLPAPER_PRESETS = m.WALLPAPER_PRESETS || []; } catch {}
try {
  const h = require('@/hooks/useTeacherMessaging');
  useTeacherThreadMessages = h.useTeacherThreadMessages; useTeacherSendMessage = h.useTeacherSendMessage;
  useTeacherMarkThreadRead = h.useTeacherMarkThreadRead; useTeacherMessagesRealtime = h.useTeacherMessagesRealtime;
} catch {
  useTeacherThreadMessages = () => ({ data: [], isLoading: false, error: null, refetch: () => {} });
  useTeacherSendMessage = () => ({ mutateAsync: async () => ({}), isPending: false });
  useTeacherMarkThreadRead = () => ({ mutate: () => {} });
}

export type ChatRow =
  | { type: 'date'; key: string; label: string }
  | { type: 'message'; key: string; msg: Message; isFirstInGroup: boolean; isLastInGroup: boolean };

export function useMessageThreadState() {
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

  const callContext = useCallSafe();
  const isOnline = parentId && callContext ? callContext.isUserOnline(parentId) : false;
  const lastSeenText = parentId && callContext ? callContext.getLastSeenText(parentId) : 'Offline';
  const isAway = !isOnline && lastSeenText === 'Away';
  const onlineStatus: 'online' | 'away' | 'offline' = isOnline ? 'online' : isAway ? 'away' : 'offline';

  const { isOtherTyping, typingText, setTyping, clearTyping } = useTypingIndicator({
    threadId: threadId || null, userId: user?.id || null,
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
  const [optimisticMsgs, setOptimisticMsgs] = useState<Message[]>([]);
  const [currentlyPlayingVoiceId, setCurrentlyPlayingVoiceId] = useState<string | null>(null);
  const [composerHeight, setComposerHeight] = useState(COMPOSER_OVERLAY_HEIGHT);
  const listRef = useRef<FlashListRef<any> | null>(null);
  const isAtBottomRef = useRef(true);

  // Data hooks
  const { data: messages = [], isLoading, error, refetch } = useTeacherThreadMessages(threadId);
  const { mutateAsync: sendMessage, isPending } = useTeacherSendMessage();
  const { mutate: markRead } = useTeacherMarkThreadRead();
  useTeacherMessagesRealtime(threadId);

  const otherParticipant = useMemo(() => messages.find((m) => m.sender_id !== user?.id), [messages, user?.id]);
  const resolvedOtherUserId = parentId || otherParticipant?.sender_id;
  const otherIds = useMemo(() => (resolvedOtherUserId ? [resolvedOtherUserId] : []), [resolvedOtherUserId]);

  useEffect(() => {
    if (!threadId || !messages.length || isLoading || !user?.id) return;
    try {
      assertSupabase().rpc('mark_messages_delivered', { p_thread_id: threadId, p_user_id: user.id })
        .then(() => { if (__DEV__) logger.debug('TeacherThread', 'Marked delivered'); })
        .catch((err: any) => { if (__DEV__) console.warn('[TeacherThread] mark delivered failed:', err); });
    } catch {}
    markRead(threadId);
  }, [threadId, messages.length, isLoading, markRead, user?.id]);

  useEffect(() => { if (getStoredWallpaper) getStoredWallpaper().then(setWallpaper); }, []);

  useEffect(() => {
    if (!messages.length || !isAtBottomRef.current) return;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages.length]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const threadOptions = useThreadOptions({
    threadId: threadId || '', userId: user?.id, otherUserId: resolvedOtherUserId,
    refetch, setShowOptionsMenu: setShowOptions, setOptimisticMsgs, displayName,
  });

  const bgSource = wallpaper?.type === 'url'
    ? { uri: wallpaper.value }
    : (wallpaper?.uri ? { uri: wallpaper.uri } : undefined);
  const bgColor = wallpaper?.color || theme.background;
  const getWallpaperGradient = (): [string, string, ...string[]] => {
    if (!wallpaper || wallpaper.type !== 'preset') return ['#0f172a', '#1e1b4b', '#0f172a'];
    const preset = WALLPAPER_PRESETS.find((p: any) => p.key === wallpaper.value);
    return preset?.colors || ['#0f172a', '#1e1b4b', '#0f172a'];
  };

  const messagesAsc = useMemo(() => {
    const ids = new Set(messages.map((m: any) => m.id));
    const merged = [...messages, ...optimisticMsgs.filter((m) => !ids.has(m.id))];
    return [...merged].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ) as Message[];
  }, [messages, optimisticMsgs]);

  const voiceMessageIdsAsc = useMemo(
    () => messagesAsc.filter((m) => m.voice_url).map((m) => m.id), [messagesAsc]
  );

  const rowsAsc = useMemo<ChatRow[]>(() => {
    const rows: ChatRow[] = [];
    let lastDateKey = '';
    const GROUP_GAP_MS = 2 * 60 * 1000; // 2 minutes
    for (let i = 0; i < messagesAsc.length; i++) {
      const msg = messagesAsc[i];
      const dateKey = getDateKey(msg.created_at);
      if (dateKey !== lastDateKey) {
        rows.push({ type: 'date', key: `date-${dateKey}`, label: getDateSeparatorLabel(msg.created_at) });
        lastDateKey = dateKey;
      }
      const prev = messagesAsc[i - 1];
      const next = messagesAsc[i + 1];
      const prevSame = prev && prev.sender_id === msg.sender_id && getDateKey(prev.created_at) === dateKey && (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) < GROUP_GAP_MS;
      const nextSame = next && next.sender_id === msg.sender_id && getDateKey(next?.created_at) === dateKey && (new Date(next.created_at).getTime() - new Date(msg.created_at).getTime()) < GROUP_GAP_MS;
      rows.push({ type: 'message', key: `msg-${msg.id}`, msg, isFirstInGroup: !prevSame, isLastInGroup: !nextSame });
    }
    return rows;
  }, [messagesAsc]);

  const composerBottomInset = Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 2);
  const composerKeyboardOffset = keyboardHeight > 0
    ? keyboardHeight - (Platform.OS === 'ios' ? insets.bottom : 0) + 8 : 0;
  const safeComposerHeight = Math.max(composerHeight, COMPOSER_OVERLAY_HEIGHT);
  const messageViewportInset = composerKeyboardOffset + composerBottomInset + safeComposerHeight + COMPOSER_FLOAT_GAP;
  const messageBottomReserve = 8;

  return {
    theme, user, insets, t, threadId, displayName, parentId,
    callContext, onlineStatus, lastSeenText, isOtherTyping, typingText, clearTyping,
    selectedMsg, setSelectedMsg, replyTo, setReplyTo,
    showOptions, setShowOptions, showActions, setShowActions,
    showWallpaper, setShowWallpaper, wallpaper, setWallpaper,
    sending, setSending, keyboardHeight, composerHeight, setComposerHeight,
    currentlyPlayingVoiceId, setCurrentlyPlayingVoiceId,
    listRef, isAtBottomRef,
    isLoading, error, refetch, sendMessage, isPending,
    otherIds, voiceMessageIdsAsc,
    bgSource, bgColor, getWallpaperGradient, rowsAsc,
    composerBottomInset, composerKeyboardOffset,
    messageViewportInset, messageBottomReserve,
    ...threadOptions,
  };
}
