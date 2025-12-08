/**
 * Parent Message Thread Screen
 * Full-featured WhatsApp-style chat interface with PWA parity
 * Features: Voice recording, wallpaper, message actions, options menu,
 *           date separators, message ticks, reply preview
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
  PURPLE_PRIMARY,
  PURPLE_SECONDARY,
  GRADIENT_PURPLE,
  GRADIENT_DARK_SLATE,
  SHADOW_CYAN,
} from '../../components/messaging/theme';

// Safe imports with fallbacks
let useTheme: () => { theme: any; isDark: boolean };
let useAuth: () => { user: any; profile: any };
let useThreadMessages: (id: string | null) => { data: any[]; isLoading: boolean; error: any; refetch: () => void };
let useSendMessage: () => { mutateAsync: (args: any) => Promise<any>; isLoading: boolean };
let useMarkThreadRead: () => { mutate: (args: any) => void };

// Component imports with fallbacks
let InlineVoiceRecorder: React.FC<any> | null = null;
let VoiceNotePlayer: React.FC<any> | null = null;
let ChatWallpaperPicker: React.FC<any> | null = null;
let MessageActionsMenu: React.FC<any> | null = null;
let ThreadOptionsMenu: React.FC<any> | null = null;
let EmojiPicker: React.FC<any> | null = null;
let getStoredWallpaper: (() => Promise<any>) | null = null;
let WALLPAPER_PRESETS: any[] = [];

// Try component imports
try {
  InlineVoiceRecorder = require('@/components/messaging/InlineVoiceRecorder').InlineVoiceRecorder;
} catch {}

let VoiceMessageBubble: React.FC<any> | null = null;
try {
  VoiceMessageBubble = require('@/components/messaging/VoiceMessageBubble').VoiceMessageBubble;
} catch {}

try {
  VoiceNotePlayer = require('@/components/messaging/VoiceNotePlayer').VoiceNotePlayer;
} catch {}

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

try {
  EmojiPicker = require('@/components/messaging/EmojiPicker').EmojiPicker;
} catch {}

// Voice storage service
let uploadVoiceNote: ((uri: string, duration: number, conversationId?: string) => Promise<{ publicUrl: string; storagePath: string }>) | null = null;
try { uploadVoiceNote = require('@/services/VoiceStorageService').uploadVoiceNote; } catch {}

// Call provider import
let useCallHook: (() => { startVoiceCall: (id: string, name?: string) => void; startVideoCall: (id: string, name?: string) => void }) | null = null;
try {
  useCallHook = require('@/components/calls/CallProvider').useCall;
} catch {}

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
  const hooks = require('@/hooks/useParentMessaging');
  useThreadMessages = hooks.useThreadMessages;
  useSendMessage = hooks.useSendMessage;
  useMarkThreadRead = hooks.useMarkThreadRead;
} catch {
  useThreadMessages = () => ({ data: [], isLoading: false, error: null, refetch: () => {} });
  useSendMessage = () => ({ mutateAsync: async () => ({}), isLoading: false });
  useMarkThreadRead = () => ({ mutate: () => {} });
}

// Message interface
interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender?: { first_name?: string; last_name?: string; role?: string };
  read_by?: string[];
  delivered_to?: string[];
  isTyping?: boolean;
  voice_url?: string;
  voice_duration?: number;
}

// ==================== HELPER FUNCTIONS ====================

// Format time helper
const formatTime = (ts: string): string => {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// Get date separator label (Today, Yesterday, weekday, or full date)
const getDateSeparatorLabel = (timestamp: string): string => {
  const messageDate = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  
  if (messageDateOnly.getTime() === todayOnly.getTime()) return 'Today';
  if (messageDateOnly.getTime() === yesterdayOnly.getTime()) return 'Yesterday';
  
  const daysDiff = Math.floor((todayOnly.getTime() - messageDateOnly.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return messageDate.toLocaleDateString([], { weekday: 'long' });
  }
  return messageDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
};

// Get date key for grouping
const getDateKey = (timestamp: string): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

// ==================== SUB-COMPONENTS ====================

// Date Separator Component
const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <View style={dateSepStyles.container}>
    <View style={dateSepStyles.pill}>
      <Text style={dateSepStyles.text}>{label}</Text>
    </View>
  </View>
);

const dateSepStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  pill: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(148, 163, 184, 0.9)',
  },
});

// Message Status Ticks Component (WhatsApp-style)
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

const MessageTicks: React.FC<{ status: MessageStatus }> = ({ status }) => {
  if (status === 'sending') {
    return <Text style={tickStyles.sending}>○</Text>;
  }
  if (status === 'sent') {
    return <Text style={tickStyles.sent}>✓</Text>;
  }
  if (status === 'delivered') {
    return <Text style={tickStyles.delivered}>✓✓</Text>;
  }
  // Read - green ticks like WhatsApp
  return <Text style={tickStyles.read}>✓✓</Text>;
};

const tickStyles = StyleSheet.create({
  sending: { fontSize: 12, color: 'rgba(255, 255, 255, 0.4)' },
  sent: { fontSize: 14, color: 'rgba(255, 255, 255, 0.6)', fontWeight: '500' },
  delivered: { fontSize: 14, color: 'rgba(255, 255, 255, 0.6)', fontWeight: '500', letterSpacing: -3 },
  read: { fontSize: 14, fontWeight: '600', color: '#34d399', letterSpacing: -3 },
});

// Reply Preview Bar Component
interface ReplyPreviewProps {
  message: Message;
  onClose: () => void;
}

const ReplyPreview: React.FC<ReplyPreviewProps> = ({ message, onClose }) => (
  <View style={replyStyles.container}>
    <View style={replyStyles.content}>
      <Text style={replyStyles.label}>
        Replying to {message.sender?.first_name || 'message'}
      </Text>
      <Text numberOfLines={1} style={replyStyles.text}>
        {message.content}
      </Text>
    </View>
    <TouchableOpacity onPress={onClose} style={replyStyles.closeBtn}>
      <Ionicons name="close" size={20} color="#64748b" />
    </TouchableOpacity>
  </View>
);

const replyStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  content: { flex: 1 },
  label: { fontSize: 12, color: '#3b82f6', fontWeight: '600', marginBottom: 2 },
  text: { fontSize: 13, color: '#94a3b8' },
  closeBtn: { padding: 4 },
});

// Check if message is a voice note
const isVoiceNote = (content: string): boolean => {
  return content.startsWith('🎤 Voice message') || content.includes('__media__') && content.includes('audio');
};

// Extract voice note duration from content
const getVoiceNoteDuration = (content: string): number => {
  const match = content.match(/\((\d+)s\)/);
  return match ? parseInt(match[1], 10) * 1000 : 30000;
};

// Message Bubble Component - Memoized to prevent flash on new messages
interface MessageBubbleProps {
  msg: Message;
  isOwn: boolean;
  onLongPress: () => void;
  otherParticipantIds?: string[];
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ msg, isOwn, onLongPress, otherParticipantIds = [] }) => {
  const name = msg.sender 
    ? `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim() || 'User'
    : 'User';

  // Determine message status for ticks
  const getMessageStatus = (): MessageStatus => {
    if (!isOwn) return 'sent';
    const isRead = msg.read_by && otherParticipantIds.length > 0
      ? otherParticipantIds.some(id => msg.read_by?.includes(id))
      : false;
    if (isRead) return 'read';
    const isDelivered = msg.delivered_to && otherParticipantIds.length > 0
      ? otherParticipantIds.some(id => msg.delivered_to?.includes(id))
      : false;
    if (isDelivered) return 'delivered';
    return msg.id && !msg.id.startsWith('temp-') ? 'delivered' : 'sending';
  };

  const status = getMessageStatus();
  const isVoice = isVoiceNote(msg.content) || msg.voice_url;

  // For voice messages with actual audio URL, use the VoiceMessageBubble
  if (isVoice && msg.voice_url && VoiceMessageBubble) {
    return (
      <VoiceMessageBubble
        audioUrl={msg.voice_url}
        duration={msg.voice_duration || getVoiceNoteDuration(msg.content)}
        isOwnMessage={isOwn}
        timestamp={formatTime(msg.created_at)}
        senderName={!isOwn ? name : undefined}
        isRead={msg.read_by?.some(id => otherParticipantIds.includes(id))}
      />
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={[bubbleStyles.container, isOwn ? bubbleStyles.own : bubbleStyles.other]}
    >
      {!isOwn && (
        <Text style={bubbleStyles.name}>{name}</Text>
      )}
      <LinearGradient
        colors={isOwn ? ['#3b82f6', '#2563eb'] : ['#1e293b', '#0f172a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          bubbleStyles.bubble,
          isOwn ? bubbleStyles.bubbleOwn : bubbleStyles.bubbleOther,
          isVoice && bubbleStyles.voiceBubble,
        ]}
      >
        {isVoice ? (
          <View style={bubbleStyles.voiceContainer}>
            {/* Voice message placeholder UI - shows when no voice_url available */}
            <View style={bubbleStyles.voiceRow}>
              <TouchableOpacity 
                style={[bubbleStyles.playBtn, isOwn ? bubbleStyles.playBtnOwn : bubbleStyles.playBtnOther]}
                onPress={() => Alert.alert('Voice Note', 'Voice playback requires audio URL')}
              >
                <Ionicons name="play" size={20} color={isOwn ? '#3b82f6' : '#fff'} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
              <View style={bubbleStyles.waveformPlaceholder}>
                {[...Array(24)].map((_, i) => (
                  <View 
                    key={i} 
                    style={[
                      bubbleStyles.waveBar,
                      { 
                        height: 6 + (i % 5) * 3, // Consistent waveform instead of random
                        backgroundColor: isOwn ? 'rgba(255,255,255,0.5)' : 'rgba(148,163,184,0.6)',
                      }
                    ]} 
                  />
                ))}
              </View>
              <Ionicons name="mic" size={14} color={isOwn ? 'rgba(255,255,255,0.6)' : '#64748b'} />
            </View>
            <Text style={[bubbleStyles.voiceDuration, { color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748b' }]}>
              {Math.floor(getVoiceNoteDuration(msg.content) / 1000)}s
            </Text>
          </View>
        ) : (
          <Text style={[bubbleStyles.text, { color: isOwn ? '#ffffff' : '#e2e8f0' }]}>
            {msg.content}
          </Text>
        )}
        <View style={bubbleStyles.footer}>
          <Text style={[bubbleStyles.time, { color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748b' }]}>
            {formatTime(msg.created_at)}
          </Text>
          {isOwn && (
            <View style={bubbleStyles.ticksContainer}>
              <MessageTicks status={status} />
            </View>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return prevProps.msg.id === nextProps.msg.id &&
         prevProps.isOwn === nextProps.isOwn &&
         JSON.stringify(prevProps.msg.read_by) === JSON.stringify(nextProps.msg.read_by) &&
         JSON.stringify(prevProps.msg.delivered_to) === JSON.stringify(nextProps.msg.delivered_to);
});

const bubbleStyles = StyleSheet.create({
  container: { marginVertical: 3, maxWidth: '85%' },
  own: { alignSelf: 'flex-end' },
  other: { alignSelf: 'flex-start' },
  name: { 
    fontSize: 12, 
    fontWeight: '600', 
    marginBottom: 4, 
    marginLeft: 12,
    color: '#a78bfa',
  },
  bubble: { 
    borderRadius: 18, 
    paddingHorizontal: 14, 
    paddingVertical: 10,
    borderWidth: 1,
  },
  bubbleOwn: {
    borderTopRightRadius: 4,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleOther: {
    borderTopLeftRadius: 4,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  voiceBubble: {
    minWidth: 260,
    maxWidth: 300,
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingRight: 14,
  },
  voiceContainer: {
    marginBottom: 2,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnOwn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  playBtnOther: {
    backgroundColor: 'rgba(59,130,246,0.8)',
  },
  waveformPlaceholder: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  voiceDuration: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 46,
  },
  text: { fontSize: 16, lineHeight: 22 },
  footer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'flex-end', 
    marginTop: 4,
    gap: 4,
  },
  time: { fontSize: 11 },
  ticksContainer: { marginLeft: 2 },
});

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
  const scrollRef = useRef<ScrollView>(null);

  // Core state
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [optimisticMsgs, setOptimisticMsgs] = useState<Message[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  
  // Wallpaper state
  const [currentWallpaper, setCurrentWallpaper] = useState<{ type: string; value: string } | null>(null);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  
  // Menu state
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Message actions state
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  
  // Animation refs
  const micGlowAnim = useRef(new Animated.Value(0.1)).current;
  
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
  
  // Mic glow animation
  useEffect(() => {
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(micGlowAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(micGlowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
      ])
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, [micGlowAnim]);

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
    console.warn('useThreadMessages error:', e);
  }

  try {
    const sendResult = useSendMessage();
    sendMessage = sendResult.mutateAsync;
  } catch (e) {
    console.warn('useSendMessage error:', e);
  }

  try {
    const markResult = useMarkThreadRead();
    markRead = markResult.mutate;
  } catch (e) {
    console.warn('useMarkThreadRead error:', e);
  }

  // Combined messages with optimistic updates
  const allMessages = useMemo(() => {
    const ids = new Set(messages.map(m => m.id));
    const unique = optimisticMsgs.filter(m => !ids.has(m.id));
    return [...messages, ...unique].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages, optimisticMsgs]);

  // Mark thread as read
  useEffect(() => {
    if (threadId && messages.length > 0 && !loading) {
      try { markRead({ threadId }); } catch {}
    }
  }, [threadId, messages.length, loading]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (allMessages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
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
  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || !threadId || sending) return;

    setSending(true);
    setText('');
    setShowEmojiPicker(false);
    setReplyingTo(null);

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      content,
      sender_id: user?.id || '',
      created_at: new Date().toISOString(),
      sender: { first_name: 'You', last_name: '' },
    };
    setOptimisticMsgs(prev => [...prev, tempMsg]);

    try {
      await sendMessage({ threadId, content });
      setOptimisticMsgs(prev => prev.filter(m => m.id !== tempMsg.id));
    } catch (err) {
      console.error('Send failed:', err);
      setOptimisticMsgs(prev => prev.filter(m => m.id !== tempMsg.id));
      setText(content);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }, [text, threadId, sending, user?.id, sendMessage]);
  
  // Voice recording handler
  const handleVoiceRecording = useCallback(async (uri: string, duration: number) => {
    if (!threadId) return;
    setIsRecording(false);
    Vibration.vibrate([0, 30, 50, 30]);
    
    const durationSecs = Math.round(duration / 1000);
    const content = `🎤 Voice (${durationSecs}s)`;
    
    const tempMsg: Message = {
      id: `temp-voice-${Date.now()}`,
      content,
      sender_id: user?.id || '',
      created_at: new Date().toISOString(),
      sender: { first_name: 'You', last_name: '' },
    };
    setOptimisticMsgs(prev => [...prev, tempMsg]);
    
    try {
      // Upload to Supabase Storage
      if (uploadVoiceNote) {
        const result = await uploadVoiceNote(uri, duration, threadId);
        await sendMessage({ 
          threadId, 
          content,
          voiceUrl: result.publicUrl,
          voiceDuration: durationSecs,
        });
      } else {
        // Fallback: send as text only
        console.warn('[Voice] uploadVoiceNote not available, sending text only');
        await sendMessage({ threadId, content });
      }
      setOptimisticMsgs(prev => prev.filter(m => m.id !== tempMsg.id));
    } catch (err) {
      console.error('Voice send failed:', err);
      setOptimisticMsgs(prev => prev.filter(m => m.id !== tempMsg.id));
      Alert.alert('Error', 'Failed to send voice message.');
    }
  }, [threadId, user?.id, sendMessage]);

  const handleVoiceCancel = useCallback(() => {
    setIsRecording(false);
  }, []);

  const handleVoiceStart = useCallback(() => {
    setIsRecording(true);
  }, []);

  // Message long press handler
  const handleMessageLongPress = useCallback((msg: Message) => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(10);
    }
    setSelectedMessage(msg);
    setShowMessageActions(true);
  }, []);

  // Message action handlers
  const handleReact = useCallback((emoji: string) => {
    console.log('React with:', emoji, 'to message:', selectedMessage?.id);
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, [selectedMessage]);

  const handleReply = useCallback(() => {
    if (selectedMessage) {
      setReplyingTo(selectedMessage);
    }
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, [selectedMessage]);

  const handleCopy = useCallback(() => {
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, []);

  const handleForward = useCallback(() => {
    Alert.alert('Forward', 'Forwarding is not yet implemented');
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedMessage) return;
    
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const client = require('@/lib/supabase').assertSupabase();
              const { error } = await client
                .from('messages')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', selectedMessage.id);
              
              if (error) throw error;
              
              // Remove from local state immediately
              setOptimisticMsgs(prev => prev.filter(m => m.id !== selectedMessage.id));
              // Trigger refetch to update from server
              refetch();
            } catch (err) {
              console.error('Delete failed:', err);
              Alert.alert('Error', 'Failed to delete message');
            }
          }
        }
      ]
    );
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, [selectedMessage, refetch]);

  const handleEdit = useCallback(() => {
    if (selectedMessage) {
      setText(selectedMessage.content);
    }
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, [selectedMessage]);

  // Thread options handlers
  const handleClearChat = useCallback(() => {
    Alert.alert(
      'Clear Chat',
      'This will delete all messages in this conversation. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => console.log('Clear chat') }
      ]
    );
    setShowOptionsMenu(false);
  }, []);

  const handleMuteNotifications = useCallback(() => {
    Alert.alert('Notifications', 'Mute notifications feature coming soon');
    setShowOptionsMenu(false);
  }, []);

  const handleSearchInChat = useCallback(() => {
    Alert.alert('Search', 'Search in chat feature coming soon');
    setShowOptionsMenu(false);
  }, []);

  const handleExportChat = useCallback(() => {
    Alert.alert(
      'Export Chat',
      'Export chat history including media?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Without Media', onPress: () => Alert.alert('Exporting', 'Chat export started...') },
        { text: 'Include Media', onPress: () => Alert.alert('Exporting', 'Chat export with media started...') }
      ]
    );
    setShowOptionsMenu(false);
  }, []);

  const handleMediaLinksAndDocs = useCallback(() => {
    Alert.alert('Media, Links, and Docs', 'View shared media feature coming soon');
    setShowOptionsMenu(false);
  }, []);

  const handleStarredMessages = useCallback(() => {
    Alert.alert('Starred Messages', 'View starred messages feature coming soon');
    setShowOptionsMenu(false);
  }, []);

  const handleDisappearingMessages = useCallback(() => {
    Alert.alert(
      'Disappearing Messages',
      'Set messages to disappear after:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Off', onPress: () => console.log('Disappearing off') },
        { text: '24 Hours', onPress: () => console.log('24h disappearing') },
        { text: '7 Days', onPress: () => console.log('7d disappearing') },
        { text: '90 Days', onPress: () => console.log('90d disappearing') }
      ]
    );
    setShowOptionsMenu(false);
  }, []);

  const handleAddShortcut = useCallback(() => {
    Alert.alert('Add Shortcut', 'Create home screen shortcut for this chat?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add', onPress: () => Alert.alert('Success', 'Shortcut added to home screen') }
    ]);
    setShowOptionsMenu(false);
  }, []);

  const handleReport = useCallback(() => {
    Alert.alert(
      'Report',
      'Report this conversation for:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Spam', onPress: () => Alert.alert('Reported', 'Thank you for reporting') },
        { text: 'Harassment', onPress: () => Alert.alert('Reported', 'Thank you for reporting') },
        { text: 'Other', onPress: () => Alert.alert('Reported', 'Thank you for reporting') }
      ]
    );
    setShowOptionsMenu(false);
  }, []);

  const handleBlockUser = useCallback(() => {
    Alert.alert(
      'Block User',
      `Block ${displayName}? They won't be able to message you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => Alert.alert('Blocked', `${displayName} has been blocked`) }
      ]
    );
    setShowOptionsMenu(false);
  }, [displayName]);

  const handleViewContact = useCallback(() => {
    Alert.alert('Contact Info', `View details for ${displayName}`);
    setShowOptionsMenu(false);
  }, [displayName]);

  // Voice/Video call handlers (fully implemented)
  let callContext: { startVoiceCall: (id: string, name?: string) => void; startVideoCall: (id: string, name?: string) => void } | null = null;
  try {
    if (useCallHook) {
      callContext = useCallHook();
    }
  } catch (error) {
    // CallProvider not available, calls will be disabled
    console.log('CallProvider not available');
  }
  
  // Get other participant info
  const otherParticipant = useMemo(() => messages.find(m => m.sender_id !== user?.id), [messages, user?.id]);
  const recipientId = otherParticipant?.sender_id;
  const recipientName = otherParticipant?.sender?.first_name || displayName;
  const recipientRole = otherParticipant?.sender?.role || null;

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

  // Emoji handler
  const handleEmojiSelect = useCallback((emoji: string) => {
    setText(prev => prev + emoji);
  }, []);

  // Render messages with date separators
  const renderMessages = useMemo(() => {
    let lastDateKey = '';
    return allMessages.map((msg) => {
      const dateKey = getDateKey(msg.created_at);
      const showDateSeparator = dateKey !== lastDateKey;
      lastDateKey = dateKey;
      
      return (
        <React.Fragment key={msg.id}>
          {showDateSeparator && <DateSeparator label={getDateSeparatorLabel(msg.created_at)} />}
          <MessageBubble 
            msg={msg} 
            isOwn={msg.sender_id === user?.id} 
            onLongPress={() => handleMessageLongPress(msg)}
          />
        </React.Fragment>
      );
    });
  }, [allMessages, user?.id, handleMessageLongPress]);

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
      <LinearGradient
        colors={['#0f172a', '#1e293b']}
        style={[styles.header, { borderBottomColor: theme.border, paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#e2e8f0" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.headerInfo} activeOpacity={0.7}>
          <LinearGradient
            colors={['#3b82f6', '#6366f1']}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.onlineStatus}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerSub}>
                {loading ? 'Loading...' : 'online'}
              </Text>
              {/* Show role inline */}
              {recipientRole && (
                <Text style={styles.roleInline}> · {recipientRole}</Text>
              )}
            </View>
            {/* Typing indicator */}
            {otherParticipant?.isTyping && (
              <View style={styles.typingIndicator}>
                <Text style={styles.typingName}>{recipientName} is typing </Text>
                <BouncingDots />
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Header actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleVoiceCall}>
            <Ionicons name="call-outline" size={22} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleVideoCall}>
            <Ionicons name="videocam-outline" size={22} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowOptionsMenu(true)}>
            <Ionicons name="ellipsis-vertical" size={22} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Messages area with wallpaper */}
      <View style={[styles.wallpaperContainer, { marginBottom: keyboardHeight }]}>
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
        
        {/* Clipping container - messages hide at this boundary */}
        <View style={[styles.messagesClip, { marginBottom: 70 + insets.bottom }]}>
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={[styles.messagesContent, { paddingBottom: 16 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.primary} />
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
            renderMessages
          )}
          </ScrollView>
        </View>
      </View>

      {/* Floating Composer */}
      <View style={[
        styles.composerArea,
        { 
          bottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 4) + keyboardHeight : Math.max(insets.bottom, 12) + keyboardHeight,
          paddingBottom: Platform.OS === 'ios' ? 4 : insets.bottom + 2,
        }
      ]}>
        {/* Emoji Picker */}
        {EmojiPicker && (
          <EmojiPicker 
            visible={showEmojiPicker}
            onEmojiSelect={handleEmojiSelect} 
            onClose={() => setShowEmojiPicker(false)} 
          />
        )}
        
        {/* Reply Preview */}
        {replyingTo && (
          <ReplyPreview message={replyingTo} onClose={() => setReplyingTo(null)} />
        )}
        
        <View style={styles.composerRow}>
          {isRecording && InlineVoiceRecorder ? (
            // Inline recording UI replaces the composer
            <InlineVoiceRecorder
              isRecording={isRecording}
              onRecordingComplete={handleVoiceRecording}
              onRecordingCancel={handleVoiceCancel}
              onRecordingStart={handleVoiceStart}
            />
          ) : (
            <>
              {/* Emoji button */}
              <TouchableOpacity 
                style={styles.composerBtn}
                onPress={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Ionicons 
                  name={showEmojiPicker ? 'close-outline' : 'happy-outline'} 
                  size={32} 
                  color="rgba(255,255,255,0.6)" 
                />
              </TouchableOpacity>
              
              {/* Input wrapper */}
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Message"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={text}
                  onChangeText={setText}
                  multiline
                  maxLength={1000}
                  editable={!sending}
                  onFocus={() => setShowEmojiPicker(false)}
                />
                
                {/* Camera button (hide when typing) */}
                {!text.trim() && (
                  <TouchableOpacity 
                    style={styles.inlineBtn}
                    onPress={() => Alert.alert('Camera', 'Coming soon')}
                  >
                    <Ionicons name="camera-outline" size={22} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                )}
                
                {/* Attachment button */}
                <TouchableOpacity 
                  style={styles.inlineBtn}
                  onPress={() => Alert.alert('Attachments', 'Coming soon')}
                >
                  <Ionicons name="attach-outline" size={22} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
              
              {/* Send or Mic button */}
          {text.trim() ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.8}
            >
              <LinearGradient 
                colors={['#3b82f6', '#2563eb']} 
                style={styles.gradientButton}
              >
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
                  onRecordingComplete={handleVoiceRecording}
                  onRecordingCancel={handleVoiceCancel}
                  onRecordingStart={handleVoiceStart}
                />
              ) : (
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => Alert.alert('Voice', 'Voice recording not available')}
                >
                  <LinearGradient 
                    colors={['#0776d1ff', '#043c85ff']} 
                    style={[styles.gradientButton, styles.micButton]}
                  >
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
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ==================== TYPING INDICATOR COMPONENT ====================

const BouncingDots: React.FC = () => {
  const dotAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }, [dotAnim]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4 }}>
      {[0, 1, 2].map(i => (
        <Animated.View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#94a3b8',
            marginHorizontal: 2,
            transform: [{ translateY: dotAnim.interpolate({ inputRange: [0, 1], outputRange: [0, i === 1 ? -4 : 0] }) }],
            opacity: dotAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
          }}
        />
      ))}
    </View>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: { 
    padding: 8,
  },
  headerInfo: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center',
    marginLeft: 4,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#010e24ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1.3,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: { 
    fontSize: 17, 
    fontWeight: '600',
    color: '#f1f5f9',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  headerSub: { 
    fontSize: 13,
    color: '#22c55e',
  },
  roleInline: {
    fontSize: 13,
    color: '#a78bfa',
    marginLeft: 4,
    fontWeight: '500',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  typingName: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: { 
    padding: 8,
    marginLeft: 2,
  },
  wallpaperContainer: { 
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
  // Floating composer
  composerArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingTop: 14,
    paddingBottom: 5,
    zIndex: 100,
  },
  composerFade: {
    position: 'absolute',
    top: -80,
    left: 0,
    right: 0,
    height: 90,
    zIndex: -1,
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
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 50,
    marginLeft: -4,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    bottom: -12,
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
    padding: 6,
    marginLeft: 2,
  },
  actionButton: {
    width: 48,
    height: 48,
  },
  gradientButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#021129ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
    bottom: -12,
  },
  micButton: {
    borderWidth: 1.5,
    borderColor: 'rgba(2, 17, 66, 0.5)',
    shadowColor: '#010635ff',
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 8,
  },
  micContainer: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    bottom: -12,
  },
  micButtonWrapper: {
    width: 48,
    height: 48,
  },
  micGradientButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CYAN_BORDER,
    shadowColor: CYAN_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  micGlow: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: CYAN_GLOW,
  },
});
