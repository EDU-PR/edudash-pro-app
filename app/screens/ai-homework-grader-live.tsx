import React, { useRef, useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getFeatureFlagsSync } from '@/lib/featureFlags'
import { track } from '@/lib/analytics'
import { getCombinedUsage } from '@/lib/ai/usage'
import { useGrader } from '@/hooks/useGrader'
import { canUseFeature, getQuotaStatus } from '@/lib/ai/limits'
import { setPreferredModel } from '@/lib/ai/preferences'
import { assertSupabase } from '@/lib/supabase'
import { router, useLocalSearchParams } from 'expo-router'
import { useGradingModels } from '@/hooks/useAIModelSelection'
import { toast } from '@/components/ui/ToastProvider'
import { useTheme } from '@/contexts/ThemeContext'
import { ModelInUseIndicator } from '@/components/ai/ModelInUseIndicator'
import { ModelSelectorChips } from '@/components/ai/ModelSelectorChips'
import { FeatureQuotaBar } from '@/components/ai/FeatureQuotaBar'
import EduDashSpinner from '@/components/ui/EduDashSpinner'

/** Parsed grading result from AI */
interface ParsedResult {
  score: number; feedback: string; suggestions: string[]
  strengths: string[]; areasForImprovement: string[]
}

const SCORE_COLOR = (s: number) => s >= 90 ? '#34D399' : s >= 80 ? '#60A5FA' : s >= 70 ? '#FCD34D' : '#F87171'

