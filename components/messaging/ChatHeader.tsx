/**
 * Chat Header Component
 * WhatsApp-style header with avatar, online status, and action buttons
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TypingIndicator } from './TypingIndicator';
import { ConnectionStatusBar } from './ConnectionStatusBar';

interface ChatHeaderProps {
  displayName: string;
  isOnline: boolean;
  lastSeenText: string;
  isLoading: boolean;
  isGroup?: boolean;
  participantCount?: number;
  onlineCount?: number;
  isTyping?: boolean;
  typingName?: string;
  typingText?: string | null;
  recipientRole?: string | null;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onOptionsPress: () => void;
  onHeaderPress?: () => void;
  borderColor?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  displayName,
  isOnline,
  lastSeenText,
  isLoading,
  isGroup = false,
  participantCount,
  onlineCount = 0,
  isTyping,
  typingName,
  typingText,
  recipientRole,
  onVoiceCall,
  onVideoCall,
  onOptionsPress,
  onHeaderPress,
  borderColor = 'rgba(148, 163, 184, 0.15)',
}) => {
  const insets = useSafeAreaInsets();
  const typingLabel = typingText || (typingName ? `${typingName} is typing...` : 'Typing...');
  const isAway = !isOnline && lastSeenText === 'Away';
  const statusColor = isTyping
    ? '#fbbf24'
    : isGroup
      ? '#60a5fa'
    : isOnline
      ? '#22c55e'
      : isAway
        ? '#f59e0b'
        : '#94a3b8';
  const groupSubtitle = isGroup
    ? `${onlineCount} online${typeof participantCount === 'number' ? ` • ${participantCount} member${participantCount === 1 ? '' : 's'}` : ''}`
    : null;
  const subtitle = isLoading
    ? 'Loading...'
    : isTyping
      ? typingLabel
      : groupSubtitle || (isOnline ? 'Online' : lastSeenText);

  return (
    <>
    <LinearGradient
      colors={['#0f172a', '#1e293b']}
      style={[styles.header, { borderBottomColor: borderColor, paddingTop: insets.top + 10 }]}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color="#e2e8f0" />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.headerInfo}
        activeOpacity={onHeaderPress ? 0.7 : 1}
        onPress={onHeaderPress}
        disabled={!onHeaderPress}
      >
        <LinearGradient
          colors={['#3b82f6', '#6366f1']}
          style={styles.avatar}
        >
          {isGroup ? (
            <Ionicons name="people" size={20} color="#fff" />
          ) : (
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          )}
        </LinearGradient>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.onlineStatus}>
            <View style={[
              styles.onlineDot,
              isGroup && styles.groupDot,
              !isGroup && (!isOnline || isTyping) && styles.offlineDot,
              !isGroup && isAway && styles.awayDot,
            ]} />
            <Text style={[styles.headerSub, { color: statusColor }]}>
              {subtitle}
            </Text>
            {recipientRole && !isTyping && !isGroup && (
              <Text style={styles.roleInline}> · {recipientRole}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.headerBtn} onPress={onVoiceCall}>
          <Ionicons name="call-outline" size={22} color="#94a3b8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={onVideoCall}>
          <Ionicons name="videocam-outline" size={22} color="#94a3b8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={onOptionsPress}>
          <Ionicons name="ellipsis-vertical" size={22} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
    <ConnectionStatusBar />
    </>
  );
};

const styles = StyleSheet.create({
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
  offlineDot: {
    backgroundColor: '#64748b',
  },
  awayDot: {
    backgroundColor: '#f59e0b',
  },
  groupDot: {
    backgroundColor: '#60a5fa',
  },
  headerSub: { 
    fontSize: 13,
    color: '#94a3b8',
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
});
