import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DashOrb from './DashOrb';

interface InlineTutorPreviewProps {
  childName: string;
  /** Called when user wants to open the full tutor screen */
  onOpenFullSession: () => void;
  /** Called when user sends a message from the inline preview */
  onSendMessage?: (text: string) => void;
}

/**
 * Inline tutor session preview card.
 * Shows a mini chat-like view embedded in the dashboard with a sample
 * greeting and quick-start controls. Matches the next-gen mockup.
 */
export default function InlineTutorPreview({
  childName,
  onOpenFullSession,
  onSendMessage,
}: InlineTutorPreviewProps) {
  const [inputText, setInputText] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isListening, setIsListening] = useState(false);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    onSendMessage?.(inputText.trim());
    setInputText('');
    onOpenFullSession();
  }, [inputText, onSendMessage, onOpenFullSession]);

  const handleStop = useCallback(() => {
    setIsActive(false);
    setIsListening(false);
  }, []);

  const handleResume = useCallback(() => {
    setIsActive(true);
  }, []);

  const handleMicToggle = useCallback(() => {
    setIsListening((prev) => !prev);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Current Tutor Session</Text>
        <TouchableOpacity onPress={onOpenFullSession} hitSlop={8}>
          <Text style={styles.expandText}>Expand ↗</Text>
        </TouchableOpacity>
      </View>

      {/* Chat area */}
      <TouchableOpacity
        style={[styles.chatArea, !isActive && styles.chatAreaCollapsed]}
        activeOpacity={0.9}
        onPress={onOpenFullSession}
      >
        {/* Tutor identity row */}
        <View style={styles.identityRow}>
          <DashOrb size={32} />
          <View style={styles.identityText}>
            <Text style={styles.identityName}>Interactive Tutor Session</Text>
            <Text style={styles.identityHint}>
              Personalisable • Holistic at PhaseLevel terms
            </Text>
          </View>
        </View>

        {/* Sample message */}
        <View style={styles.messageBubble}>
          <Text style={styles.messageText}>
            Hello {childName}! Let's explore a new{'\n'}
            World! cansagen.
          </Text>
        </View>

        {/* Sample practice hint */}
        <Text style={styles.practiceHint}>
          We'll Learn made shar Practice, berma a napetly!
        </Text>

        {/* Sample interactive cards */}
        <View style={styles.sampleCards}>
          <View style={styles.sampleCard}>
            <Text style={styles.sampleCardIcon}>✦</Text>
            <Text style={styles.sampleCardText}>
              What is{' '}
              <Text style={styles.sampleBold}>5</Text> simplified to its lowest
              terms?
            </Text>
          </View>
          <View style={styles.answerRow}>
            <AnswerChip icon="📐" label="2/3" />
            <AnswerChip icon="" label="1/3" />
          </View>
          <View style={styles.answerRow}>
            <AnswerChip icon="📊" label="1/2" />
            <AnswerChip icon="" label="2/5" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Bottom controls */}
      <View style={styles.controls}>
        {isActive ? (
          <TouchableOpacity style={styles.controlBtn} onPress={handleStop}>
            <View style={styles.stopDot} />
            <Text style={styles.controlLabel}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.resumeBtn} onPress={handleResume}>
            <Ionicons name="play" size={12} color="#3C8E62" />
            <Text style={styles.resumeLabel}>Resume</Text>
          </TouchableOpacity>
        )}
        <View style={styles.langPills}>
          <Text style={styles.langPill}>EN</Text>
          <Text style={styles.langPillInactive}>AF</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.micBtn,
            isListening && styles.micBtnActive,
          ]}
          onPress={handleMicToggle}
          disabled={!isActive}
        >
          <Ionicons
            name={isListening ? 'mic' : 'mic-outline'}
            size={18}
            color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AnswerChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.answerChip}>
      {icon ? <Text style={styles.answerIcon}>{icon}</Text> : null}
      <Text style={styles.answerLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  expandText: {
    color: 'rgba(234,240,255,0.50)',
    fontSize: 12,
    fontWeight: '600',
  },
  chatArea: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(90,64,157,0.15)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(90,64,157,0.20)',
  },
  identityText: {
    marginLeft: 10,
    flex: 1,
  },
  identityName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  identityHint: {
    color: 'rgba(234,240,255,0.45)',
    fontSize: 10,
    marginTop: 1,
  },
  messageBubble: {
    backgroundColor: 'rgba(60,142,98,0.15)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(60,142,98,0.20)',
  },
  messageText: {
    color: 'rgba(234,240,255,0.85)',
    fontSize: 13,
    lineHeight: 19,
  },
  practiceHint: {
    color: 'rgba(234,240,255,0.55)',
    fontSize: 12,
    marginBottom: 10,
  },
  sampleCards: {
    gap: 6,
  },
  sampleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 6,
  },
  sampleCardIcon: {
    color: '#C7BFFF',
    fontSize: 14,
    marginTop: 1,
  },
  sampleCardText: {
    color: 'rgba(234,240,255,0.75)',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  sampleBold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  answerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  answerChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  answerIcon: {
    fontSize: 14,
  },
  answerLabel: {
    color: 'rgba(234,240,255,0.80)',
    fontSize: 13,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  controlLabel: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60,142,98,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  resumeLabel: {
    color: '#3C8E62',
    fontSize: 12,
    fontWeight: '600',
  },
  chatAreaCollapsed: {
    opacity: 0.4,
  },
  micBtnActive: {
    backgroundColor: '#EF4444',
  },
  langPills: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  langPill: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(60,142,98,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  langPillInactive: {
    color: 'rgba(234,240,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  micBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#3C8E62',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
