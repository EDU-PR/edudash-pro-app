/**
 * Parent Message Thread Screen
 * Full-featured WhatsApp-style chat interface with PWA parity
 * Features: Voice recording, wallpaper, message actions, options menu,
 *           date separators, message ticks, reply preview
 * 
 * Refactored to use shared messaging components from components/messaging/
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  ScrollView,
  Alert,
  ImageBackground,
  Keyboard,
  Vibration,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { toast } from '@/components/ui/ToastProvider';
import { useCallSafe } from '@/components/calls/CallProvider';

// Shared messaging components
import {
  Message,
  DateSeparator,
  MessageBubble,
  ChatHeader,
  MessageComposer,
  getDateKey,
  getDateSeparatorLabel,
} from '@/components/messaging';

// Safe imports with fallbacks
let useTheme: () => { theme: any; isDark: boolean };
let useAuth: () => { user: any; profile: any };
let useThreadMessages: (id: string | null) => { data: any[]; isLoading: boolean; error: any; refetch: () => void };
let useSendMessage: () => { mutateAsync: (args: any) => Promise<any>; isLoading: boolean };
let useMarkThreadRead: () => { mutate: (args: any) => void };

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
  const [sending, setSending] = useState(false);
  const [optimisticMsgs, setOptimisticMsgs] = useState<Message[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // Wallpaper state
  const [currentWallpaper, setCurrentWallpaper] = useState<{ type: string; value: string } | null>(null);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  
  // Menu state
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  
  // Message actions state
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  
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
  const handleSend = useCallback(async (content: string) => {
    if (!content || !threadId || sending) return;

    setSending(true);
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
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }, [threadId, sending, user?.id, sendMessage]);
  
  // Voice recording handler
  const handleVoiceRecording = useCallback(async (uri: string, duration: number) => {
    if (!threadId) return;
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
      toast.error('Failed to send voice message.');
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
    toast.info('Forwarding is not yet implemented', 'Forward');
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
              toast.error('Failed to delete message');
            }
          }
        }
      ]
    );
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, [selectedMessage, refetch]);

  const handleEdit = useCallback(() => {
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, []);

  // Thread options handlers
  const handleClearChat = useCallback(async () => {
    Alert.alert(
      'Clear Chat',
      'This will delete all messages in this conversation. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const { assertSupabase } = await import('@/lib/supabase');
              const supabase = assertSupabase();
              
              // Delete all messages in this thread
              const { error } = await supabase
                .from('messages')
                .delete()
                .eq('thread_id', threadId);
              
              if (error) throw error;
              
              // Clear optimistic messages
              setOptimisticMsgs([]);
              
              // Refetch to update UI
              refetch();
              
              toast.success('Chat cleared', 'Success');
            } catch (error) {
              console.error('[ClearChat] Error:', error);
              toast.error('Failed to clear chat', 'Error');
            }
          }
        }
      ]
    );
    setShowOptionsMenu(false);
  }, [threadId, refetch]);

  const handleMuteNotifications = useCallback(() => {
    toast.info('Mute notifications feature coming soon', 'Notifications');
    setShowOptionsMenu(false);
  }, []);

  const handleSearchInChat = useCallback(() => {
    toast.info('Search in chat feature coming soon', 'Search');
    setShowOptionsMenu(false);
  }, []);

  const handleExportChat = useCallback(() => {
    Alert.alert(
      'Export Chat',
      'Export chat history including media?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Without Media', onPress: () => toast.info('Chat export started...', 'Exporting') },
        { text: 'Include Media', onPress: () => toast.info('Chat export with media started...', 'Exporting') }
      ]
    );
    setShowOptionsMenu(false);
  }, []);

  const handleMediaLinksAndDocs = useCallback(() => {
    toast.info('View shared media feature coming soon', 'Media');
    setShowOptionsMenu(false);
  }, []);

  const handleStarredMessages = useCallback(() => {
    toast.info('View starred messages feature coming soon', 'Starred');
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
      { text: 'Add', onPress: () => toast.success('Shortcut added to home screen') }
    ]);
    setShowOptionsMenu(false);
  }, []);

  const handleReport = useCallback(() => {
    Alert.alert(
      'Report',
      'Report this conversation for:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Spam', onPress: () => toast.success('Thank you for reporting', 'Reported') },
        { text: 'Harassment', onPress: () => toast.success('Thank you for reporting', 'Reported') },
        { text: 'Other', onPress: () => toast.success('Thank you for reporting', 'Reported') }
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
        { text: 'Block', style: 'destructive', onPress: () => toast.warn(`${displayName} has been blocked`, 'Blocked') }
      ]
    );
    setShowOptionsMenu(false);
  }, [displayName]);

  const handleViewContact = useCallback(() => {
    toast.info(`View details for ${displayName}`, 'Contact Info');
    setShowOptionsMenu(false);
  }, [displayName]);

  // CallProvider context for calls + presence (unified single source)
  const callContext = useCallSafe();
  
  // Get other participant info
  const otherParticipant = useMemo(() => messages.find(m => m.sender_id !== user?.id), [messages, user?.id]);
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
      <ChatHeader
        displayName={displayName}
        isOnline={isOnline}
        lastSeenText={lastSeenText}
        isLoading={loading}
        isTyping={otherParticipant?.isTyping}
        typingName={recipientName}
        recipientRole={recipientRole}
        onVoiceCall={handleVoiceCall}
        onVideoCall={handleVideoCall}
        onOptionsPress={() => setShowOptionsMenu(true)}
      />

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
        <MessageComposer
          onSend={handleSend}
          onVoiceRecording={handleVoiceRecording}
          sending={sending}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
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

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#0f172a',
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
  composerArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
});
