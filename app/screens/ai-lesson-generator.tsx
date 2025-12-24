/**
 * AI Lesson Generator Screen
 * Creates AI-powered lesson plans using Anthropic Claude models.
 * @module app/screens/ai-lesson-generator
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { assertSupabase } from '@/lib/supabase';
import { LessonGeneratorService } from '@/lib/ai/lessonGenerator';
import { setPreferredModel } from '@/lib/ai/preferences';
import { useSimplePullToRefresh } from '@/hooks/usePullToRefresh';
import { useLessonGeneratorModels, useTierInfo } from '@/hooks/useAIModelSelection';
import { useAILessonGeneration } from '@/hooks/useAILessonGeneration';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/components/ui/ToastProvider';
import { EducationalPDFService } from '@/lib/services/EducationalPDFService';
import { QuotaBar } from '@/components/ai-lesson-generator';

type LanguageCode = 'en' | 'es' | 'fr' | 'pt' | 'de' | 'af' | 'zu' | 'st';

export default function AILessonGeneratorScreen() {
  const { theme } = useTheme();
  const palette = useMemo(() => ({
    bg: theme.background, text: theme.text, textSec: theme.textSecondary,
    outline: theme.border, surface: theme.surface, primary: theme.primary, accent: theme.accent,
  }), [theme]);

  // Form state
  const [topic, setTopic] = useState('Fractions');
  const [subject, setSubject] = useState('Mathematics');
  const [gradeLevel, setGradeLevel] = useState('3');
  const [duration, setDuration] = useState('45');
  const [objectives, setObjectives] = useState('Understand proper fractions; Compare simple fractions');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [saving, setSaving] = useState(false);

  // Search params for prefill
  const searchParams = useLocalSearchParams<{ topic?: string; subject?: string; gradeLevel?: string; duration?: string; objectives?: string; model?: string; language?: string }>();

  // Hooks
  const { generated, setGenerated, pending, progress, progressMessage, errorMsg, lastPayload, usage, quotaStatus, isQuotaExhausted, onGenerate, onCancel, refreshUsage } = useAILessonGeneration();
  const { availableModels, selectedModel, setSelectedModel, isLoading: modelsLoading } = useLessonGeneratorModels();
  const { tierInfo } = useTierInfo();

  const categoriesQuery = useQuery({
    queryKey: ['lesson_categories'],
    queryFn: async () => {
      const { data, error } = await assertSupabase().from('lesson_categories').select('id,name');
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    staleTime: 60_000,
  });

  const handleRefresh = useCallback(async () => {
    await refreshUsage();
    await categoriesQuery.refetch();
  }, [refreshUsage, categoriesQuery]);

  const { refreshing, onRefreshHandler } = useSimplePullToRefresh(handleRefresh, 'ai_lesson_generator');

  // Apply prefill from search params
  useEffect(() => {
    const t = (searchParams?.topic || '').trim();
    const s = (searchParams?.subject || '').trim();
    const g = (searchParams?.gradeLevel || '').trim();
    const d = (searchParams?.duration || '').trim();
    const o = (searchParams?.objectives || '').trim();
    const m = (searchParams?.model || '').trim();
    const lang = (searchParams?.language || '').trim().toLowerCase();

    if (t) setTopic(t);
    if (s) setSubject(s);
    if (g && /^\d+$/.test(g)) setGradeLevel(g);
    if (d && /^\d+$/.test(d)) setDuration(d);
    if (o) setObjectives(o);
    if (lang && ['en', 'es', 'fr', 'pt', 'de', 'af', 'zu', 'st'].includes(lang)) setLanguage(lang as LanguageCode);
    if (m && ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'].includes(m)) setSelectedModel(m as typeof selectedModel);
  }, [searchParams, setSelectedModel]);

  const buildDashPrompt = useCallback(() => {
    const objs = (objectives || '').split(';').map(s => s.trim()).filter(Boolean);
    const langSuffix = language && language !== 'en' ? `\nPlease respond in ${language}.` : '';
    return `Generate a ${Number(duration) || 45} minute lesson plan for Grade ${Number(gradeLevel) || 3} in ${subject} on "${topic}". Learning objectives: ${objs.join('; ') || 'derive objectives'}. Provide objectives, warm-up, activities, assessment, and closure.${langSuffix}`;
  }, [topic, subject, gradeLevel, duration, objectives, language]);

  const onOpenWithDash = useCallback(() => {
    const initialMessage = buildDashPrompt();
    try { const { safeRouter } = require('@/lib/navigation/safeRouter'); safeRouter.push({ pathname: '/screens/dash-assistant', params: { initialMessage } }); }
    catch { router.push({ pathname: '/screens/dash-assistant', params: { initialMessage } }); }
  }, [buildDashPrompt]);

  const onExportPDF = useCallback(async () => {
    const content = (generated?.description || '').trim();
    if (!content) { Alert.alert('Export PDF', 'Generate a lesson first.'); return; }
    try { await EducationalPDFService.generateTextPDF(`${subject}: ${topic}`, content); toast.success('PDF generated'); }
    catch { toast.error('Failed to generate PDF'); }
  }, [subject, topic, generated]);

  const handleGenerate = useCallback(() => {
    if (isQuotaExhausted) { router.push('/pricing'); return; }
    onGenerate({ topic, subject, gradeLevel, duration, objectives, language, selectedModel });
  }, [isQuotaExhausted, onGenerate, topic, subject, gradeLevel, duration, objectives, language, selectedModel]);

  const onSave = useCallback(async () => {
    try {
      setSaving(true);
      const { data: auth } = await assertSupabase().auth.getUser();
      const { data: profile } = await assertSupabase().from('users').select('id,preschool_id').eq('auth_user_id', auth?.user?.id || '').maybeSingle();
      if (!profile) { toast.error('Not signed in'); return; }
      const categoryId = categoriesQuery.data?.[0]?.id;
      if (!categoryId) { toast.warn('Create a category first'); return; }
      const res = await LessonGeneratorService.saveGeneratedLesson({ lesson: generated, teacherId: profile.id, preschoolId: profile.preschool_id, ageGroupId: 'n/a', categoryId, template: { duration: 30, complexity: 'moderate' }, isPublished: true });
      if (!res.success) { toast.error(`Save failed: ${res.error || 'Unknown error'}`); return; }
      toast.success(`Lesson saved (id ${res.lessonId})`);
    } catch (e: unknown) { toast.error(`Save error: ${e instanceof Error ? e.message : 'Failed'}`); }
    finally { setSaving(false); }
  }, [categoriesQuery.data, generated]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="AI Lesson Generator" subtitle="Create AI-powered lesson plans" showBackButton />

      <View style={styles.headerRow}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}><Ionicons name="sparkles" size={16} color={theme.onPrimary} /></View>
        <Text style={[styles.headerText, { color: palette.text }]}>Dash • Lesson Generator</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[styles.actionBtn, { borderColor: palette.outline, marginRight: 8 }]} onPress={onExportPDF}><Ionicons name="document-outline" size={16} color={palette.text} /><Text style={[styles.actionBtnText, { color: palette.text }]}>PDF</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { borderColor: palette.outline }]} onPress={onOpenWithDash}><Ionicons name="chatbubbles-outline" size={16} color={palette.text} /><Text style={[styles.actionBtnText, { color: palette.text }]}>Dash</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshHandler} tintColor="#3B82F6" />}>
        {/* Parameters Card */}
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline, marginTop: 16 }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Lesson Parameters</Text>
          <Text style={[styles.label, { color: palette.textSec, marginTop: 8 }]}>Topic</Text>
          <TextInput style={[styles.input, { color: palette.text, borderColor: palette.outline }]} value={topic} onChangeText={setTopic} placeholder="e.g., Fractions" />
          <Text style={[styles.label, { color: palette.textSec, marginTop: 8 }]}>Subject</Text>
          <TextInput style={[styles.input, { color: palette.text, borderColor: palette.outline }]} value={subject} onChangeText={setSubject} placeholder="e.g., Mathematics" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Text style={[styles.label, { color: palette.textSec, marginTop: 8 }]}>Grade</Text><TextInput style={[styles.input, { color: palette.text, borderColor: palette.outline }]} value={gradeLevel} onChangeText={setGradeLevel} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Text style={[styles.label, { color: palette.textSec, marginTop: 8 }]}>Duration</Text><TextInput style={[styles.input, { color: palette.text, borderColor: palette.outline }]} value={duration} onChangeText={setDuration} keyboardType="numeric" /></View>
          </View>
          <Text style={[styles.label, { color: palette.textSec, marginTop: 8 }]}>Objectives (;)</Text>
          <TextInput style={[styles.input, { color: palette.text, borderColor: palette.outline }]} value={objectives} onChangeText={setObjectives} />
          <Text style={{ color: palette.textSec, marginTop: 12 }}>This month: {usage.lesson_generation} lessons</Text>
          <QuotaBar used={usage.lesson_generation} limit={quotaStatus?.limit || 5} />
        </View>

        {/* Model Selector */}
        {!modelsLoading && availableModels.length > 0 && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>AI Model</Text>
              {tierInfo && <View style={{ marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: tierInfo.color + '20' }}><Text style={{ color: tierInfo.color, fontSize: 10, fontWeight: '600' }}>{tierInfo.badge}</Text></View>}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {availableModels.map(m => <TouchableOpacity key={m.id} onPress={() => { setSelectedModel(m.id); setPreferredModel(m.id, 'lesson_generation').catch(() => {}); }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: selectedModel === m.id ? theme.primary : palette.outline, backgroundColor: selectedModel === m.id ? theme.primary + '10' : 'transparent' }}><Text style={{ color: selectedModel === m.id ? theme.primary : palette.text, fontSize: 13, fontWeight: selectedModel === m.id ? '600' : '400' }}>{m.displayName || m.name}</Text></TouchableOpacity>)}
            </View>
          </View>
        )}

        {/* Buttons */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={handleGenerate} style={[styles.btn, { backgroundColor: isQuotaExhausted ? '#9CA3AF' : theme.primary, flex: 1 }]} disabled={pending}>
            {pending ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={[styles.btnText, { color: theme.onPrimary }]}>{isQuotaExhausted ? 'Upgrade' : 'Generate'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onSave} style={[styles.btn, { backgroundColor: generated?.description ? theme.accent : palette.outline, flex: 1 }]} disabled={saving || !generated?.description}>
            {saving ? <ActivityIndicator color={theme.onAccent} /> : <Text style={[styles.btnText, { color: generated?.description ? theme.onAccent : palette.textSec }]}>Save</Text>}
          </TouchableOpacity>
        </View>

        {/* Progress */}
        {pending && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: theme.primary, marginTop: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.primary, marginLeft: 8, fontWeight: '600' }}>Generating...</Text></View>
              <TouchableOpacity style={{ backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }} onPress={onCancel}><Text style={{ color: '#FFF', fontSize: 12 }}>Cancel</Text></TouchableOpacity>
            </View>
            <Text style={{ color: palette.textSec, fontSize: 13 }}>{progressMessage}</Text>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E5E7EB', marginTop: 8 }}><View style={{ width: `${progress}%`, height: 6, borderRadius: 3, backgroundColor: theme.primary }} /></View>
            <Text style={{ color: palette.textSec, fontSize: 11, textAlign: 'center', marginTop: 4 }}>{Math.round(progress)}%</Text>
          </View>
        )}

        {/* Error */}
        {errorMsg && !pending && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: '#EF4444', borderWidth: 1, marginTop: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="warning-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={{ color: '#EF4444', fontWeight: '600', flex: 1 }}>Failed</Text>
              {lastPayload && <TouchableOpacity onPress={() => onGenerate({ topic, subject, gradeLevel, duration, objectives, language, selectedModel }, lastPayload)} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#EF4444' }}><Text style={{ color: '#EF4444', fontSize: 12 }}>Retry</Text></TouchableOpacity>}
            </View>
            <Text style={{ color: palette.textSec, fontSize: 13 }}>{errorMsg}</Text>
          </View>
        )}

        {/* Generated Content */}
        {generated?.description && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: theme.success, borderWidth: 2, marginTop: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><Ionicons name="checkmark-circle" size={18} color={theme.success} /><Text style={{ color: theme.success, fontWeight: '600', marginLeft: 8 }}>Generated!</Text></View>
            <ScrollView style={{ maxHeight: 280, backgroundColor: palette.bg, borderRadius: 8, padding: 10 }}><Text style={{ color: palette.text, fontSize: 14, lineHeight: 20 }}>{generated.description}</Text></ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity onPress={onSave} style={[styles.btn, { backgroundColor: theme.primary, flex: 1 }]} disabled={saving}>{saving ? <ActivityIndicator color={theme.onPrimary} size="small" /> : <Text style={[styles.btnText, { color: theme.onPrimary }]}>Save</Text>}</TouchableOpacity>
              <TouchableOpacity onPress={() => { setGenerated(null); toast.info('Cleared'); }} style={[styles.btn, { backgroundColor: palette.outline, paddingHorizontal: 12 }]}><Ionicons name="refresh-outline" size={16} color={palette.text} /></TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, marginTop: 16 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  headerText: { fontSize: 14, fontWeight: '700' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  actionBtnText: { fontSize: 12, marginLeft: 6, fontWeight: '600' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'transparent' },
  btn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnText: { fontWeight: '700' },
});