export default function AIHomeworkGraderLive() {
  const { theme, isDark } = useTheme()
  const params = useLocalSearchParams<{
    assignmentTitle?: string | string[]; gradeLevel?: string | string[]
    submissionContent?: string | string[]; studentId?: string | string[]
    progressUploadId?: string | string[]; contextTag?: string | string[]
    sourceFlow?: string | string[]; activityId?: string | string[]
    activityTitle?: string | string[]
  }>()
  const readParam = (v: string | string[] | undefined) => {
    const raw = Array.isArray(v) ? v[0] : v
    if (!raw) return ''
    try { return decodeURIComponent(raw) } catch { return raw }
  }
  const [assignmentTitle, setAssignmentTitle] = useState(readParam(params.assignmentTitle))
  const [gradeLevel, setGradeLevel] = useState(readParam(params.gradeLevel))
  const [submissionContent, setSubmissionContent] = useState(readParam(params.submissionContent) || '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [pending, setPending] = useState(false)
  const [jsonBuffer, setJsonBuffer] = useState('')
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [usage, setUsage] = useState({ lesson_generation: 0, grading_assistance: 0, homework_help: 0 })
  const [quotaStatus, setQuotaStatus] = useState<{ used: number; limit: number; remaining: number } | null>(null)
  const [quotaRefreshKey, setQuotaRefreshKey] = useState(0)
  const [recordStatus, setRecordStatus] = useState<{ state: 'idle' | 'saving' | 'saved' | 'error'; id?: string; message?: string }>({ state: 'idle' })
  const bufferRef = useRef('')
  const pulseAnim = useRef(new Animated.Value(1)).current
  const progressUploadId = readParam(params.progressUploadId)
  const contextTag = readParam(params.contextTag)
  const sourceFlow = readParam(params.sourceFlow)
  const activityId = readParam(params.activityId)
  const activityTitle = readParam(params.activityTitle)

  const flags = getFeatureFlagsSync()
  const AI_ENABLED = (process.env.EXPO_PUBLIC_AI_ENABLED === 'true') || (process.env.EXPO_PUBLIC_ENABLE_AI_FEATURES === 'true')
  const aiGradingEnabled = AI_ENABLED && flags.ai_grading_assistance !== false

  const { grade, result } = useGrader()
  const { availableModels, selectedModel, setSelectedModel, quotas, tier } = useGradingModels()
  const hasHydratedParams = useRef(false)

  // Pulse animation for streaming state
  React.useEffect(() => {
    if (isStreaming) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start()
    } else {
      pulseAnim.setValue(1)
    }
  }, [isStreaming, pulseAnim])

  React.useEffect(() => {
    if (hasHydratedParams.current) return
    const t = readParam(params.assignmentTitle); const g = readParam(params.gradeLevel); const s = readParam(params.submissionContent)
    if (t) setAssignmentTitle(t); if (g) setGradeLevel(g); if (s) setSubmissionContent(s)
    hasHydratedParams.current = true
  }, [params.assignmentTitle, params.gradeLevel, params.submissionContent])

  React.useEffect(() => { getCombinedUsage().then(setUsage).catch(() => {}) }, [])

  const refreshQuotaStatus = React.useCallback(async () => {
    try {
      const status = await getQuotaStatus('grading_assistance')
      const effectiveLimit = quotas.ai_requests && quotas.ai_requests > 0 ? quotas.ai_requests : status.limit
      const remaining = effectiveLimit < 0 ? Number.POSITIVE_INFINITY : Math.max(0, effectiveLimit - status.used)
      setQuotaStatus({
        used: status.used,
        limit: effectiveLimit,
        remaining,
      })
    } catch {
      // non-fatal
    }
  }, [quotas.ai_requests])

  React.useEffect(() => {
    void refreshQuotaStatus()
  }, [refreshQuotaStatus])

  const parseResult = React.useCallback((text: string, summary?: Partial<ParsedResult> | null): ParsedResult => {
    const make = (o: any): ParsedResult => ({
      score: Number(o?.score || 0), feedback: String(o?.feedback || ''),
      suggestions: Array.isArray(o?.suggestions) ? o.suggestions : [],
      strengths: Array.isArray(o?.strengths) ? o.strengths : [],
      areasForImprovement: Array.isArray(o?.areasForImprovement) ? o.areasForImprovement : [],
    })
    if (summary?.feedback) return make(summary)
    try { const p = JSON.parse(text || '{}'); if (p?.score || p?.feedback) return make(p) } catch { /* fallback */ }
    return { score: 0, feedback: text || '', suggestions: [], strengths: [], areasForImprovement: [] }
  }, [])

  const persistGradingRecord = React.useCallback(async (gradeResult: ParsedResult, rawResponse: string) => {
    const supabase = assertSupabase() as any
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData?.user?.id
    if (!userId) throw new Error('You must be signed in to save grading records.')
    const { data, error } = await supabase.from('dash_ai_tutor_attempts').insert({
      user_id: userId, student_id: readParam(params.studentId) || null,
      mode: 'practice', subject: 'homework_grading', grade: gradeLevel || null,
      topic: assignmentTitle || null, question: assignmentTitle || null,
      learner_answer: submissionContent || null,
      score: Number.isFinite(gradeResult.score) ? gradeResult.score : null,
      feedback: gradeResult.feedback || null, is_correct: null,
      metadata: { source: 'ai_homework_grader_live', context_tag: contextTag || null,
        source_flow: sourceFlow || null, progress_upload_id: progressUploadId || null,
        activity_id: activityId || null, activity_title: activityTitle || null,
        model: selectedModel || null, assignment_title: assignmentTitle || null,
        grade_level: gradeLevel || null, suggestions: gradeResult.suggestions || [],
        strengths: gradeResult.strengths || [],
        areas_for_improvement: gradeResult.areasForImprovement || [],
        raw_response_preview: (rawResponse || '').slice(0, 2000),
      },
    }).select('id, created_at').single()
    if (error) throw new Error(error.message || 'Failed to save grading record')
    return data as { id: string; created_at: string }
  }, [activityId, activityTitle, assignmentTitle, contextTag, gradeLevel, params.studentId, progressUploadId, selectedModel, sourceFlow, submissionContent])

  const startStreaming = async () => {
    setPending(true); setRecordStatus({ state: 'idle' })
    if (!submissionContent.trim()) { toast.warn('Please provide the student submission text.'); setPending(false); return }
    if (!aiGradingEnabled) { toast.warn('Homework grader is not enabled in this build.'); setPending(false); return }
    const gate = await canUseFeature('grading_assistance', 1)
    if (!gate.allowed) {
      const status = await getQuotaStatus('grading_assistance')
      setQuotaStatus(status)
      toast.warn(`Monthly limit reached: ${status.used}/${status.limit} used.`)
      setPending(false); return
    }
    try {
      setIsStreaming(true); setJsonBuffer(''); bufferRef.current = ''; setParsed(null)
      let finalSummary: Partial<ParsedResult> | null = null
      track('edudash.ai.grader.ui_started', {})
      const text = await grade(
        {
          submissionText: submissionContent,
          assignmentTitle: assignmentTitle || undefined,
          rubric: ['accuracy', 'completeness', 'effort', 'understanding'],
          gradeLevel: gradeLevel || undefined,
          language: 'en',
        },
        { model: selectedModel, streaming: true,
          onDelta: (chunk) => { bufferRef.current += chunk; setJsonBuffer(bufferRef.current) },
          onFinal: (summary) => { if (summary?.feedback) { finalSummary = summary; setParsed(parseResult('', summary)) } },
        }
      )
      const finalParsed = parseResult(text, finalSummary); setParsed(finalParsed)
      setRecordStatus({ state: 'saving' })
      try {
        const saved = await persistGradingRecord(finalParsed, text)
      setRecordStatus({ state: 'saved', id: saved.id })
    } catch (persistErr: unknown) {
        const msg = persistErr instanceof Error ? persistErr.message : 'Failed to save'
        setRecordStatus({ state: 'error', message: msg })
        toast.warn(`Grading done, but save failed: ${msg}`)
      }
      setIsStreaming(false); setPending(false)
      setUsage(await getCombinedUsage())
      await refreshQuotaStatus()
      setQuotaRefreshKey((prev) => prev + 1)
      track('edudash.ai.grader.ui_completed', { score: finalParsed.score })
    } catch (e: unknown) {
      setIsStreaming(false); setPending(false)
      const errorMessage = e instanceof Error ? e.message : 'Failed to start grading'
      track('edudash.ai.grader.ui_failed', { error: errorMessage })
      toast.error(`Error: ${errorMessage}`)
    }
  }

  const tierLabel = useMemo(() => {
    const map: Record<string, string> = { free: 'Free', starter: 'Starter', premium: 'Pro', enterprise: 'Enterprise' }
    return map[tier] || 'Free'
  }, [tier])

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <LinearGradient colors={isDark ? ['#4338CA', '#6D28D9'] : ['#6366F1', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']} style={s.headerSafe}>
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={s.headerCenter}>
              <View style={s.headerBadge}>
                <Ionicons name="sparkles" size={14} color="#C4B5FD" />
                <Text style={s.headerBadgeText}>AI ENGINE</Text>
              </View>
              <Text style={s.headerTitle}>Homework Grader</Text>
            </View>
            <View style={s.tierPill}>
              <Text style={s.tierText}>{tierLabel}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ marginBottom: 12 }}>
          <ModelInUseIndicator modelId={selectedModel} label="Using" showCostDots compact />
        </View>
        {/* ── INPUT CARD ───────────────────────────────────────────────────── */}
        <View style={[s.glass, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <InputField label="Assignment Title" value={assignmentTitle} onChangeText={setAssignmentTitle} placeholder="e.g., Counting to 10" theme={theme} />
          <InputField label="Grade Level / Age" value={gradeLevel} onChangeText={setGradeLevel} placeholder="e.g., Age 5 or Grade R" theme={theme} />
          <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>Student Submission</Text>
          <TextInput value={submissionContent} onChangeText={setSubmissionContent} placeholder="Paste or type the student's answer…"
            placeholderTextColor={theme.inputPlaceholder} multiline
            style={[s.textArea, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]} />
        </View>

        {/* ── MODEL SELECTOR ───────────────────────────────────────────────── */}
        <ModelSelectorChips
          availableModels={availableModels}
          selectedModel={selectedModel}
          onSelect={setSelectedModel}
          feature="grading_assistance"
          onPersist={async (modelId, feat) => { await setPreferredModel(modelId, feat as 'grading_assistance') }}
          title="AI Model"
        />

        {/* ── GRADE BUTTON ─────────────────────────────────────────────────── */}
        <TouchableOpacity onPress={startStreaming} disabled={pending || isStreaming || !aiGradingEnabled} activeOpacity={0.85}>
          <LinearGradient colors={['#6366F1', '#8B5CF6', '#A78BFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[s.gradeBtn, { opacity: (pending || isStreaming || !aiGradingEnabled) ? 0.5 : 1 }]}>
            {(isStreaming || pending) ? (
              <View style={s.row}><EduDashSpinner color="#FFF" /><Text style={s.gradeBtnText}>  Analyzing…</Text></View>
            ) : (
              <View style={s.row}><Ionicons name="flash" size={20} color="#FFF" /><Text style={s.gradeBtnText}>  Grade Submission</Text></View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* ── LIVE STREAM ──────────────────────────────────────────────────── */}
        <View style={[s.glass, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <View style={s.sectionHeader}>
            <Animated.View style={{ opacity: isStreaming ? pulseAnim : 1 }}>
              <Ionicons name="radio-outline" size={16} color={isStreaming ? '#34D399' : theme.textTertiary} />
            </Animated.View>
            <Text style={[s.sectionTitle, { color: theme.text }]}>Live Stream</Text>
            {isStreaming && <View style={s.liveChip}><Text style={s.liveText}>LIVE</Text></View>}
          </View>
          <FeatureQuotaBar
            feature="grading_assistance"
            used={quotaStatus?.used ?? usage.grading_assistance}
            limit={quotaStatus?.limit ?? (quotas.ai_requests || 0)}
            remaining={quotaStatus?.remaining ?? 0}
            periodLabel="month"
            refreshKey={quotaRefreshKey}
            onRefresh={refreshQuotaStatus}
          />
          {result?.__fallbackUsed && (
            <View style={[s.fallbackChip, { backgroundColor: theme.accent + '18', borderColor: theme.accent + '40' }]}>
              <Ionicons name="information-circle" size={14} color={theme.accent} />
              <Text style={[s.fallbackText, { color: theme.textSecondary }]}>Fallback model used</Text>
            </View>
          )}
          <View style={[s.terminal, { backgroundColor: isDark ? '#0C1222' : '#F1F5F9', borderColor: theme.border }]}>
            <Text style={[s.terminalText, { color: isDark ? '#A5F3FC' : '#334155' }]} selectable>
              {jsonBuffer || (isStreaming ? '▋ Waiting for tokens…' : 'Ready. Press "Grade Submission" to begin.')}
            </Text>
          </View>
        </View>

        {/* ── RESULTS ──────────────────────────────────────────────────────── */}
        {parsed && (
          <View style={[s.glass, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={s.sectionHeader}>
              <Ionicons name="analytics-outline" size={16} color={theme.accent} />
              <Text style={[s.sectionTitle, { color: theme.text }]}>Results</Text>
            </View>

            {/* Score ring */}
            <View style={s.scoreRow}>
              <View style={[s.scoreRing, { borderColor: SCORE_COLOR(parsed.score) }]}>
                <Text style={[s.scoreValue, { color: SCORE_COLOR(parsed.score) }]}>{parsed.score}</Text>
                <Text style={[s.scoreUnit, { color: theme.textTertiary }]}>/ 100</Text>
              </View>
              <View style={s.scoreMeta}>
                <ScoreBadge score={parsed.score} isDark={isDark} />
                {recordStatus.state === 'saving' && <Text style={[s.recordText, { color: theme.textTertiary }]}>Saving record…</Text>}
                {recordStatus.state === 'saved' && (
                  <View style={s.row}><Ionicons name="checkmark-circle" size={14} color="#34D399" /><Text style={[s.recordText, { color: '#34D399' }]}> Record saved</Text></View>
                )}
                {recordStatus.state === 'error' && (
                  <View style={s.row}><Ionicons name="alert-circle" size={14} color="#F87171" /><Text style={[s.recordText, { color: '#F87171' }]}> {recordStatus.message}</Text></View>
                )}
              </View>
            </View>

            {/* Feedback */}
            <Text style={[s.feedbackLabel, { color: theme.textSecondary }]}>Feedback</Text>
            <Text style={[s.feedbackText, { color: theme.text }]}>{parsed.feedback}</Text>

            {/* Strengths */}
            {parsed.strengths.length > 0 && (
              <DetailList icon="checkmark-circle" color="#34D399" title="Strengths" items={parsed.strengths} theme={theme} />
            )}
            {/* Improvements */}
            {parsed.areasForImprovement.length > 0 && (
              <DetailList icon="arrow-up-circle" color="#60A5FA" title="Areas to Improve" items={parsed.areasForImprovement} theme={theme} />
            )}
            {/* Suggestions */}
            {parsed.suggestions.length > 0 && (
              <DetailList icon="bulb" color="#FCD34D" title="Suggestions" items={parsed.suggestions} theme={theme} />
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

// ── Sub-components (inlined, no separate file needed) ─────────────────────────

function InputField({ label, value, onChangeText, placeholder, theme }: { label: string; value: string; onChangeText: (t: string) => void; placeholder: string; theme: any }) {
  return (<>
    <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor={theme.inputPlaceholder}
      style={[s.input, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]} />
  </>)
}

function ScoreBadge({ score, isDark }: { score: number; isDark: boolean }) {
  const label = score >= 90 ? 'Excellent' : score >= 80 ? 'Good' : score >= 70 ? 'Fair' : 'Needs Work'
  return (
    <View style={[s.badge, { backgroundColor: SCORE_COLOR(score) + (isDark ? '25' : '15') }]}>
      <Text style={[s.badgeText, { color: SCORE_COLOR(score) }]}>{label}</Text>
    </View>
  )
}

function DetailList({ icon, color, title, items, theme }: { icon: string; color: string; title: string; items: string[]; theme: any }) {
  return (
    <View style={{ marginTop: 14 }}>
      <View style={s.row}><Ionicons name={icon as any} size={15} color={color} /><Text style={[s.detailTitle, { color: theme.text }]}> {title}</Text></View>
      {items.map((item, i) => <Text key={i} style={[s.detailItem, { color: theme.textSecondary }]}>  •  {item}</Text>)}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  headerSafe: { paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, marginLeft: 12 },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  headerBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  tierPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  tierText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 20 },
  glass: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14, fontSize: 15 },
  textArea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 100, fontSize: 15, textAlignVertical: 'top' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipMeta: { fontSize: 10 },
  gradeBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  gradeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center' },
  liveChip: { marginLeft: 'auto', backgroundColor: '#059669', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  liveText: { fontSize: 9, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  terminal: { borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 80, marginTop: 4 },
  terminalText: { fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
  fallbackChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, gap: 6 },
  fallbackText: { fontSize: 11 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 16 },
  scoreRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreValue: { fontSize: 30, fontWeight: '900' },
  scoreUnit: { fontSize: 11, marginTop: -2 },
  scoreMeta: { flex: 1, gap: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  recordText: { fontSize: 12 },
  feedbackLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 4 },
  feedbackText: { fontSize: 14, lineHeight: 21 },
  detailTitle: { fontSize: 13, fontWeight: '700' },
  detailItem: { fontSize: 13, lineHeight: 20, marginLeft: 4 },
  quotaTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  quotaFill: { height: 6, borderRadius: 3 },
})
