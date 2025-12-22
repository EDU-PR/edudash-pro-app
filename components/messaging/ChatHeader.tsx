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

interface ChatHeaderProps {
  displayName: string;
  isOnline: boolean;
  lastSeenText: string;
  isLoading: boolean;
  isTyping?: boolean;
  typingName?: string;
  recipientRole?: string | null;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onOptionsPress: () => void;
  borderColor?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  displayName,
  isOnline,
  lastSeenText,
  isLoading,
  isTyping,
  typingName,
  recipientRole,
  onVoiceCall,
  onVideoCall,
  onOptionsPress,
  borderColor = 'rgba(148, 163, 184, 0.15)',
}) => {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#0f172a', '#1e293b']}
      style={[styles.header, { borderBottomColor: borderColor, paddingTop: insets.top + 10 }]}
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
            <View style={[styles.onlineDot, !isOnline && styles.offlineDot]} />
            <Text style={styles.headerSub}>
              {isLoading ? 'Loading...' : isOnline ? 'Online' : lastSeenText}
            </Text>
            {recipientRole && (
              <Text style={styles.roleInline}> · {recipientRole}</Text>
            )}
          </View>
          {isTyping && (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingName}>{typingName} is typing </Text>
              <TypingIndicator />
            </View>
          )}
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
});
