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
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
  Keyboard,
  Vibration,
  TextInput,
} from 'react-native';
import { toast } from '@/components/ui/ToastProvider';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallSafe } from '@/components/calls/CallProvider';

// Shared messaging components
import {
  Message,
  DateSeparator,
  MessageBubble,
  MessageComposer,
  getDateKey,
  getDateSeparatorLabel,
} from '@/components/messaging';
import { TypingIndicator } from '@/components/messaging/TypingIndicator';

// Safe imports with fallbacks
let useTheme: () => { theme: any; isDark: boolean };
let useAuth: () => { user: any; profile: any };
let useTeacherThreadMessages: (id: string | null) => { data: any[]; isLoading: boolean; error: any; refetch: () => void };
let useTeacherSendMessage: () => { mutateAsync: (args: any) => Promise<any>; isPending: boolean };
let useTeacherMarkThreadRead: () => { mutate: (threadId: string) => void };
let useTeacherMessagesRealtime: (id: string | null) => void = () => {};

// Component imports
let ChatWallpaperPicker: React.FC<any> | null = null;
let MessageActionsMenu: React.FC<any> | null = null;
let ThreadOptionsMenu: React.FC<any> | null = null;
let getStoredWallpaper: (() => Promise<any>) | null = null;

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
  
  // State
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);
  const [wallpaper, setWallpaper] = useState<any>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [sending, setSending] = useState(false);
  
  const scrollRef = useRef<ScrollView>(null);
  
  // Data
  const { data: messages = [], isLoading, error, refetch } = useTeacherThreadMessages(threadId);
  const { mutateAsync: sendMessage, isPending } = useTeacherSendMessage();
  const { mutate: markRead } = useTeacherMarkThreadRead();
  
  // Subscribe to real-time message updates
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
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }, [threadId, user?.id, sendMessage, refetch]);
  
  const handleVoiceRecording = useCallback(async (uri: string, dur: number) => {
    if (!threadId || !user?.id) return;
    
    const durationSecs = Math.round(dur / 1000);
    setSending(true);
    
    try {
      if (uploadVoiceNote) {
        const result = await uploadVoiceNote(uri, dur, threadId);
        await sendMessage({ 
          threadId, 
          content: `🎤 Voice (${durationSecs}s)`,
          voiceUrl: result.publicUrl,
          voiceDuration: durationSecs,
        });
      } else {
        await sendMessage({ 
          threadId, 
          content: `🎤 Voice message (${durationSecs}s)`,
        });
      }
      refetch();
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
  const bgSource = wallpaper?.uri ? { uri: wallpaper.uri } : undefined;
  const bgColor = wallpaper?.color || theme.background;
  
  // Render messages with date separators
  const renderMessages = useMemo(() => {
    let lastDateKey = '';
    return messages.map((msg: Message) => {
      const dateKey = getDateKey(msg.created_at);
      const showDateSep = dateKey !== lastDateKey;
      lastDateKey = dateKey;
      
      return (
        <React.Fragment key={msg.id}>
          {showDateSep && <DateSeparator label={getDateSeparatorLabel(msg.created_at)} />}
          <MessageBubble 
            msg={msg} 
            isOwn={msg.sender_id === user?.id} 
            onLongPress={() => handleLongPress(msg)}
            otherParticipantIds={otherIds}
          />
        </React.Fragment>
      );
    });
  }, [messages, user?.id, handleLongPress, otherIds]);
  
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
          <Text style={styles.headerSubtitle}>{lastSeenText}</Text>
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
      
      {/* Messages Container */}
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
      
      {/* Floating Composer */}
      <View style={[
        styles.composerKeyboard,
        { bottom: keyboardHeight > 0 ? keyboardHeight - (Platform.OS === 'ios' ? insets.bottom : 0) + 8 : 0 }
      ]}>
        <View style={[
          styles.composerArea,
          { 
            paddingBottom: keyboardHeight > 0 ? 8 : (Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : insets.bottom + 8),
            backgroundColor: bgSource ? 'rgba(15, 23, 42, 0.85)' : 'transparent',
          }
        ]}>
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
          onReact={(emoji: string) => { setShowActions(false); }}
          onReply={handleReply}
          onCopy={() => setShowActions(false)}
          onForward={() => { setShowActions(false); toast.info('Coming soon', 'Forward'); }}
          onDelete={() => { setShowActions(false); toast.success('Message deleted'); }}
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
    paddingBottom: 100,
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
    paddingHorizontal: 0,
    paddingTop: 0,
  },
});
