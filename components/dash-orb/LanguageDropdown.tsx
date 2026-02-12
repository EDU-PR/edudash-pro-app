/**
 * LanguageDropdown — Voice ORB Language Selector
 *
 * A modal dropdown for switching Dash's language (EN/AF/ZU).
 * Replaces the old inline language buttons and chat icon.
 * Also includes a shortcut to open the full chat.
 *
 * @module components/dash-orb/LanguageDropdown
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { SupportedLanguage } from '@/components/super-admin/voice-orb/useVoiceSTT';

interface LanguageDropdownProps {
  visible: boolean;
  onClose: () => void;
  selectedLanguage: SupportedLanguage;
  onSelect: (lang: SupportedLanguage) => void;
  onOpenFullChat?: () => void | Promise<void>;
  theme: any;
}

const LANGUAGES = [
  { code: 'en-ZA' as SupportedLanguage, label: 'English', flag: '🇿🇦', desc: 'South African English' },
  { code: 'af-ZA' as SupportedLanguage, label: 'Afrikaans', flag: '🇿🇦', desc: 'Afrikaans' },
  { code: 'zu-ZA' as SupportedLanguage, label: 'isiZulu', flag: '🇿🇦', desc: 'isiZulu' },
];

export function LanguageDropdown({ visible, onClose, selectedLanguage, onSelect, onOpenFullChat, theme }: LanguageDropdownProps) {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.menu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.textSecondary }]}>Language</Text>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.item,
                selectedLanguage === lang.code && { backgroundColor: theme.primary + '15' },
              ]}
              onPress={() => { onSelect(lang.code); onClose(); }}
            >
              <Text style={styles.flag}>{lang.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.text }]}>{lang.label}</Text>
                <Text style={[styles.desc, { color: theme.textSecondary }]}>{lang.desc}</Text>
              </View>
              {selectedLanguage === lang.code && (
                <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <TouchableOpacity
            style={styles.item}
            onPress={() => {
              onClose();
              router.push('/screens/dash-ai-settings');
            }}
          >
            <Ionicons name="settings-outline" size={18} color={theme.textSecondary} />
            <Text style={[styles.label, { color: theme.text, marginLeft: 8 }]}>Dash Settings</Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <TouchableOpacity
            style={styles.item}
            onPress={async () => {
              onClose();
              if (onOpenFullChat) {
                await onOpenFullChat();
                return;
              }
              router.push({ pathname: '/screens/dash-assistant', params: { source: 'orb' } });
            }}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={theme.primary} />
            <Text style={[styles.label, { color: theme.primary, marginLeft: 8 }]}>Continue in full Dash chat</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

/** Get short label for language button display. */
export function getLanguageLabel(lang: SupportedLanguage): string {
  switch (lang) {
    case 'en-ZA': return 'EN';
    case 'af-ZA': return 'AF';
    case 'zu-ZA': return 'ZU';
    default: return 'EN';
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    paddingTop: 80,
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  menu: {
    width: 220,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  flag: { fontSize: 18 },
  label: { fontSize: 15, fontWeight: '600' },
  desc: { fontSize: 12, marginTop: 1 },
  divider: { height: 1, marginVertical: 4, marginHorizontal: 16 },
});
