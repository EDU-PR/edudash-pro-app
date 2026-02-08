import React, { useRef, useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons'
import { IconSymbol } from '@/components/ui/IconSymbol'
import { getFeatureFlagsSync } from '@/lib/featureFlags'
import { track } from '@/lib/analytics'
import { getCombinedUsage } from '@/lib/ai/usage'
import { useGrader } from '@/hooks/useGrader'
import { canUseFeature, getQuotaStatus, getEffectiveLimits } from '@/lib/ai/limits'
import { getPreferredModel, setPreferredModel } from '@/lib/ai/preferences'
import { assertSupabase } from '@/lib/supabase'
import { router, useLocalSearchParams } from 'expo-router'
import { useGradingModels } from '@/hooks/useAIModelSelection'
import { toast } from '@/components/ui/ToastProvider'
import { useTheme } from '@/contexts/ThemeContext'
import EduDashSpinner from '@/components/ui/EduDashSpinner'

/** AI model option with optional notes for display */
interface ModelOption {
  id: string
  name: string
  provider: 'claude' | 'openai' | 'custom'
  relativeCost: number
  notes?: string
}

/** Parsed grading result from AI */
interface ParsedResult {
  score: number
  feedback: string
  suggestions: string[]
  strengths: string[]
  areasForImprovement: string[]
}

/** Usage counts for AI features */
interface UsageCounts {
  lesson_generation: number
  grading_assistance: number
  homework_help: number
}
export default function AIHomeworkGraderLive() {
  const { theme } = useTheme()
  const params = useLocalSearchParams<{
    assignmentTitle?: string | string[]
    gradeLevel?: string | string[]
    submissionContent?: string | string[]
    studentId?: string | string[]
    progressUploadId?: string | string[]
    contextTag?: string | string[]
    sourceFlow?: string | string[]
    activityId?: string | string[]
    activityTitle?: string | string[]
  }>()
  const readParam = (value: string | string[] | undefined) => {
    const raw = Array.isArray(value) ? value[0] : value
    if (!raw) return ''
    try { return decodeURIComponent(raw) } catch { return raw }
  }
  const [assignmentTitle, setAssignmentTitle] = useState(readParam(params.assignmentTitle) || 'Counting to 10')
  const [gradeLevel, setGradeLevel] = useState(readParam(params.gradeLevel) || 'Age 5')
  const [submissionContent, setSubmissionContent] = useState(readParam(params.submissionContent) || 'I counted 1 2 3 4 6 7 8 10')
  const [isStreaming, setIsStreaming] = useState(false)
  const [pending, setPending] = useState(false)
  const [jsonBuffer, setJsonBuffer] = useState('')
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [usage, setUsage] = useState<UsageCounts>({ lesson_generation: 0, grading_assistance: 0, homework_help: 0 })
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [recordStatus, setRecordStatus] = useState<{ state: 'idle' | 'saving' | 'saved' | 'error'; id?: string; message?: string }>({ state: 'idle' })
  const bufferRef = useRef('')
  const progressUploadId = readParam(params.progressUploadId)
  const contextTag = readParam(params.contextTag)
  const sourceFlow = readParam(params.sourceFlow)
  const activityId = readParam(params.activityId)
  const activityTitle = readParam(params.activityTitle)

  const flags = getFeatureFlagsSync()
  const AI_ENABLED = (process.env.EXPO_PUBLIC_AI_ENABLED === 'true') || (process.env.EXPO_PUBLIC_ENABLE_AI_FEATURES === 'true')
  const aiGradingEnabled = AI_ENABLED && flags.ai_grading_assistance !== false

  const { grade, result } = useGrader()
  const { quotas } = useGradingModels()
  const hasHydratedParams = useRef(false)

  React.useEffect(() => {
    if (hasHydratedParams.current) return
    const titleParam = readParam(params.assignmentTitle)
    const gradeParam = readParam(params.gradeLevel)
    const submissionParam = readParam(params.submissionContent)
    if (titleParam) setAssignmentTitle(titleParam)
    if (gradeParam) setGradeLevel(gradeParam)
    if (submissionParam) setSubmissionContent(submissionParam)
    hasHydratedParams.current = true
  }, [params.assignmentTitle, params.gradeLevel, params.submissionContent])

  React.useEffect(() => {
    (async () => {
      setUsage(await getCombinedUsage())
      try {
        const limits = await getEffectiveLimits()
        setModels((limits.modelOptions || []) as ModelOption[])
        const stored = await getPreferredModel('grading_assistance')
        setSelectedModel(stored || (limits.modelOptions && limits.modelOptions[0]?.id) || 'claude-3-haiku-20240307')
      } catch {
        // Silent failure - models will use default
      }
    })()
  }, [])

  const parseResult = React.useCallback((text: string, summary?: Partial<ParsedResult> | null): ParsedResult => {
    if (summary && summary.feedback) {
      return {
        score: Number(summary.score || 0),
        feedback: String(summary.feedback || ''),
        suggestions: Array.isArray(summary.suggestions) ? summary.suggestions : [],
        strengths: Array.isArray(summary.strengths) ? summary.strengths : [],
        areasForImprovement: Array.isArray(summary.areasForImprovement) ? summary.areasForImprovement : [],
      }
    }

    try {
      const parsedObj = JSON.parse(text || '{}')
      if (parsedObj && typeof parsedObj === 'object' && (parsedObj.score || parsedObj.feedback)) {
        return {
          score: Number(parsedObj.score || 0),
          feedback: String(parsedObj.feedback || ''),
          suggestions: Array.isArray(parsedObj.suggestions) ? parsedObj.suggestions : [],
          strengths: Array.isArray(parsedObj.strengths) ? parsedObj.strengths : [],
          areasForImprovement: Array.isArray(parsedObj.areasForImprovement) ? parsedObj.areasForImprovement : [],
        }
      }
    } catch {
      // Fallback to plain text
    }

    return {
      score: 0,
      feedback: text || '',
      suggestions: [],
      strengths: [],
      areasForImprovement: [],
    }
  }, [])

  const persistGradingRecord = React.useCallback(async (gradeResult: ParsedResult, rawResponse: string) => {
    const supabase = assertSupabase() as any
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData?.user?.id
    if (!userId) {
      throw new Error('You must be signed in to save grading records.')
    }

    const studentId = readParam(params.studentId) || null
    const payload = {
      user_id: userId,
      student_id: studentId,
      mode: 'practice',
      subject: 'homework_grading',
      grade: gradeLevel || null,
      topic: assignmentTitle || null,
      question: assignmentTitle || null,
      learner_answer: submissionContent || null,
      score: Number.isFinite(gradeResult.score) ? gradeResult.score : null,
      feedback: gradeResult.feedback || null,
      is_correct: null,
      metadata: {
        source: 'ai_homework_grader_live',
        context_tag: contextTag || null,
        source_flow: sourceFlow || null,
        progress_upload_id: progressUploadId || null,
        activity_id: activityId || null,
        activity_title: activityTitle || null,
        model: selectedModel || null,
        assignment_title: assignmentTitle || null,
        grade_level: gradeLevel || null,
        suggestions: gradeResult.suggestions || [],
        strengths: gradeResult.strengths || [],
        areas_for_improvement: gradeResult.areasForImprovement || [],
        raw_response_preview: (rawResponse || '').slice(0, 2000),
      },
    }

    const { data, error } = await supabase
      .from('dash_ai_tutor_attempts')
      .insert(payload)
      .select('id, created_at')
      .single()

    if (error) {
      throw new Error(error.message || 'Failed to save grading record')
    }
    return data as { id: string; created_at: string }
  }, [
    activityId,
    activityTitle,
    assignmentTitle,
    contextTag,
    gradeLevel,
    params.studentId,
    progressUploadId,
    readParam,
    selectedModel,
    sourceFlow,
    submissionContent,
  ])

  const startStreaming = async () => {
    setPending(true)
    setRecordStatus({ state: 'idle' })
    if (!submissionContent.trim()) {
      toast.warn('Please provide the student submission text.')
      setPending(false)
      return
    }
    if (!aiGradingEnabled) {
      toast.warn('Homework grader is not enabled in this build.')
      setPending(false)
      return
    }
    // Enforce quota before starting
    const gate = await canUseFeature('grading_assistance', 1)
    if (!gate.allowed) {
      const status = await getQuotaStatus('grading_assistance')
      Alert.alert(
        'Monthly limit reached',
        `You have used ${status.used} of ${status.limit} grading sessions this month. ${gate.requiresPrepay ? 'Please upgrade or purchase more to continue.' : ''}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'See plans', onPress: () => router.push('/pricing') },
        ]
      )
      setPending(false)
      return
    }
    try {
      setIsStreaming(true)
      setJsonBuffer('')
      bufferRef.current = ''
      setParsed(null)
      let finalSummary: Partial<ParsedResult> | null = null
      track('edudash.ai.grader.ui_started', {})

      // Use hook for grading (non-streaming for now). We still keep UI notion of streaming.
      const text = await grade(
        { submissionText: submissionContent, rubric: ['accuracy', 'completeness'], gradeLevel: 5, language: 'en' },
        {
          model: selectedModel,
          streaming: true,
          onDelta: (chunk) => {
            bufferRef.current += chunk;
            setJsonBuffer(bufferRef.current);
          },
          onFinal: (summary) => {
            if (summary && summary.feedback) {
              finalSummary = summary
              setParsed({
                score: Number(summary.score || 0),
                feedback: String(summary.feedback || ''),
                suggestions: Array.isArray(summary.suggestions) ? summary.suggestions : [],
                strengths: Array.isArray(summary.strengths) ? summary.strengths : [],
                areasForImprovement: Array.isArray(summary.areasForImprovement) ? summary.areasForImprovement : [],
              });
            }
          }
        }
      )

      const finalParsed = parseResult(text, finalSummary)
      setParsed(finalParsed)

      // Persist grading run so parents have a durable record.
      setRecordStatus({ state: 'saving' })
      try {
        const saved = await persistGradingRecord(finalParsed, text)
        setRecordStatus({ state: 'saved', id: saved.id })
      } catch (persistErr: unknown) {
        const persistMessage = persistErr instanceof Error ? persistErr.message : 'Failed to save grading record'
        setRecordStatus({ state: 'error', message: persistMessage })
        toast.warn(`Grading completed, but record save failed: ${persistMessage}`)
      }

      setIsStreaming(false)
      setPending(false)
      setUsage(await getCombinedUsage())
      track('edudash.ai.grader.ui_completed', { score: finalParsed.score })
    } catch (e: unknown) {
      setIsStreaming(false)
      setPending(false)
      const errorMessage = e instanceof Error ? e.message : 'Failed to start grading'
      track('edudash.ai.grader.ui_failed', { error: errorMessage })
      toast.error(`Error: ${errorMessage}`)
    }
  }

  const scoreColor = parsed ? (parsed.score >= 90 ? '#10B981' : parsed.score >= 80 ? '#3B82F6' : parsed.score >= 70 ? '#F59E0B' : '#EF4444') : '#111827'

  return (
    <View style={[styles.container, { backgroundColor: '#fff' }]}>
      <View style={[styles.header, { borderBottomColor: '#E5E7EB' }]}>
        <View style={styles.headerLeft}>
          <IconSymbol name="doc.text.below.ecg" size={22} color="#8B5CF6" />
          <Text style={[styles.headerTitle, { color: '#111827' }]}>AI Homework Grader (Live)</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
          <Text style={[styles.label, { color: '#6B7280' }]}>Assignment Title</Text>
          <TextInput
            value={assignmentTitle}
            onChangeText={setAssignmentTitle}
            placeholder="e.g., Counting to 10"
            placeholderTextColor={'#9CA3AF'}
            style={[styles.input, { color: '#111827', borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }]}
          />

          <Text style={[styles.label, { color: '#6B7280' }]}>Grade Level / Age</Text>
          <TextInput
            value={gradeLevel}
            onChangeText={setGradeLevel}
            placeholder="e.g., Age 5 or Grade R"
            placeholderTextColor={'#9CA3AF'}
            style={[styles.input, { color: '#111827', borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }]}
          />

          <Text style={[styles.label, { color: '#6B7280' }]}>Student Submission</Text>
          <TextInput
            value={submissionContent}
            onChangeText={setSubmissionContent}
            placeholder="Paste or type the student's answer"
            placeholderTextColor={'#9CA3AF'}
            style={[styles.textArea, { color: '#111827', borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }]}
            multiline
          />

          {/* Model selector */}
          {models.length > 0 && (
            <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
              <Text style={[styles.sectionTitle, { color: '#111827' }]}>Model</Text>
              <View style={[styles.inlineRow, { gap: 8, flexWrap: 'wrap' }]}>
                {models.map(m => (
                  <TouchableOpacity key={m.id} onPress={async () => { setSelectedModel(m.id); try { await setPreferredModel(m.id, 'grading_assistance') } catch { /* Silent */ } }} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: selectedModel === m.id ? '#8B5CF6' : '#E5E7EB', backgroundColor: selectedModel === m.id ? '#8B5CF6' : 'transparent' }}>
                    <Text style={{ color: selectedModel === m.id ? '#fff' : '#111827' }}>
                      {`${m.name} · x${m.relativeCost} · ${m.relativeCost <= 1 ? '$' : m.relativeCost <= 5 ? '$$' : '$$$'}${m.notes ? ` · ${m.notes}` : ''}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={startStreaming}
            disabled={pending || isStreaming || !aiGradingEnabled}
            style={[styles.primaryButton, { opacity: (pending || isStreaming || !aiGradingEnabled) ? 0.6 : 1, backgroundColor: '#8B5CF6' }]}
          >
            {(isStreaming || pending) ? (
              <View style={styles.inlineRow}>
                <EduDashSpinner color="#FFF" />
                <Text style={styles.primaryButtonText}> Streaming…</Text>
              </View>
            ) : (
              <View style={styles.inlineRow}>
                <IconSymbol name="waveform" size={18} color="#FFF" />
                <Text style={styles.primaryButtonText}> Start Live Grading</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
          <Text style={[styles.sectionTitle, { color: '#111827' }]}>Live JSON Stream</Text>
          <Text style={{ color: '#6B7280', marginBottom: 6 }}>Monthly usage (local/server): Grading {usage.grading_assistance}</Text>
          <QuotaBar feature="grading_assistance" planLimit={quotas.ai_requests} />
          {result?.__fallbackUsed && (
            <View style={[styles.fallbackChip, { borderColor: '#E5E7EB', backgroundColor: theme.accent + '20' }]}>
              <Ionicons name="information-circle" size={16} color={theme.accent} />
              <Text style={{ color: '#6B7280', fontSize: 12, marginLeft: 6 }}>Fallback used</Text>
            </View>
          )}
          <View style={[styles.jsonBox, { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }]}>
            <Text style={[styles.jsonText, { color: '#111827' }]} selectable>
              {jsonBuffer || (isStreaming ? 'Waiting for tokens…' : 'No data yet. Press "Start Live Grading".')}
            </Text>
          </View>
        </View>

        {parsed && (
          <View style={[styles.parsedCard, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            <Text style={[styles.parsedTitle, { color: '#111827' }]}>Parsed Summary</Text>
            <Text style={[styles.parsedLabel, { color: '#6B7280' }]}>Score</Text>
            <Text style={[styles.parsedScore, { color: scoreColor }]}>{parsed.score}</Text>
            <Text style={[styles.parsedLabel, { color: '#6B7280' }]}>Feedback</Text>
            <Text style={[styles.parsedText, { color: '#111827' }]}>{parsed.feedback}</Text>
            <Text style={[styles.parsedLabel, { color: '#6B7280' }]}>Record</Text>
            {recordStatus.state === 'saving' && (
              <Text style={[styles.parsedText, { color: '#6B7280' }]}>Saving grading record...</Text>
            )}
            {recordStatus.state === 'saved' && (
              <Text style={[styles.parsedText, { color: '#10B981' }]}>Saved to record: {recordStatus.id}</Text>
            )}
            {recordStatus.state === 'error' && (
              <Text style={[styles.parsedText, { color: '#EF4444' }]}>{recordStatus.message || 'Failed to save grading record'}</Text>
            )}
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  )
}

function QuotaBar({ feature, planLimit }: { feature: 'lesson_generation' | 'grading_assistance' | 'homework_help'; planLimit?: number }) {
  const [status, setStatus] = React.useState<{ used: number; limit: number; remaining: number } | null>(null)
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const s = await getQuotaStatus(feature)
        const limit = planLimit && planLimit > 0 ? planLimit : s.limit
        if (mounted) setStatus({ used: s.used, limit, remaining: Math.max(0, (limit === -1 ? 0 : limit) - s.used) })
      } catch {
        if (mounted) setStatus(null)
      }
    })()
    return () => { mounted = false }
  }, [feature, planLimit])
  if (!status) return null
  if (status.limit === -1) return <Text style={{ color: '#6B7280', marginTop: 4 }}>Quota: Unlimited</Text>
  const pct = Math.max(0, Math.min(100, Math.round((status.used / Math.max(1, status.limit)) * 100)))
  return (
    <View style={{ marginTop: 4 }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' }}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: '#8B5CF6' }} />
      </View>
      <Text style={{ color: '#6B7280', marginTop: 4, fontSize: 12 }}>Quota: {status.used}/{status.limit} used · {Math.max(0, status.limit - status.used)} remaining</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  content: { padding: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  textArea: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 120 },
  primaryButton: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  inlineRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  jsonBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 10, minHeight: 80 },
  jsonText: { fontFamily: 'monospace' },
  parsedCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12 },
  parsedTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  parsedLabel: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  parsedScore: { fontSize: 28, fontWeight: '900' },
  parsedText: { fontSize: 13 },
  bottomSpacing: { height: 40 },
  fallbackChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
})
