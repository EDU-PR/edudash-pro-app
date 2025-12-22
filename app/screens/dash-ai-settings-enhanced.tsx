/**
 * Dash AI Settings Enhanced Screen
 * Refactored to meet WARP.md ≤500 line limit
 * Original: 1,295 lines → Refactored: ~280 lines
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

import {
  useAISettings,
  SectionHeader,
  ToggleSetting,
  PickerSetting,
  TextInputSetting,
  VoiceSection,
  sharedStyles as styles,
  PERSONALITY_OPTIONS,
  TEACHING_STYLE_OPTIONS,
  ExpandedSections,
} from '@/components/ai-settings';

export default function DashAISettingsEnhancedScreen() {
  const { theme } = useTheme();
  
  const {
    settings,
    loading,
    saving,
    streamingPref,
    handleSettingsChange,
    saveSettings,
    resetToDefaults,
    toggleStreamingPref,
    computeSignature,
    lastSavedRef,
  } = useAISettings();

  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    personality: true,
    voice: true,
    chat: false,
    learning: false,
    custom: false,
    accessibility: false
  });

  const toggleSection = (section: keyof ExpandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Enhanced Dash AI Settings" subtitle="Advanced AI assistant configuration" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading enhanced settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isDirty = computeSignature(settings) !== lastSavedRef.current;
  const successGreen = '#22c55e';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Dash AI Settings" subtitle="Configure your AI assistant" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Personality Settings */}
        <SectionHeader title="Personality & Behavior" icon="🎭" expanded={expandedSections.personality} onToggle={() => toggleSection('personality')} theme={theme} />
        {expandedSections.personality && (
          <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <PickerSetting
              title="AI Personality"
              subtitle="Choose how Dash communicates"
              value={settings.personality}
              options={PERSONALITY_OPTIONS}
              onValueChange={(v) => handleSettingsChange('personality', v)}
              theme={theme}
            />
            <TextInputSetting
              title="Custom Instructions"
              subtitle="Additional personality traits (comma-separated)"
              value={settings.customInstructions}
              onChangeText={(text) => handleSettingsChange('customInstructions', text)}
              placeholder="e.g., humorous, patient, creative"
              theme={theme}
            />
          </View>
        )}

        {/* Voice Settings */}
        <VoiceSection
          settings={settings}
          expanded={expandedSections.voice}
          onToggleSection={() => toggleSection('voice')}
          onChange={handleSettingsChange}
          streamingPref={streamingPref}
          onToggleStreaming={toggleStreamingPref}
          theme={theme}
        />

        {/* Chat Behavior */}
        <SectionHeader title="Chat & Interaction" icon="💬" expanded={expandedSections.chat} onToggle={() => toggleSection('chat')} theme={theme} />
        {expandedSections.chat && (
          <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ToggleSetting title="Enter to Send" subtitle="Send messages by pressing Enter" value={settings.enterToSend} onValueChange={(v) => handleSettingsChange('enterToSend', v)} theme={theme} />
            <ToggleSetting title="Auto Voice Reply" subtitle="Automatically respond with voice" value={settings.autoVoiceReply} onValueChange={(v) => handleSettingsChange('autoVoiceReply', v)} theme={theme} />
            <ToggleSetting title="Typing Indicator" subtitle="Show when Dash is thinking" value={settings.showTypingIndicator} onValueChange={(v) => handleSettingsChange('showTypingIndicator', v)} theme={theme} />
            <ToggleSetting title="Question Suggestions" subtitle="Suggest follow-up questions" value={settings.autoSuggestQuestions} onValueChange={(v) => handleSettingsChange('autoSuggestQuestions', v)} theme={theme} />
            <ToggleSetting title="Contextual Help" subtitle="Offer help based on current topic" value={settings.contextualHelp} onValueChange={(v) => handleSettingsChange('contextualHelp', v)} theme={theme} />
          </View>
        )}

        {/* Learning & Memory */}
        <SectionHeader title="Learning & Memory" icon="🧠" expanded={expandedSections.learning} onToggle={() => toggleSection('learning')} theme={theme} />
        {expandedSections.learning && (
          <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ToggleSetting title="Remember Preferences" subtitle="Save your settings and preferences" value={settings.rememberPreferences} onValueChange={(v) => handleSettingsChange('rememberPreferences', v)} theme={theme} />
            <ToggleSetting title="Learn from Interactions" subtitle="Improve responses based on conversations" value={settings.learnFromInteractions} onValueChange={(v) => handleSettingsChange('learnFromInteractions', v)} theme={theme} />
          </View>
        )}

        {/* Customization */}
        <SectionHeader title="Customization" icon="⚙️" expanded={expandedSections.custom} onToggle={() => toggleSection('custom')} theme={theme} />
        {expandedSections.custom && (
          <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <PickerSetting
              title="Teaching Style"
              subtitle="How Dash explains concepts"
              value={settings.teachingStyle}
              options={TEACHING_STYLE_OPTIONS}
              onValueChange={(v) => handleSettingsChange('teachingStyle', v)}
              theme={theme}
            />
            <TextInputSetting
              title="User Context"
              subtitle="Tell Dash about yourself for better assistance"
              value={settings.userContext}
              onChangeText={(text) => handleSettingsChange('userContext', text)}
              placeholder="e.g., Grade 5 teacher, Math specialist, New to teaching"
              theme={theme}
            />
          </View>
        )}

        {/* Accessibility */}
        <SectionHeader title="Accessibility" icon="♿" expanded={expandedSections.accessibility} onToggle={() => toggleSection('accessibility')} theme={theme} />
        {expandedSections.accessibility && (
          <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ToggleSetting title="High Contrast" subtitle="Increase color contrast for better visibility" value={settings.highContrast} onValueChange={(v) => handleSettingsChange('highContrast', v)} theme={theme} />
            <ToggleSetting title="Large Fonts" subtitle="Use larger text throughout the app" value={settings.largeFonts} onValueChange={(v) => handleSettingsChange('largeFonts', v)} theme={theme} />
            <ToggleSetting title="Screen Reader Support" subtitle="Optimize for screen reader users" value={settings.screenReader} onValueChange={(v) => handleSettingsChange('screenReader', v)} theme={theme} />
            <ToggleSetting title="Reduced Motion" subtitle="Minimize animations and effects" value={settings.reducedMotion} onValueChange={(v) => handleSettingsChange('reducedMotion', v)} theme={theme} />
          </View>
        )}

        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Sticky footer */}
      <View style={[styles.footer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.footerButton, {
            backgroundColor: isDirty ? successGreen : 'transparent',
            borderColor: isDirty ? successGreen : theme.error,
            opacity: saving ? 0.7 : 1,
          }]}
          onPress={isDirty ? saveSettings : resetToDefaults}
          disabled={saving}
        >
          <Text style={[styles.footerButtonText, { color: isDirty ? '#fff' : theme.error }]}>
            {isDirty ? (saving ? 'Saving…' : 'Save') : '↺ Reset'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
