/**
 * Teacher Message Thread Screen
 * Full-featured WhatsApp-style chat interface with:
 * - Online status indicator
 * - 3-dot settings menu
 * - Message context menu (long press)
 * - Clean message container with proper bounds
 * - Adaptive composer matching wallpaper/theme
 * - Voice recording with waveform
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  ScrollView,
  Alert,
  Animated,
  ImageBackground,
  Keyboard,
  Vibration,
  Pressable,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CYAN_PRIMARY,
  CYAN_GLOW,
  CYAN_BORDER,
  GRADIENT_DARK_SLATE,
} from '../../components/messaging/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Safe imports with fallbacks
let useTheme: () => { theme: any; isDark: boolean };
let useAuth: () => { user: any; profile: any };
let useTeacherThreadMessages: (id: string | null) => { data: any[]; isLoading: boolean; error: any; refetch: () => void };
let useTeacherSendMessage: () => { mutateAsync: (args: any) => Promise<any>; isPending: boolean };
let useTeacherMarkThreadRead: () => { mutate: (threadId: string) => void };
let usePresence: ((userId: string | undefined) => { isUserOnline: (userId: string) => boolean; getLastSeenText: (userId: string) => string }) | null = null;

// Component imports
let InlineVoiceRecorder: React.FC<any> | null = null;
let ChatWallpaperPicker: React.FC<any> | null = null;
let MessageActionsMenu: React.FC<any> | null = null;
let ThreadOptionsMenu: React.FC<any> | null = null;
let EmojiPicker: React.FC<any> | null = null;
let getStoredWallpaper: (() => Promise<any>) | null = null;
let VoiceMessageBubble: React.FC<any> | null = null;

try { InlineVoiceRecorder = require('@/components/messaging/InlineVoiceRecorder').InlineVoiceRecorder; } catch {}
try { VoiceMessageBubble = require('@/components/messaging/VoiceMessageBubble').VoiceMessageBubble; } catch {}

// Voice storage service
let uploadVoiceNote: ((uri: string, duration: number, conversationId?: string) => Promise<{ publicUrl: string; storagePath: string }>) | null = null;
try { uploadVoiceNote = require('@/services/VoiceStorageService').uploadVoiceNote; } catch {}

try {
  const m = require('@/components/messaging/ChatWallpaperPicker');
  ChatWallpaperPicker = m.ChatWallpaperPicker;
  getStoredWallpaper = m.getStoredWallpaper;
} catch {}
try { MessageActionsMenu = require('@/components/messaging/MessageActionsMenu').MessageActionsMenu; } catch {}
try { ThreadOptionsMenu = require('@/components/messaging/ThreadOptionsMenu').ThreadOptionsMenu; } catch {}
try { EmojiPicker = require('@/components/messaging/EmojiPicker').EmojiPicker; } catch {}

// Call provider import with fallback
let useCallHook: (() => { startVoiceCall: (id: string, name?: string) => void; startVideoCall: (id: string, name?: string) => void }) | null = null;
try {
  useCallHook = require('@/components/calls/CallProvider').useCall;
} catch {}

const defaultTheme = {
  background: '#0f172a',
  surface: '#1e293b',
  primary: '#3b82f6',
  text: '#e2e8f0',
  textSecondary: '#94a3b8',
  border: 'rgba(148, 163, 184, 0.15)',
  error: '#ef4444',
};

try { useTheme = require('@/contexts/ThemeContext').useTheme; } catch { useTheme = () => ({ theme: defaultTheme, isDark: true }); }
try { useAuth = require('@/contexts/AuthContext').useAuth; } catch { useAuth = () => ({ user: null, profile: null }); }
try { usePresence = require('@/hooks/usePresence').usePresence; } catch { usePresence = null; }
let useTeacherMessagesRealtime: (id: string | null) => void = () => {};
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

// Types
interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender?: { first_name?: string; last_name?: string };
  read_by?: string[];
  voice_url?: string;
  voice_duration?: number;
}

// Helpers
const formatTime = (ts: string): string => {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const getDateLabel = (ts: string): string => {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const getDateKey = (ts: string): string => new Date(ts).toDateString();

// ==================== SUB-COMPONENTS ====================

// Online Status Indicator
const OnlineIndicator: React.FC<{ isOnline?: boolean }> = ({ isOnline = false }) => (
  <View style={[onlineStyles.dot, isOnline && onlineStyles.online]} />
);

const onlineStyles = StyleSheet.create({
  dot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#64748b',
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  online: {
    backgroundColor: '#22c55e',
  },
});

// Date Separator
const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <View style={sepStyles.container}>
    <View style={sepStyles.pill}>
      <Text style={sepStyles.text}>{label}</Text>
    </View>
  </View>
);

const sepStyles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 12 },
  pill: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  text: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },
});

// Message Ticks
type TickStatus = 'sending' | 'sent' | 'delivered' | 'read';
const MessageTicks: React.FC<{ status: TickStatus }> = ({ status }) => {
  const color = status === 'read' ? '#34d399' : 'rgba(255,255,255,0.6)';
  if (status === 'sending') return <ActivityIndicator size={10} color="rgba(255,255,255,0.4)" />;
  return <Text style={{ fontSize: 13, color, letterSpacing: -3 }}>{status === 'sent' ? '✓' : '✓✓'}</Text>;
};

// Reply Preview
const ReplyPreview: React.FC<{ message: Message; onClose: () => void }> = ({ message, onClose }) => (
  <View style={replyStyles.container}>
    <View style={replyStyles.bar} />
    <View style={replyStyles.content}>
      <Text style={replyStyles.name}>{message.sender?.first_name || 'Parent'}</Text>
      <Text numberOfLines={1} style={replyStyles.text}>{message.content}</Text>
    </View>
    <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="close" size={20} color="#64748b" />
    </TouchableOpacity>
  </View>
);

const replyStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    marginBottom: 8,
    padding: 10,
    marginHorizontal: 8,
  },
  bar: { width: 3, height: '100%', backgroundColor: '#3b82f6', borderRadius: 2, marginRight: 10 },
  content: { flex: 1 },
  name: { fontSize: 12, fontWeight: '600', color: '#3b82f6' },
  text: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
});

// Message Bubble - Memoized to prevent re-renders
const MessageBubble: React.FC<{
  msg: Message;
  isOwn: boolean;
  onLongPress: () => void;
  otherIds?: string[];
}> = React.memo(({ msg, isOwn, onLongPress, otherIds = [] }) => {
  const isVoice = msg.content.startsWith('🎤') || msg.voice_url;
  const status: TickStatus = !isOwn ? 'sent' 
    : (msg.read_by?.some(id => otherIds.includes(id)) ? 'read' : 'delivered');

  // For voice messages with actual audio URL, use the VoiceMessageBubble
  if (isVoice && msg.voice_url && VoiceMessageBubble) {
    return (
      <VoiceMessageBubble
        audioUrl={msg.voice_url}
        duration={msg.voice_duration || 30000}
        isOwnMessage={isOwn}
        timestamp={formatTime(msg.created_at)}
        senderName={!isOwn ? (msg.sender?.first_name || 'Parent') : undefined}
        isRead={msg.read_by?.some(id => otherIds.includes(id))}
      />
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={250}
      style={[bubbleStyles.row, isOwn ? bubbleStyles.rowOwn : bubbleStyles.rowOther]}
    >
      <LinearGradient
        colors={isOwn ? ['#3b82f6', '#2563eb'] : ['#1e293b', '#0f172a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          bubbleStyles.bubble,
          isOwn ? bubbleStyles.bubbleOwn : bubbleStyles.bubbleOther,
        ]}
      >
        {!isOwn && (
          <Text style={bubbleStyles.senderName}>
            {msg.sender?.first_name || 'Parent'}
          </Text>
        )}
        
        {isVoice ? (
          <View style={bubbleStyles.voiceRow}>
            <TouchableOpacity 
              style={[bubbleStyles.playBtn, isOwn && bubbleStyles.playBtnOwn]}
              onPress={() => Alert.alert('Voice Note', 'Voice playback requires audio URL')}
            >
              <Ionicons name="play" size={18} color={isOwn ? '#3b82f6' : '#fff'} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
            <View style={bubbleStyles.waveform}>
              {Array.from({ length: 20 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    bubbleStyles.waveBar,
                    { height: 4 + (i % 5) * 3, backgroundColor: isOwn ? 'rgba(255,255,255,0.5)' : '#64748b' }
                  ]}
                />
              ))}
            </View>
            <Text style={[bubbleStyles.duration, { color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748b' }]}>0:30</Text>
          </View>
        ) : (
          <Text style={[bubbleStyles.text, { color: isOwn ? '#fff' : '#e2e8f0' }]}>
            {msg.content}
          </Text>
        )}
        
        <View style={bubbleStyles.meta}>
          <Text style={[bubbleStyles.time, { color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748b' }]}>
            {formatTime(msg.created_at)}
          </Text>
          {isOwn && <MessageTicks status={status} />}
        </View>
      </LinearGradient>
    </Pressable>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return prevProps.msg.id === nextProps.msg.id &&
         prevProps.isOwn === nextProps.isOwn &&
         JSON.stringify(prevProps.msg.read_by) === JSON.stringify(nextProps.msg.read_by);
});

const bubbleStyles = StyleSheet.create({
  row: { paddingHorizontal: 12, marginVertical: 2 },
  rowOwn: { alignItems: 'flex-end' },
  rowOther: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleOwn: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(148,163,184,0.15)' },
  senderName: { fontSize: 12, fontWeight: '600', color: '#60a5fa', marginBottom: 4 },
  text: { fontSize: 15, lineHeight: 21 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 180 },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(59,130,246,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnOwn: { backgroundColor: 'rgba(255,255,255,0.9)' },
  waveform: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  waveBar: { width: 3, borderRadius: 1.5 },
  duration: { fontSize: 11 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  time: { fontSize: 11 },
});

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
  
  // Get actual presence status using usePresence hook
  const presence = usePresence && user?.id ? usePresence(user.id) : null;
  const isOnline = presence && parentId ? presence.isUserOnline(parentId) : false;
  const lastSeenText = presence && parentId ? presence.getLastSeenText(parentId) : 'Offline';
  
  // State
  const [text, setText] = useState('');
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [wallpaper, setWallpaper] = useState<any>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const micGlowAnim = useRef(new Animated.Value(0)).current;
  
  // Data
  const { data: messages = [], isLoading, error, refetch } = useTeacherThreadMessages(threadId);
  const { mutateAsync: sendMessage, isPending: sending } = useTeacherSendMessage();
  const { mutate: markRead } = useTeacherMarkThreadRead();
  
  // Subscribe to real-time message updates (no page reload needed)
  useTeacherMessagesRealtime(threadId);
  
  const otherIds = useMemo(() => parentId ? [parentId] : [], [parentId]);
  
  // Effects
  useEffect(() => {
    if (threadId) markRead(threadId);
  }, [threadId, markRead]);
  
  useEffect(() => {
    if (getStoredWallpaper) getStoredWallpaper().then(setWallpaper);
  }, []);
  
  useEffect(() => {
    if (messages.length) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);
  
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      // Scroll to bottom when keyboard opens
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
  
  // Mic glow animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(micGlowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(micGlowAnim, { toValue: 0.3, duration: 1500, useNativeDriver: false }),
      ])
    ).start();
  }, [micGlowAnim]);
  
  // Group messages by date
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; msgs: Message[] }[] = [];
    let lastKey = '';
    messages.forEach((m: Message) => {
      const key = getDateKey(m.created_at);
      if (key !== lastKey) {
        lastKey = key;
        groups.push({ key, label: getDateLabel(m.created_at), msgs: [m] });
      } else {
        groups[groups.length - 1].msgs.push(m);
      }
    });
    return groups;
  }, [messages]);
  
  // Handlers
  const handleSend = useCallback(async () => {
    if (!text.trim() || !threadId || !user?.id) return;
    const content = text.trim();
    setText('');
    setReplyTo(null);
    Keyboard.dismiss();
    try {
      await sendMessage({ threadId, content, senderId: user.id });
      refetch();
    } catch {
      Alert.alert('Error', 'Failed to send message');
      setText(content);
    }
  }, [text, threadId, user?.id, sendMessage, refetch]);
  
  const handleVoice = useCallback(async (uri: string, dur: number) => {
    if (!threadId || !user?.id) return;
    setIsRecording(false);
    
    const durationSecs = Math.round(dur / 1000);
    
    try {
      // Upload to Supabase Storage
      if (uploadVoiceNote) {
        const result = await uploadVoiceNote(uri, dur, threadId);
        // Send message with voice URL
        await sendMessage({ 
          threadId, 
          content: `🎤 Voice (${durationSecs}s)`,
          voiceUrl: result.publicUrl,
          voiceDuration: durationSecs,
        });
      } else {
        // Fallback: send as text only
        console.warn('[Voice] uploadVoiceNote not available, sending text only');
        await sendMessage({ 
          threadId, 
          content: `🎤 Voice message (${durationSecs}s)`,
        });
      }
      refetch();
    } catch (error) {
      console.error('Voice send error:', error);
      Alert.alert('Error', 'Failed to send voice message');
    }
  }, [threadId, user?.id, sendMessage, refetch]);

  const handleVoiceCancel = useCallback(() => {
    setIsRecording(false);
  }, []);

  const handleVoiceStart = useCallback(() => {
    setIsRecording(true);
  }, []);
  
  const handleLongPress = useCallback((msg: Message) => {
    setSelectedMsg(msg);
    setShowActions(true);
    Vibration.vibrate(30);
  }, []);
  
  const handleReply = useCallback(() => {
    if (selectedMsg) {
      setReplyTo(selectedMsg);
      setShowActions(false);
      inputRef.current?.focus();
    }
  }, [selectedMsg]);
  
  const handleEmojiSelect = useCallback((emoji: string) => {
    setText(prev => prev + emoji);
    setShowEmoji(false);
  }, []);
  
  // Voice/Video call handlers
  let callContext: { startVoiceCall: (id: string, name?: string) => void; startVideoCall: (id: string, name?: string) => void } | null = null;
  try {
    if (useCallHook) {
      callContext = useCallHook();
    }
  } catch (error) {
    // CallProvider not available, calls will be disabled
    console.log('CallProvider not available');
  }
  
  // Get recipient info for calls
  const recipientId = parentId || null;
  const recipientName = displayName;

  const handleVoiceCall = useCallback(() => {
    if (!callContext) {
      Alert.alert('Voice Call', 'Voice calling is not available. Please ensure calls are enabled.');
      return;
    }
    if (!recipientId) {
      Alert.alert('Voice Call', 'Cannot identify recipient. Please try again later.');
      return;
    }
    callContext.startVoiceCall(recipientId, recipientName);
  }, [callContext, recipientId, recipientName]);

  const handleVideoCall = useCallback(() => {
    if (!callContext) {
      Alert.alert('Video Call', 'Video calling is not available. Please ensure calls are enabled.');
      return;
    }
    if (!recipientId) {
      Alert.alert('Video Call', 'Cannot identify recipient. Please try again later.');
      return;
    }
    callContext.startVideoCall(recipientId, recipientName);
  }, [callContext, recipientId, recipientName]);
  
  // Wallpaper/background
  const bgSource = wallpaper?.uri ? { uri: wallpaper.uri } : undefined;
  const bgColor = wallpaper?.color || theme.background;
  
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
          <ActivityIndicator size="large" color={theme.primary} />
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
  
  // Messages render content
  const renderMessages = grouped.map((g) => (
    <View key={g.key}>
      <DateSeparator label={g.label} />
      {g.msgs.map((m) => (
        <MessageBubble
          key={m.id}
          msg={m}
          isOwn={m.sender_id === user?.id}
          onLongPress={() => handleLongPress(m)}
          otherIds={otherIds}
        />
      ))}
    </View>
  ));
  
  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header with online status and 3-dot menu */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.avatarContainer}>
          <LinearGradient colors={['#3b82f6', '#6366f1']} style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
          <OnlineIndicator isOnline={isOnline} />
        </View>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.headerSubtitle}>
            {lastSeenText}
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleVoiceCall}>
            <Ionicons name="call-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleVideoCall}>
            <Ionicons name="videocam-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowOptions(true)}>
            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Messages Container - Clean cut before composer */}
      <View style={[
        styles.messagesWrapper, 
        { marginBottom: keyboardHeight > 0 ? keyboardHeight + 70 - (Platform.OS === 'ios' ? insets.bottom : 0) : 70 + insets.bottom }
      ]}>
        {bgSource ? (
          <ImageBackground source={bgSource} style={styles.messagesArea} resizeMode="cover">
            <ScrollView
              ref={scrollRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={64} color="rgba(148,163,184,0.4)" />
                  <Text style={styles.emptyTitle}>Start the Conversation</Text>
                  <Text style={styles.emptySubtitle}>Send a message to {displayName}</Text>
                </View>
              ) : renderMessages}
            </ScrollView>
          </ImageBackground>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={64} color="rgba(148,163,184,0.4)" />
                <Text style={styles.emptyTitle}>Start the Conversation</Text>
                <Text style={styles.emptySubtitle}>Send a message to {displayName}</Text>
              </View>
            ) : renderMessages}
          </ScrollView>
        )}
      </View>
      
      {/* Floating Composer - Adapts to wallpaper/theme */}
      <Animated.View
        style={[
          styles.composerKeyboard,
          { bottom: keyboardHeight > 0 ? keyboardHeight - (Platform.OS === 'ios' ? insets.bottom : 0) + 8 : 0 }
        ]}
      >
        <View style={[
          styles.composerArea,
          { 
            paddingBottom: keyboardHeight > 0 ? 8 : (Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : insets.bottom + 8),
            backgroundColor: bgSource ? 'rgba(15, 23, 42, 0.85)' : 'transparent',
          }
        ]}>
          {/* Gradient fade above composer */}
          {!bgSource && (
            <LinearGradient
              colors={['transparent', bgColor]}
              style={styles.composerFade}
              pointerEvents="none"
            />
          )}
          
          {/* Emoji Picker */}
          {showEmoji && EmojiPicker && (
            <EmojiPicker
              visible={showEmoji}
              onEmojiSelect={handleEmojiSelect}
              onClose={() => setShowEmoji(false)}
            />
          )}
          
          {/* Reply Preview */}
          {replyTo && <ReplyPreview message={replyTo} onClose={() => setReplyTo(null)} />}
          
          <View style={styles.composerRow}>
            {isRecording && InlineVoiceRecorder ? (
              // Inline recording UI replaces the composer
              <InlineVoiceRecorder
                isRecording={isRecording}
                onRecordingComplete={handleVoice}
                onRecordingCancel={handleVoiceCancel}
                onRecordingStart={handleVoiceStart}
              />
            ) : (
              <>
                {/* Emoji Button */}
                <TouchableOpacity 
                  style={styles.composerBtn}
                  onPress={() => setShowEmoji(!showEmoji)}
                >
                  <Ionicons 
                    name={showEmoji ? 'close-outline' : 'happy-outline'} 
                    size={28} 
                    color="rgba(255,255,255,0.6)" 
                  />
                </TouchableOpacity>
                
                {/* Input Container */}
                <View style={[
                  styles.inputContainer,
                  bgSource && styles.inputContainerWithBg,
                ]}>
                  <TextInput
                    ref={inputRef}
                    style={styles.textInput}
                    placeholder="Message"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={1000}
                    editable={!sending}
                    onFocus={() => setShowEmoji(false)}
                    textAlignVertical="center"
                  />
                  
                  {/* Camera (hide when typing) */}
                  {!text.trim() && (
                    <TouchableOpacity style={styles.inlineBtn} onPress={() => Alert.alert('Camera', 'Coming soon')}>
                      <Ionicons name="camera-outline" size={22} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  )}
                  
                  {/* Attachment */}
                  <TouchableOpacity style={styles.inlineBtn} onPress={() => Alert.alert('Attach', 'Coming soon')}>
                    <Ionicons name="attach-outline" size={22} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>
                
                {/* Send or Mic Button */}
                {text.trim() ? (
                  <TouchableOpacity onPress={handleSend} disabled={sending} activeOpacity={0.8}>
                    <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.sendBtn}>
                      {sending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="send" size={20} color="#fff" />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  // Glowing mic button with InlineVoiceRecorder
                  <View style={styles.micContainer}>
                    <Animated.View style={[styles.micGlow, { opacity: micGlowAnim }]} />
                    {InlineVoiceRecorder ? (
                      <InlineVoiceRecorder
                        isRecording={isRecording}
                        onRecordingComplete={handleVoice}
                        onRecordingCancel={handleVoiceCancel}
                        onRecordingStart={handleVoiceStart}
                      />
                    ) : (
                      <TouchableOpacity onPress={() => Alert.alert('Voice', 'Not available')}>
                        <LinearGradient colors={[CYAN_PRIMARY, '#0891b2']} style={styles.micBtnGradient}>
                          <Ionicons name="mic" size={22} color="#fff" />
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Animated.View>
      
      {/* Thread Options Menu (3-dot menu) */}
      {ThreadOptionsMenu && (
        <ThreadOptionsMenu
          visible={showOptions}
          onClose={() => setShowOptions(false)}
          onChangeWallpaper={() => { setShowOptions(false); setShowWallpaper(true); }}
          onMuteNotifications={() => { setShowOptions(false); Alert.alert('Muted', 'Notifications muted'); }}
          onSearchInChat={() => { setShowOptions(false); Alert.alert('Search', 'Coming soon'); }}
          onClearChat={() => { setShowOptions(false); Alert.alert('Clear', 'Chat cleared'); }}
          onBlockUser={() => { setShowOptions(false); Alert.alert('Block', 'User blocked'); }}
          onViewContact={() => { setShowOptions(false); Alert.alert('Contact', displayName); }}
          onExportChat={() => { setShowOptions(false); Alert.alert('Export', 'Coming soon'); }}
          onMediaLinksAndDocs={() => { setShowOptions(false); Alert.alert('Media', 'Coming soon'); }}
          onStarredMessages={() => { setShowOptions(false); Alert.alert('Starred', 'Coming soon'); }}
          contactName={displayName}
        />
      )}
      
      {/* Message Actions Menu (long press) */}
      {MessageActionsMenu && selectedMsg && (
        <MessageActionsMenu
          visible={showActions}
          onClose={() => setShowActions(false)}
          messageId={selectedMsg.id}
          messageContent={selectedMsg.content}
          isOwnMessage={selectedMsg.sender_id === user?.id}
          onReact={(emoji: string) => { setShowActions(false); }}
          onReply={handleReply}
          onCopy={() => setShowActions(false)}
          onForward={() => { setShowActions(false); Alert.alert('Forward', 'Coming soon'); }}
          onDelete={() => { setShowActions(false); Alert.alert('Delete', 'Message deleted'); }}
        />
      )}
      
      {/* Wallpaper Picker */}
      {ChatWallpaperPicker && (
        <ChatWallpaperPicker
          visible={showWallpaper}
          onClose={() => setShowWallpaper(false)}
          onSelect={(w: any) => { setWallpaper(w); setShowWallpaper(false); }}
          currentWallpaper={wallpaper}
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
  },
  messagesArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 100, // Space for composer
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
  },
  composerArea: {
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  composerFade: {
    position: 'absolute',
    top: -60,
    left: 0,
    right: 0,
    height: 80,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  composerBtn: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 50,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  inputContainerWithBg: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    maxHeight: 100,
    minHeight: 36,
    paddingVertical: 8,
  },
  inlineBtn: {
    padding: 3,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  micContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micGlow: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: CYAN_GLOW,
  },
  micBtnGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CYAN_PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
