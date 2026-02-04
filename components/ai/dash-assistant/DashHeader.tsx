/**
 * DashHeader Component
 * 
 * Header bar for Dash AI Assistant with title, tier badge, and action buttons.
 * Extracted from DashAssistant for WARP.md compliance.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { TierBadge } from '@/components/ui/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';

type Theme = ReturnType<typeof useTheme>['theme'];

const { width: screenWidth } = Dimensions.get('window');

interface RoleCopy {
  title: string;
  subtitle: string;
}

interface TutorSession {
  id: string;
  mode: string;
  questionIndex: number;
  totalQuestions: number;
  correctCount: number;
  maxQuestions: number;
}

interface DashHeaderProps {
  tutorSession?: TutorSession | null;
  roleCopy: RoleCopy;
  tier: string | null;
  subReady: boolean;
  isSpeaking: boolean;
  showAdvancedControls: boolean;
  showWakeWordToggle: boolean;
  wakeWordEnabled: boolean;
  wakeWordLoaded: boolean;
  onClose?: () => void;
  stopSpeaking: () => void;
  handleNewChat: () => void;
  toggleWakeWord: () => void;
  cleanup?: () => void;
  styles: any;
  theme: Theme;
}

export const DashHeader: React.FC<DashHeaderProps> = ({
  roleCopy,
  tier,
  subReady,
  isSpeaking,
  showAdvancedControls,
  showWakeWordToggle,
  wakeWordEnabled,
  wakeWordLoaded,
  tutorSession,
  onClose,
  stopSpeaking,
  handleNewChat,
  toggleWakeWord,
  cleanup,
  styles,
  theme,
}) => {
  return (
    <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      <View style={styles.headerLeft}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {roleCopy.title}
            </Text>
            {subReady && tier && (
              <TierBadge tier={tier as any} size="sm" />
            )}
          </View>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {roleCopy.subtitle}
          </Text>
          {tutorSession && tutorSession.maxQuestions > 0 && (
            <View style={{ marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '500' }}>
                  Question {tutorSession.totalQuestions + 1} of {tutorSession.maxQuestions}
                </Text>
                <Text style={{ fontSize: 11, color: theme.success, fontWeight: '600' }}>
                  • {tutorSession.correctCount} correct
                </Text>
              </View>
              <View style={{ 
                height: 3, 
                backgroundColor: theme.border, 
                borderRadius: 2, 
                marginTop: 4,
                overflow: 'hidden'
              }}>
                <View style={{ 
                  height: '100%', 
                  width: `${Math.min(100, (tutorSession.totalQuestions / tutorSession.maxQuestions) * 100)}%`,
                  backgroundColor: theme.primary,
                }} />
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={styles.headerRight}>
        {isSpeaking && (
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.error }]}
            accessibilityLabel="Stop speaking"
            onPress={stopSpeaking}
          >
            <Ionicons name="stop" size={screenWidth < 400 ? 18 : 22} color={theme.onError || theme.background} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.iconButton}
          accessibilityLabel="New chat"
          onPress={handleNewChat}
        >
          <Ionicons name="add-circle-outline" size={screenWidth < 400 ? 18 : 22} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          accessibilityLabel="Conversations"
          onPress={() => router.push('/screens/dash-conversations-history')}
        >
          <Ionicons name="time-outline" size={screenWidth < 400 ? 18 : 22} color={theme.text} />
        </TouchableOpacity>
        {showAdvancedControls && (
          <TouchableOpacity
            style={styles.iconButton}
            accessibilityLabel="Open Dash Orb"
            onPress={() => router.push('/screens/dash-orb')}
          >
            <Ionicons name="grid-outline" size={screenWidth < 400 ? 18 : 22} color={theme.text} />
          </TouchableOpacity>
        )}
        {showWakeWordToggle && (
          <TouchableOpacity
            style={styles.iconButton}
            accessibilityLabel="Toggle wake word"
            onPress={toggleWakeWord}
            disabled={!wakeWordLoaded}
          >
            <Ionicons
              name={wakeWordEnabled ? 'ear' : 'ear-outline'}
              size={screenWidth < 400 ? 18 : 22}
              color={wakeWordEnabled ? theme.success : theme.text}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.iconButton}
          accessibilityLabel="Settings"
          onPress={() => router.push('/screens/dash-ai-settings')}
        >
          <Ionicons name="settings-outline" size={screenWidth < 400 ? 18 : 22} color={theme.text} />
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={async () => {
              await stopSpeaking();
              cleanup?.();
              onClose();
            }}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={screenWidth < 400 ? 20 : 24} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
