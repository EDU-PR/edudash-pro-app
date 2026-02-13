/**
 * Teacher Message Thread Screen
 * WhatsApp-style chat interface with online status, context menus, voice, and wallpapers.
 * Hook logic extracted to @/hooks/teacher-messaging/useTeacherMessageThread
 */
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ImageBackground } from 'react-native';
import { toast } from '@/components/ui/ToastProvider';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';

import {
  type Message,
  DateSeparator,
  MessageBubble,
  MessageComposer,
  ChatSearchOverlay,
  MediaGalleryView,
  StarredMessagesView,
} from '@/components/messaging';
import { SwipeableMessageRow } from '@/components/messaging/SwipeableMessageRow';
import { ChatHeader } from '@/components/messaging/ChatHeader';
import { TypingIndicator } from '@/components/messaging/TypingIndicator';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

import { useTeacherMessageThread, type ChatRow } from '@/hooks/teacher-messaging';
import { styles, COMPOSER_FLOAT_MARGIN, COMPOSER_FLOAT_GAP } from './teacher-message-thread.styles';

// Safe component imports
let ChatWallpaperPicker: React.FC<any> | null = null;
let MessageActionsMenu: React.FC<any> | null = null;
let ThreadOptionsMenu: React.FC<any> | null = null;
try { ChatWallpaperPicker = require('@/components/messaging/ChatWallpaperPicker').ChatWallpaperPicker; } catch {}
try { MessageActionsMenu = require('@/components/messaging/MessageActionsMenu').MessageActionsMenu; } catch {}
try { ThreadOptionsMenu = require('@/components/messaging/ThreadOptionsMenu').ThreadOptionsMenu; } catch {}

/** Wraps the message FlashList with the appropriate wallpaper background */
function MessageListWrapper({
  bgSource, wallpaperType, gradientColors, children,
}: {
  bgSource?: { uri: string };
  wallpaperType?: string;
  gradientColors: [string, string, ...string[]];
  children: React.ReactElement;
}) {
  if (bgSource) {
    return <ImageBackground source={bgSource} style={styles.messagesArea} resizeMode="cover">{children}</ImageBackground>;
  }
  if (wallpaperType === 'preset') {
    return <LinearGradient colors={gradientColors} style={styles.messagesArea}>{children}</LinearGradient>;
  }
  return <>{children}</>;
}

