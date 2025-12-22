/**
 * Message Bubble Component
 * WhatsApp-style chat bubble with voice support
 * Memoized to prevent flash on new messages
 */

import React from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageTicks } from './MessageTicks';
import { formatTime, isVoiceNote, getVoiceNoteDuration, getSenderName } from './utils';
import { toast } from '@/components/ui/ToastProvider';
import type { Message, MessageStatus } from './types';

// Try to import VoiceMessageBubble
let VoiceMessageBubble: React.FC<any> | null = null;
try {
  VoiceMessageBubble = require('@/components/messaging/VoiceMessageBubble').VoiceMessageBubble;
} catch {}

interface MessageBubbleProps {
  msg: Message;
  isOwn: boolean;
  onLongPress: () => void;
  otherParticipantIds?: string[];
}

export const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ 
  msg, 
  isOwn, 
  onLongPress, 
  otherParticipantIds = [] 
}) => {
  const name = getSenderName(msg.sender);

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
        duration={
          msg.voice_duration 
            ? (msg.voice_duration < 1000 ? msg.voice_duration * 1000 : msg.voice_duration)
            : getVoiceNoteDuration(msg.content)
        }
        isOwnMessage={isOwn}
        timestamp={formatTime(msg.created_at)}
        senderName={!isOwn ? name : undefined}
        isRead={msg.read_by?.some(id => otherParticipantIds.includes(id))}
        onLongPress={onLongPress}
      />
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={[styles.container, isOwn ? styles.own : styles.other]}
    >
      {!isOwn && (
        <Text style={styles.name}>{name}</Text>
      )}
      <LinearGradient
        colors={isOwn ? ['#3b82f6', '#2563eb'] : ['#1e293b', '#0f172a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          isVoice && styles.voiceBubble,
        ]}
      >
        {isVoice ? (
          <View style={styles.voiceContainer}>
            <View style={styles.voiceRow}>
              <TouchableOpacity 
                style={[styles.playBtn, isOwn ? styles.playBtnOwn : styles.playBtnOther]}
                onPress={() => toast.info('Voice playback requires audio URL', 'Voice Note')}
              >
                <Ionicons name="play" size={20} color={isOwn ? '#3b82f6' : '#fff'} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
              <View style={styles.waveformPlaceholder}>
                {[...Array(24)].map((_, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.waveBar,
                      { 
                        height: 6 + (i % 5) * 3,
                        backgroundColor: isOwn ? 'rgba(255,255,255,0.5)' : 'rgba(148,163,184,0.6)',
                      }
                    ]} 
                  />
                ))}
              </View>
              <Ionicons name="mic" size={14} color={isOwn ? 'rgba(255,255,255,0.6)' : '#64748b'} />
            </View>
            <Text style={[styles.voiceDuration, { color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748b' }]}>
              {Math.floor(getVoiceNoteDuration(msg.content) / 1000)}s
            </Text>
          </View>
        ) : (
          <Text style={[styles.text, { color: isOwn ? '#ffffff' : '#e2e8f0' }]}>
            {msg.content}
          </Text>
        )}
        <View style={styles.footer}>
          <Text style={[styles.time, { color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748b' }]}>
            {formatTime(msg.created_at)}
          </Text>
          {isOwn && (
            <View style={styles.ticksContainer}>
              <MessageTicks status={status} />
            </View>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}, (prevProps, nextProps) => {
  return prevProps.msg.id === nextProps.msg.id &&
         prevProps.isOwn === nextProps.isOwn &&
         JSON.stringify(prevProps.msg.read_by) === JSON.stringify(nextProps.msg.read_by) &&
         JSON.stringify(prevProps.msg.delivered_to) === JSON.stringify(nextProps.msg.delivered_to);
});

const styles = StyleSheet.create({
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
