/**
 * Voice settings section component
 */
import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { voiceService } from '@/lib/voice/client';
import { normalizeLanguageCode, resolveDefaultVoiceId } from '@/lib/ai/dashSettings';
import { SectionHeader } from './SectionHeader';
import { ToggleSetting, SliderSetting, PickerSetting } from './SettingRows';
import { AISettings, LANGUAGE_OPTIONS } from './types';

interface VoiceSectionProps {
  settings: AISettings;
  expanded: boolean;
  onToggleSection: () => void;
  onChange: (key: string, value: any) => void;
  streamingPref: boolean;
  onToggleStreaming: (v: boolean) => void;
  theme: any;
}

export function VoiceSection({
  settings,
  expanded,
  onToggleSection,
  onChange,
  streamingPref,
  onToggleStreaming,
  theme
}: VoiceSectionProps) {
  const [samplePlaying, setSamplePlaying] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleProgress, setSampleProgress] = useState(0);
  const sampleSoundRef = useRef<Audio.Sound | null>(null);

  const handlePlaySample = async () => {
    try {
      if (samplePlaying) {
        await sampleSoundRef.current?.stopAsync();
        await sampleSoundRef.current?.unloadAsync();
        sampleSoundRef.current = null;
        setSamplePlaying(false);
        setSampleProgress(0);
        return;
      }
      setSampleLoading(true);
      const langNorm = normalizeLanguageCode(settings.voiceLanguage);
      const isProviderVoice = /Neural$/i.test(settings.voiceType || '');
      const gender = settings.voiceType === 'male' ? 'male' : 'female';
      const voice_id = isProviderVoice ? settings.voiceType : resolveDefaultVoiceId(langNorm, gender as any);
      const audioUrl = await voiceService.testVoice(langNorm as any, voice_id);
      const sound = new Audio.Sound();
      await sound.loadAsync({ uri: audioUrl }, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (!status?.isLoaded) return;
        if (status.didJustFinish) {
          setSamplePlaying(false);
          setSampleLoading(false);
          setSampleProgress(1);
          sound.unloadAsync().catch(() => {});
          sampleSoundRef.current = null;
        } else if (status.isPlaying && status.durationMillis) {
          setSamplePlaying(true);
          setSampleProgress(status.positionMillis / status.durationMillis);
        }
      });
      sampleSoundRef.current = sound;
      setSampleLoading(false);
    } catch (err) {
      setSampleLoading(false);
      setSamplePlaying(false);
      setSampleProgress(0);
      Alert.alert('Sample Error', 'Could not play sample.');
    }
  };

  const renderVoiceOptions = () => {
    const lang = settings.voiceLanguage;
    const voiceOptions: Record<string, Array<{ name: string; value: string; gender: string }>> = {
      en: [
        { name: 'Leah', value: 'en-ZA-LeahNeural', gender: '👩' },
        { name: 'Luke', value: 'en-ZA-LukeNeural', gender: '👨' },
      ],
      af: [
        { name: 'Adri', value: 'af-ZA-AdriNeural', gender: '👩' },
        { name: 'Willem', value: 'af-ZA-WillemNeural', gender: '👨' },
      ],
      zu: [
        { name: 'Themba', value: 'zu-ZA-ThembaNeural', gender: '👨' },
        { name: 'Thando', value: 'zu-ZA-ThandoNeural', gender: '👩' },
      ],
    };

    if (voiceOptions[lang]) {
      return (
        <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>Azure Neural Voice</Text>
            <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
              Premium voices for {lang === 'en' ? 'English (SA)' : lang === 'af' ? 'Afrikaans' : 'isiZulu'}
            </Text>
          </View>
          <View style={{ flexDirection: 'column', gap: 8 }}>
            {voiceOptions[lang].map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.pickerOption, {
                  backgroundColor: settings.voiceType === opt.value ? theme.primary : 'transparent',
                  borderColor: theme.border
                }]}
                onPress={() => onChange('voiceType', opt.value)}
              >
                <Text style={[styles.pickerOptionText, { color: settings.voiceType === opt.value ? 'white' : theme.text }]}>
                  {opt.gender} {opt.name} ({opt.gender === '👨' ? 'Male' : 'Female'})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (lang === 'xh' || lang === 'nso') {
      return (
        <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.settingSubtitle, { color: theme.textSecondary, padding: 8 }]}>
            Azure Speech supports {lang === 'xh' ? 'isiXhosa' : 'Northern Sotho'} with default voice.
          </Text>
        </View>
      );
    }

    // Generic gender picker
    return (
      <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, { color: theme.text }]}>Voice Gender</Text>
          <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
            {Platform.OS === 'android' ? 'Voice via pitch modulation' : 'Uses device voice packs'}
          </Text>
        </View>
        <View style={styles.pickerContainer}>
          {['male', 'female'].map(g => (
            <TouchableOpacity
              key={g}
              style={[styles.pickerOption, {
                backgroundColor: settings.voiceType === g ? theme.primary : 'transparent',
                borderColor: theme.border
              }]}
              onPress={() => onChange('voiceType', g)}
            >
              <Text style={[styles.pickerOptionText, { color: settings.voiceType === g ? 'white' : theme.text }]}>
                {g === 'male' ? '👨 Male' : '👩 Female'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <>
      <SectionHeader title="Voice & Speech" icon="🎙️" expanded={expanded} onToggle={onToggleSection} theme={theme} />
      {expanded && (
        <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ToggleSetting
            title="Realtime Streaming (Beta)"
            subtitle="Stream voice input and receive live tokens"
            value={streamingPref}
            onValueChange={onToggleStreaming}
            theme={theme}
          />
          <ToggleSetting
            title="Voice Responses"
            subtitle="Enable text-to-speech for Dash responses"
            value={settings.voiceEnabled}
            onValueChange={(v) => onChange('voiceEnabled', v)}
            theme={theme}
          />
          <PickerSetting
            title="Voice Language"
            subtitle="Primary language for voice output"
            value={settings.voiceLanguage}
            options={LANGUAGE_OPTIONS}
            onValueChange={(v) => onChange('voiceLanguage', v)}
            theme={theme}
          />
          {renderVoiceOptions()}
          <SliderSetting title="Speech Rate" subtitle="How fast Dash speaks" value={settings.voiceRate} onValueChange={(v) => onChange('voiceRate', v)} min={0.5} max={2.0} step={0.1} theme={theme} />
          <SliderSetting title="Voice Pitch" subtitle="Voice pitch level" value={settings.voicePitch} onValueChange={(v) => onChange('voicePitch', v)} min={0.5} max={2.0} step={0.1} theme={theme} />
          <SliderSetting title="Voice Volume" subtitle="Audio output volume" value={settings.voiceVolume} onValueChange={(v) => onChange('voiceVolume', v)} min={0.1} max={1.0} step={0.1} theme={theme} />
          
          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <TouchableOpacity style={[styles.actionButton, { borderColor: theme.border }]} onPress={handlePlaySample}>
              <Text style={[styles.actionButtonText, { color: theme.text }]}>
                {samplePlaying ? '⏹ Stop Sample' : sampleLoading ? '⏳ Loading...' : '▶ Play Sample'}
              </Text>
            </TouchableOpacity>
            {(samplePlaying || sampleLoading) && (
              <View style={{ marginTop: 8 }}>
                <View style={{ height: 6, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.round(sampleProgress * 100)}%`, height: '100%', backgroundColor: theme.primary }} />
                </View>
                <Text style={{ marginTop: 6, fontSize: 12, color: theme.textSecondary }}>Playing… {Math.round(sampleProgress * 100)}%</Text>
              </View>
            )}
          </View>
          
          <ToggleSetting title="Auto-Read Responses" subtitle="Automatically speak Dash responses" value={settings.autoReadResponses} onValueChange={(v) => onChange('autoReadResponses', v)} theme={theme} />
          <ToggleSetting title="Voice Activation" subtitle="Wake Dash with voice commands" value={settings.voiceActivation} onValueChange={(v) => onChange('voiceActivation', v)} theme={theme} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionContent: { borderRadius: 12, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  settingRow: { padding: 16, borderBottomWidth: 1 },
  settingInfo: { flex: 1, marginBottom: 8 },
  settingTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  settingSubtitle: { fontSize: 14, lineHeight: 20 },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pickerOption: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  pickerOptionText: { fontSize: 14, fontWeight: '500' },
  actionButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, backgroundColor: 'transparent' },
  actionButtonText: { fontSize: 14, fontWeight: '600' },
});
