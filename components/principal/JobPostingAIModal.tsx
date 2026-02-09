/** AI suggestions modal — extracted from job-posting-create.tsx */
import React from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import type { JobPostingAISuggestions } from '@/lib/services/JobPostingAIService';
import type { AlertButton } from '@/components/ui/AlertModal';

interface Props {
  visible: boolean;
  onClose: () => void;
  aiSuggestions: JobPostingAISuggestions | null;
  aiUseSuggestedTitle: boolean;
  setAiUseSuggestedTitle: (v: boolean) => void;
  applyAISuggestions: (mode: 'replace' | 'fill_empty') => void;
  showAlert: (cfg: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    buttons?: AlertButton[];
  }) => void;
  theme: any;
  styles: any;
}

export default function JobPostingAIModal({
  visible, onClose, aiSuggestions, aiUseSuggestedTitle,
  setAiUseSuggestedTitle, applyAISuggestions, showAlert, theme, styles,
}: Props) {
  if (!visible) return null;

  return (
    <SafeAreaView style={styles.aiModalContainer} edges={['top', 'bottom']}>
      <View style={styles.aiModalHeader}>
        <TouchableOpacity style={styles.aiModalClose} onPress={onClose}>
          <Ionicons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.aiModalHeaderCenter}>
          <Ionicons name="sparkles" size={20} color={theme.primary} />
          <Text style={styles.aiModalTitle}>AI Suggestions</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.aiModalScroll} contentContainerStyle={styles.aiModalContent} showsVerticalScrollIndicator={false}>
        {aiSuggestions?.suggested_title ? (
          <View style={styles.aiSuggestionCard}>
            <View style={styles.aiSuggestionTopRow}>
              <Text style={styles.aiSuggestionLabel}>Suggested title</Text>
              <View style={styles.aiSwitchRow}>
                <Text style={styles.aiSwitchText}>Use</Text>
                <Switch
                  value={aiUseSuggestedTitle}
                  onValueChange={setAiUseSuggestedTitle}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={aiUseSuggestedTitle ? '#fff' : theme.textSecondary}
                />
              </View>
            </View>
            <Text style={styles.aiSuggestionText}>{aiSuggestions.suggested_title}</Text>
          </View>
        ) : null}

        {aiSuggestions?.highlights?.length ? (
          <View style={styles.aiSuggestionCard}>
            <Text style={styles.aiSuggestionLabel}>Highlights</Text>
            {aiSuggestions.highlights.map((h, idx) => (
              <Text key={idx} style={styles.aiBulletText}>• {h}</Text>
            ))}
          </View>
        ) : null}

        <View style={styles.aiSuggestionCard}>
          <Text style={styles.aiSuggestionLabel}>Description</Text>
          <Text style={styles.aiSuggestionText}>{aiSuggestions?.description || ''}</Text>
        </View>

        <View style={styles.aiSuggestionCard}>
          <Text style={styles.aiSuggestionLabel}>Requirements</Text>
          <Text style={styles.aiSuggestionText}>{aiSuggestions?.requirements || ''}</Text>
        </View>

        {(aiSuggestions?.whatsapp_short || aiSuggestions?.whatsapp_long) ? (
          <View style={styles.aiSuggestionCard}>
            <Text style={styles.aiSuggestionLabel}>WhatsApp (no link)</Text>
            {aiSuggestions?.whatsapp_short ? (
              <>
                <Text style={styles.aiSuggestionSubLabel}>Short</Text>
                <Text style={styles.aiSuggestionText}>{aiSuggestions.whatsapp_short}</Text>
                <TouchableOpacity
                  style={styles.aiCopyBtn}
                  onPress={async () => {
                    await Clipboard.setStringAsync(aiSuggestions.whatsapp_short || '');
                    showAlert({ title: 'Copied', message: 'AI short message copied.', type: 'success' });
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color={theme.primary} />
                  <Text style={styles.aiCopyBtnText}>Copy short</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {aiSuggestions?.whatsapp_long ? (
              <>
                <Text style={[styles.aiSuggestionSubLabel, { marginTop: 10 }]}>Long</Text>
                <Text style={styles.aiSuggestionText}>{aiSuggestions.whatsapp_long}</Text>
                <TouchableOpacity
                  style={styles.aiCopyBtn}
                  onPress={async () => {
                    await Clipboard.setStringAsync(aiSuggestions.whatsapp_long || '');
                    showAlert({ title: 'Copied', message: 'AI long message copied.', type: 'success' });
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color={theme.primary} />
                  <Text style={styles.aiCopyBtnText}>Copy long</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.aiModalFooter}>
        <TouchableOpacity style={styles.aiFooterBtnSecondary} onPress={() => applyAISuggestions('fill_empty')}>
          <Text style={styles.aiFooterBtnSecondaryText}>Fill empty</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.aiFooterBtnPrimary} onPress={() => applyAISuggestions('replace')}>
          <Text style={styles.aiFooterBtnPrimaryText}>Replace</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