export default function TeacherMessageThreadScreen() {
  const {
    theme, user, insets, threadId, displayName,
    onlineStatus, lastSeenText, isOtherTyping, typingText,
    selectedMsg, replyTo, showOptions, setShowOptions,
    showActions, setShowActions, showWallpaper, setShowWallpaper,
    wallpaper, setWallpaper, sending, keyboardHeight,
    currentlyPlayingVoiceId, setCurrentlyPlayingVoiceId,
    listRef, isLoading, error, isPending,
    otherIds, voiceMessageIdsAsc,
    bgSource, bgColor, getWallpaperGradient, rowsAsc,
    messageViewportInset, messageBottomReserve,
    composerKeyboardOffset, composerBottomInset,
    composerSurfaceColor, composerBorderColor,
    handleSend, handleVoiceRecording, handleLongPress, handleReply,
    handleReact, handleReactionPress, handleToggleStar,
    handleVoiceCall, handleVideoCall, handleScroll, handleComposerLayout,
    handleClearChat, handleMuteNotifications, handleSearchInChat, handleExportChat,
    handleMediaLinksAndDocs, handleStarredMessages, handleDisappearingMessages,
    handleAddShortcut, handleReport, handleBlockUser, handleViewContact,
    isMuted, isUserBlocked, disappearingStatusLabel,
    showSearchOverlay, searchResults, searchQuery, isSearching, performSearch, closeSearch,
    showMediaGallery, closeMediaGallery,
    showStarredMessages: showStarredView, closeStarredMessages,
    refetch, setReplyTo,
  } = useTeacherMessageThread();

  // Scroll to a quoted message when tapped
  const handleScrollToMessage = useCallback((messageId: string) => {
    const idx = rowsAsc.findIndex((r: ChatRow) => r.type === 'message' && r.msg?.id === messageId);
    if (idx >= 0 && listRef?.current) {
      listRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
    }
  }, [rowsAsc, listRef]);

  const renderRow = useCallback(({ item }: { item: ChatRow }) => {
    if (item.type === 'date') return <DateSeparator label={item.label} />;
    const msg = item.msg;
    const voiceIndex = msg.voice_url ? voiceMessageIdsAsc.indexOf(msg.id) : -1;
    const hasNextVoice = voiceIndex >= 0 && voiceIndex < voiceMessageIdsAsc.length - 1;
    const hasPreviousVoice = voiceIndex > 0;

    return (
      <SwipeableMessageRow onSwipeReply={() => setReplyTo(msg)}>
        <MessageBubble
          msg={msg}
          isOwn={msg.sender_id === user?.id}
          onLongPress={() => handleLongPress(msg)}
          onPlaybackFinished={msg.voice_url ? () => {
            setCurrentlyPlayingVoiceId(hasNextVoice ? voiceMessageIdsAsc[voiceIndex + 1] : null);
          } : undefined}
          onPlayNext={hasNextVoice ? () => setCurrentlyPlayingVoiceId(voiceMessageIdsAsc[voiceIndex + 1]) : undefined}
          onPlayPrevious={hasPreviousVoice ? () => setCurrentlyPlayingVoiceId(voiceMessageIdsAsc[voiceIndex - 1]) : undefined}
          hasNextVoice={hasNextVoice}
          hasPreviousVoice={hasPreviousVoice}
          autoPlayVoice={!!msg.voice_url && currentlyPlayingVoiceId === msg.id}
          otherParticipantIds={otherIds}
          onReactionPress={handleReactionPress}
          onReplyPress={handleScrollToMessage}
          isFirstInGroup={item.isFirstInGroup}
          isLastInGroup={item.isLastInGroup}
        />
      </SwipeableMessageRow>
    );
  }, [currentlyPlayingVoiceId, handleLongPress, handleReactionPress, handleScrollToMessage, otherIds, user?.id, voiceMessageIdsAsc, setCurrentlyPlayingVoiceId, setReplyTo]);

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

  const emptyComponent = (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="rgba(148,163,184,0.4)" />
      <Text style={styles.emptyTitle}>Start the Conversation</Text>
      <Text style={styles.emptySubtitle}>Send a message to {displayName}</Text>
    </View>
  );

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
      <View style={styles.messagesWrapper}>
        <MessageListWrapper
          bgSource={bgSource}
          wallpaperType={wallpaper?.type}
          gradientColors={getWallpaperGradient()}
        >
          <FlashList
            ref={listRef}
            data={rowsAsc}
            renderItem={renderRow}
            keyExtractor={(item) => item.key}
            getItemType={(item) => item.type}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.scrollContent, { paddingBottom: messageViewportInset + messageBottomReserve }]}
            ListEmptyComponent={emptyComponent}
          />
        </MessageListWrapper>
      </View>

      {/* Typing Indicator */}
      {isOtherTyping && (
        <View style={{ position: 'absolute', left: 20, bottom: messageViewportInset + 4, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.85)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }}>
          <TypingIndicator color="#94a3b8" size={5} />
          <Text style={{ color: '#94a3b8', fontSize: 12, marginLeft: 6 }}>{typingText}</Text>
        </View>
      )}

      {/* Floating Composer */}
      <View style={[styles.composerKeyboard, { bottom: composerKeyboardOffset }]}>
        <View
          style={[styles.composerArea, {
            paddingBottom: keyboardHeight > 0 ? 8 : composerBottomInset,
            backgroundColor: composerSurfaceColor,
            borderColor: composerBorderColor,
            marginHorizontal: COMPOSER_FLOAT_MARGIN,
            marginBottom: COMPOSER_FLOAT_GAP,
          }]}
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
          onStar={handleToggleStar}
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

      <ChatSearchOverlay
        visible={showSearchOverlay} query={searchQuery}
        results={searchResults as any[]} isSearching={isSearching}
        onSearch={performSearch} onClose={closeSearch}
      />
      <MediaGalleryView visible={showMediaGallery} threadId={threadId || ''} onClose={closeMediaGallery} />
      <StarredMessagesView visible={showStarredView} threadId={threadId || ''} onClose={closeStarredMessages} />
    </View>
  );
}
