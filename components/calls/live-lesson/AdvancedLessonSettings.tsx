/**
 * Advanced Lesson Settings
 * 
 * Mobile component for advanced live lesson configuration options.
 * Matches PWA features with tier-gated access and upgrade prompts.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface AdvancedSettings {
  // Privacy & Access
  isPrivateRoom: boolean;
  enableKnocking: boolean;
  enablePrejoinUI: boolean;
  
  // Audio/Video Settings
  camerasOnStart: boolean;
  microphonesOnStart: boolean;
  
  // Features
  enableScreenShare: boolean;
  enableBreakoutRooms: boolean;
  chatMode: 'off' | 'basic' | 'advanced';
  enableEmojiReactions: boolean;
  
  // UI Features
  enablePeopleUI: boolean;
  enableBackgroundEffects: boolean;
  enablePictureInPicture: boolean;
  enableHandRaising: boolean;
  enableNetworkUI: boolean;
  enableNoiseCancellation: boolean;
  enableLiveCaptions: boolean;
  
  // Recording
  recordingMode: 'off' | 'local' | 'cloud';
  
  // Owner Controls
  ownerOnlyBroadcast: boolean;
  
  // Other
  maxParticipants: number;
}

interface AdvancedLessonSettingsProps {
  settings: AdvancedSettings;
  onSettingsChange: (settings: AdvancedSettings) => void;
  subscriptionTier: string;
  colors: {
    background: string;
    text: string;
    textMuted: string;
    accent: string;
    accentLight: string;
    border: string;
    cardBg: string;
  };
}

// Tier-based feature availability
const TIER_FEATURES = {
  free: {
    maxParticipants: 10,
    recording: false,
    breakoutRooms: false,
    liveCaptions: false,
    cloudRecording: false,
    noiseCancellation: false,
  },
  starter: {
    maxParticipants: 25,
    recording: false,
    breakoutRooms: false,
    liveCaptions: false,
    cloudRecording: false,
    noiseCancellation: true,
  },
  basic: {
    maxParticipants: 50,
    recording: true,
    breakoutRooms: false,
    liveCaptions: false,
    cloudRecording: false,
    noiseCancellation: true,
  },
  premium: {
    maxParticipants: 100,
    recording: true,
    breakoutRooms: true,
    liveCaptions: true,
    cloudRecording: false,
    noiseCancellation: true,
  },
  pro: {
    maxParticipants: 200,
    recording: true,
    breakoutRooms: true,
    liveCaptions: true,
    cloudRecording: true,
    noiseCancellation: true,
  },
  enterprise: {
    maxParticipants: 500,
    recording: true,
    breakoutRooms: true,
    liveCaptions: true,
    cloudRecording: true,
    noiseCancellation: true,
  },
};

export function AdvancedLessonSettings({
  settings,
  onSettingsChange,
  subscriptionTier,
  colors,
}: AdvancedLessonSettingsProps) {
  const tier = subscriptionTier.toLowerCase().replace('school_', '');
  const tierFeatures = TIER_FEATURES[tier as keyof typeof TIER_FEATURES] || TIER_FEATURES.free;

  const updateSetting = <K extends keyof AdvancedSettings>(
    key: K,
    value: AdvancedSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const showUpgradePrompt = (featureName: string, requiredTier: string) => {
    Alert.alert(
      `${featureName} - Upgrade Required`,
      `This feature is available on ${requiredTier} plans and above. Upgrade to unlock advanced features.`,
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'View Plans',
          onPress: () => {
            // Navigate to subscription page
            Linking.openURL('edudashpro://subscription-setup');
          },
        },
      ]
    );
  };

  const renderToggle = (
    label: string,
    description: string,
    value: boolean,
    onChange: (value: boolean) => void,
    icon: keyof typeof Ionicons.glyphMap,
    disabled?: boolean,
    requiredTier?: string
  ) => (
    <TouchableOpacity
      style={[
        styles.settingRow,
        { backgroundColor: colors.cardBg, borderColor: colors.border },
        disabled && styles.settingRowDisabled,
      ]}
      onPress={() => {
        if (disabled && requiredTier) {
          showUpgradePrompt(label, requiredTier);
        } else {
          onChange(!value);
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.accentLight }]}>
          <Ionicons name={icon} size={18} color={colors.accent} />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.settingDescription, { color: colors.textMuted }]}>
            {description}
          </Text>
        </View>
      </View>
      <View style={styles.settingRight}>
        {disabled && requiredTier && (
          <View style={styles.upgradeBadge}>
            <Ionicons name="lock-closed" size={10} color="#f59e0b" />
            <Text style={styles.upgradeBadgeText}>{requiredTier}</Text>
          </View>
        )}
        <View
          style={[
            styles.toggle,
            { backgroundColor: value && !disabled ? colors.accent : colors.border },
            disabled && styles.toggleDisabled,
          ]}
        >
          <View
            style={[
              styles.toggleKnob,
              value && !disabled && styles.toggleKnobActive,
            ]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSelector = (
    label: string,
    description: string,
    options: { value: string; label: string }[],
    value: string,
    onChange: (value: string) => void,
    icon: keyof typeof Ionicons.glyphMap,
    disabled?: boolean,
    requiredTier?: string
  ) => (
    <View style={[styles.selectorContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={styles.selectorHeader}>
        <View style={[styles.iconContainer, { backgroundColor: colors.accentLight }]}>
          <Ionicons name={icon} size={18} color={colors.accent} />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.settingDescription, { color: colors.textMuted }]}>
            {description}
          </Text>
        </View>
        {disabled && requiredTier && (
          <View style={styles.upgradeBadge}>
            <Ionicons name="lock-closed" size={10} color="#f59e0b" />
            <Text style={styles.upgradeBadgeText}>{requiredTier}</Text>
          </View>
        )}
      </View>
      <View style={styles.selectorOptions}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.selectorOption,
              { borderColor: colors.border },
              value === option.value && { borderColor: colors.accent, backgroundColor: colors.accentLight },
              disabled && styles.selectorOptionDisabled,
            ]}
            onPress={() => {
              if (disabled && requiredTier) {
                showUpgradePrompt(label, requiredTier);
              } else {
                onChange(option.value);
              }
            }}
          >
            <Text
              style={[
                styles.selectorOptionText,
                { color: colors.text },
                value === option.value && { color: colors.accent },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Privacy & Access Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy & Access</Text>
        
        {renderToggle(
          'Private Room',
          'Only invited participants can join',
          settings.isPrivateRoom,
          (v) => updateSetting('isPrivateRoom', v),
          'lock-closed'
        )}
        
        {renderToggle(
          'Enable Knocking',
          'Participants must request to join',
          settings.enableKnocking,
          (v) => updateSetting('enableKnocking', v),
          'hand-left'
        )}
        
        {renderToggle(
          'Prejoin Screen',
          'Show camera/mic preview before joining',
          settings.enablePrejoinUI,
          (v) => updateSetting('enablePrejoinUI', v),
          'eye'
        )}
      </View>

      {/* Audio/Video Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Audio & Video</Text>
        
        {renderToggle(
          'Cameras On Start',
          'Turn on cameras when participants join',
          settings.camerasOnStart,
          (v) => updateSetting('camerasOnStart', v),
          'videocam'
        )}
        
        {renderToggle(
          'Microphones On Start',
          'Turn on microphones when participants join',
          settings.microphonesOnStart,
          (v) => updateSetting('microphonesOnStart', v),
          'mic'
        )}

        {renderToggle(
          'Noise Cancellation',
          'Reduce background noise during calls',
          settings.enableNoiseCancellation,
          (v) => updateSetting('enableNoiseCancellation', v),
          'volume-mute',
          !tierFeatures.noiseCancellation,
          'Starter'
        )}
      </View>

      {/* Features Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Features</Text>
        
        {renderToggle(
          'Screen Sharing',
          'Allow participants to share their screen',
          settings.enableScreenShare,
          (v) => updateSetting('enableScreenShare', v),
          'share'
        )}
        
        {renderToggle(
          'Breakout Rooms',
          'Create smaller group sessions',
          settings.enableBreakoutRooms,
          (v) => updateSetting('enableBreakoutRooms', v),
          'git-branch',
          !tierFeatures.breakoutRooms,
          'Premium'
        )}

        {renderSelector(
          'Chat Mode',
          'Control in-call chat functionality',
          [
            { value: 'off', label: 'Off' },
            { value: 'basic', label: 'Basic' },
            { value: 'advanced', label: 'Advanced' },
          ],
          settings.chatMode,
          (v) => updateSetting('chatMode', v as 'off' | 'basic' | 'advanced'),
          'chatbubbles'
        )}
        
        {renderToggle(
          'Emoji Reactions',
          'Allow emoji reactions during calls',
          settings.enableEmojiReactions,
          (v) => updateSetting('enableEmojiReactions', v),
          'happy'
        )}

        {renderToggle(
          'Hand Raising',
          'Allow participants to raise their hand',
          settings.enableHandRaising,
          (v) => updateSetting('enableHandRaising', v),
          'hand-left'
        )}

        {renderToggle(
          'Live Captions',
          'Enable real-time captions',
          settings.enableLiveCaptions,
          (v) => updateSetting('enableLiveCaptions', v),
          'text',
          !tierFeatures.liveCaptions,
          'Premium'
        )}
      </View>

      {/* Recording Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recording</Text>
        
        {renderSelector(
          'Recording Mode',
          'Record the lesson for later viewing',
          [
            { value: 'off', label: 'Off' },
            { value: 'local', label: 'Local' },
            { value: 'cloud', label: 'Cloud' },
          ],
          settings.recordingMode,
          (v) => updateSetting('recordingMode', v as 'off' | 'local' | 'cloud'),
          'recording',
          !tierFeatures.recording,
          'Basic'
        )}
      </View>

      {/* UI Features Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>UI Features</Text>
        
        {renderToggle(
          'Background Effects',
          'Allow virtual backgrounds and blur',
          settings.enableBackgroundEffects,
          (v) => updateSetting('enableBackgroundEffects', v),
          'color-palette'
        )}
        
        {renderToggle(
          'Picture in Picture',
          'Enable floating video window',
          settings.enablePictureInPicture,
          (v) => updateSetting('enablePictureInPicture', v),
          'albums'
        )}

        {renderToggle(
          'Network Quality',
          'Show connection quality indicator',
          settings.enableNetworkUI,
          (v) => updateSetting('enableNetworkUI', v),
          'wifi'
        )}

        {renderToggle(
          'People Panel',
          'Show participant list panel',
          settings.enablePeopleUI,
          (v) => updateSetting('enablePeopleUI', v),
          'people'
        )}
      </View>

      {/* Owner Controls Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Owner Controls</Text>
        
        {renderToggle(
          'Owner Only Broadcast',
          'Only meeting owner can share camera/screen',
          settings.ownerOnlyBroadcast,
          (v) => updateSetting('ownerOnlyBroadcast', v),
          'shield-checkmark'
        )}
      </View>

      {/* Max Participants */}
      <View style={[styles.section, styles.lastSection]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Capacity</Text>
        
        <View style={[styles.capacityCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.capacityHeader}>
            <Ionicons name="people" size={24} color={colors.accent} />
            <Text style={[styles.capacityTitle, { color: colors.text }]}>Max Participants</Text>
          </View>
          <Text style={[styles.capacityValue, { color: colors.accent }]}>
            {tierFeatures.maxParticipants}
          </Text>
          <Text style={[styles.capacityNote, { color: colors.textMuted }]}>
            Based on your {subscriptionTier} plan
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  lastSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  settingRowDisabled: {
    opacity: 0.7,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 2,
    justifyContent: 'center',
  },
  toggleDisabled: {
    opacity: 0.5,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  upgradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  upgradeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#f59e0b',
  },
  selectorContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectorOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  selectorOptionDisabled: {
    opacity: 0.5,
  },
  selectorOptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  capacityCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  capacityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  capacityTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  capacityValue: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 4,
  },
  capacityNote: {
    fontSize: 12,
  },
});

export default AdvancedLessonSettings;
