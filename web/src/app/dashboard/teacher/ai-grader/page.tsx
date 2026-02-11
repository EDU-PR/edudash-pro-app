'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Brain, Loader2, Sparkles, CheckCircle2, AlertCircle, User, ClipboardCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';

interface ClassRow {
  id: string;
  name: string;
  grade: string | null;
}

interface StudentRow {
  id: string;
  full_name: string | null;
  class_id: string | null;
}

interface StudentOption {
  id: string;
  fullName: string;
  classId: string | null;
  classLabel: string;
}

interface RubricAssessmentItem {
  criterion: string;
  score: number | null;
  note: string;
}

interface GradingResult {
  score: number | null;
  feedback: string;
  strengths: string[];
  areasForImprovement: string[];
  suggestions: string[];
  rubricAssessment: RubricAssessmentItem[];
}

interface AIProxyResult {
  content?: string;
  response?: string;
  [key: string]: unknown;
}

const clampScore = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeRubric = (value: unknown): RubricAssessmentItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const item = row as Record<string, unknown>;
      const criterion = typeof item.criterion === 'string' ? item.criterion.trim() : '';
      if (!criterion) return null;
      const note = typeof item.note === 'string' ? item.note.trim() : '';
      return {
        criterion,
        score: clampScore(item.score),
        note,
      };
    })
    .filter((row): row is RubricAssessmentItem => row !== null);
};

const unwrapJsonBlock = (text: string): string => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

const parseResultFromText = (text: string): GradingResult | null => {
  const normalizedText = unwrapJsonBlock(text);
  const parseCandidate = (candidate: string): GradingResult | null => {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      return {
        score: clampScore(parsed.score),
        feedback: typeof parsed.feedback === 'string' ? parsed.feedback.trim() : '',
        strengths: normalizeStringList(parsed.strengths),
        areasForImprovement: normalizeStringList(parsed.areasForImprovement),
        suggestions: normalizeStringList(parsed.suggestions),
        rubricAssessment: normalizeRubric(parsed.rubricAssessment),
      };
    } catch {
      return null;
    }
  };

  const direct = parseCandidate(normalizedText);
  if (direct && direct.feedback) return direct;

  const start = normalizedText.indexOf('{');
  const end = normalizedText.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const nested = parseCandidate(normalizedText.slice(start, end + 1));
    if (nested && nested.feedback) return nested;
  }

  return null;
};

const scoreColor = (score: number | null): string => {
  if (score === null) return '#e5e7eb';
  if (score >= 85) return '#16a34a';
  if (score >= 70) return '#2563eb';
  if (score >= 50) return '#f59e0b';
  return '#dc2626';
};

const GRADING_MODELS = [
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Balanced)' },
  { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fast)' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (Alternative)' },
];

export default function TeacherAIGraderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [grading, setGrading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState('');
  const [result, setResult] = useState<GradingResult | null>(null);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [submissionText, setSubmissionText] = useState('');
  const [rubricText, setRubricText] = useState('Accuracy\nCompleteness\nClarity');
  const [selectedModel, setSelectedModel] = useState(GRADING_MODELS[0].id);
  const [contextTag, setContextTag] = useState('');
  const [sourceFlow, setSourceFlow] = useState('');
  const [progressUploadId, setProgressUploadId] = useState('');
  const [prefillApplied, setPrefillApplied] = useState(false);

  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
      setAuthLoading(false);
    };
    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    const loadClassesAndStudents = async () => {
      if (!userId || !profile?.preschoolId) {
        setLoadingPeople(false);
        return;
      }

      setLoadingPeople(true);
      try {
        const { data: classRows, error: classError } = await supabase
          .from('classes')
          .select('id, name, grade')
          .eq('teacher_id', userId)
          .eq('preschool_id', profile.preschoolId)
          .order('name', { ascending: true });

        if (classError) throw classError;

        const teacherClasses = (classRows || []) as ClassRow[];
        setClasses(teacherClasses);

        const classMap = new Map<string, string>(
          teacherClasses.map((cls) => [
            cls.id,
            cls.grade ? `${cls.name} (${cls.grade})` : cls.name,
          ]),
        );
        const classIds = teacherClasses.map((cls) => cls.id);
        if (classIds.length === 0) {
          setStudents([]);
          return;
        }

        const { data: studentRows, error: studentError } = await supabase
          .from('students')
          .select('id, full_name, class_id')
          .eq('preschool_id', profile.preschoolId)
          .eq('is_active', true)
          .in('class_id', classIds)
          .order('full_name', { ascending: true });

        if (studentError) throw studentError;

        const normalizedStudents: StudentOption[] = (studentRows || []).map((student: StudentRow) => ({
          id: student.id,
          fullName: student.full_name || 'Unnamed student',
          classId: student.class_id,
          classLabel: student.class_id ? (classMap.get(student.class_id) || 'Class') : 'Class',
        }));
        setStudents(normalizedStudents);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load classes and students';
        setErrorMessage(message);
      } finally {
        setLoadingPeople(false);
      }
    };

    loadClassesAndStudents();
  }, [userId, profile?.preschoolId, supabase]);

  const visibleStudents = useMemo(() => {
    if (selectedClassId === 'all') return students;
    return students.filter((student) => student.classId === selectedClassId);
  }, [students, selectedClassId]);

  useEffect(() => {
    if (!selectedStudentId) return;
    if (!visibleStudents.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId('');
    }
  }, [selectedStudentId, visibleStudents]);

  useEffect(() => {
    if (prefillApplied) return;

    const assignmentTitleParam = searchParams.get('assignmentTitle');
    const gradeLevelParam = searchParams.get('gradeLevel');
    const submissionTextParam = searchParams.get('submissionText');
    const studentIdParam = searchParams.get('studentId');
    const contextTagParam = searchParams.get('contextTag');
    const sourceFlowParam = searchParams.get('sourceFlow');
    const progressUploadIdParam = searchParams.get('progressUploadId');

    const hasPrefill = [
      assignmentTitleParam,
      gradeLevelParam,
      submissionTextParam,
      studentIdParam,
      contextTagParam,
      sourceFlowParam,
      progressUploadIdParam,
    ].some(Boolean);

    if (!hasPrefill) {
      setPrefillApplied(true);
      return;
    }

    if (assignmentTitleParam) setAssignmentTitle(assignmentTitleParam);
    if (gradeLevelParam) setGradeLevel(gradeLevelParam);
    if (submissionTextParam) setSubmissionText(submissionTextParam);
    if (studentIdParam) setSelectedStudentId(studentIdParam);
    if (contextTagParam) setContextTag(contextTagParam);
    if (sourceFlowParam) setSourceFlow(sourceFlowParam);
    if (progressUploadIdParam) setProgressUploadId(progressUploadIdParam);

    setResult(null);
    setRawResponse('');
    setErrorMessage(null);
    setSaveMessage(null);
    setPrefillApplied(true);
  }, [prefillApplied, searchParams]);

  const handleUseSample = () => {
    setAssignmentTitle('Counting Objects to 20');
    setGradeLevel('Grade R');
    setSubmissionText(
      'I counted the apples: 2, 4, 6, 8, 10, 12, 14, 15, 18, 20. I got confused after 14 but finished the worksheet.',
    );
    setRubricText('Counting accuracy\nNumber sequence\nWork shown clearly');
    setResult(null);
    setRawResponse('');
    setErrorMessage(null);
    setSaveMessage(null);
  };

  const handleGrade = async () => {
    setErrorMessage(null);
    setSaveMessage(null);
    setRawResponse('');
    setResult(null);

    if (!assignmentTitle.trim() || !gradeLevel.trim() || !submissionText.trim()) {
      setErrorMessage('Please complete assignment title, grade level, and student submission before grading.');
      return;
    }

    const rubricItems = rubricText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    const prompt = [
      'You are an experienced teacher grading a student submission.',
      'Return strictly valid JSON only (no markdown, no explanation).',
      'Schema:',
      '{',
      '  "score": number (0-100),',
      '  "feedback": string,',
      '  "strengths": string[],',
      '  "areasForImprovement": string[],',
      '  "suggestions": string[],',
      '  "rubricAssessment": [{"criterion": string, "score": number, "note": string}]',
      '}',
      '',
      `Assignment title: ${assignmentTitle}`,
      `Grade level: ${gradeLevel}`,
      `Rubric criteria: ${rubricItems.length ? rubricItems.join(', ') : 'Accuracy, Completeness, Clarity'}`,
      `Student submission: ${submissionText}`,
      '',
      'Keep feedback concise and practical for the teacher to share with the parent.',
    ].join('\n');

    setGrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: {
          prompt,
          model: selectedModel,
          max_tokens: 1400,
        },
      });

      if (error) throw error;

      const responseData = (data || {}) as AIProxyResult;
      const raw = typeof responseData.content === 'string'
        ? responseData.content
        : typeof responseData.response === 'string'
          ? responseData.response
          : JSON.stringify(responseData);

      setRawResponse(raw);
      const parsed = parseResultFromText(raw);
      const normalized: GradingResult = parsed || {
        score: null,
        feedback: raw || 'No feedback returned by AI.',
        strengths: [],
        areasForImprovement: [],
        suggestions: [],
        rubricAssessment: [],
      };
      setResult(normalized);

      if (!userId) return;
      setSaving(true);
      const insertPayload = {
        user_id: userId,
        student_id: selectedStudentId || null,
        mode: 'practice',
        subject: contextTag === 'family_activity' ? 'family_activity' : 'homework_grading',
        grade: gradeLevel || null,
        topic: assignmentTitle || null,
        question: assignmentTitle || null,
        learner_answer: submissionText || null,
        score: normalized.score,
        feedback: normalized.feedback,
        metadata: {
          source: sourceFlow || 'web_teacher_ai_grader',
          source_flow: sourceFlow || null,
          context_tag: contextTag || null,
          progress_upload_id: progressUploadId || null,
          model: selectedModel,
          rubric: rubricItems,
          strengths: normalized.strengths,
          areas_for_improvement: normalized.areasForImprovement,
          suggestions: normalized.suggestions,
          rubric_assessment: normalized.rubricAssessment,
        },
      };

      const { data: saved, error: saveError } = await supabase
        .from('dash_ai_tutor_attempts')
        .insert(insertPayload)
        .select('id')
        .single();

      if (saveError) {
        setSaveMessage(`Grading completed, but saving failed: ${saveError.message}`);
      } else {
        setSaveMessage(`Grading completed and saved (record: ${saved?.id || 'unknown'}).`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to grade homework';
      setErrorMessage(message);
    } finally {
      setGrading(false);
      setSaving(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <TeacherShell
      tenantSlug={tenantSlug}
      userEmail={profile?.email}
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName}
      userId={userId}
      hideHeader={true}
    >
      <div className="container">
        <div className="section">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="h1">AI Homework Grader</h1>
                <p className="muted">Grade learner submissions and save a structured record for follow-up.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleUseSample}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-purple-500/40 text-purple-300 hover:bg-purple-900/20 transition-colors"
            >
              Use sample input
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="section">
            <div className="card p-md border border-red-500/40 bg-red-950/20 text-red-200 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {saveMessage && (
          <div className="section">
            <div className="card p-md border border-emerald-500/40 bg-emerald-950/20 text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 mt-0.5" />
              <span>{saveMessage}</span>
            </div>
          </div>
        )}

        <div className="section">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card p-md">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                <ClipboardCheck className="w-5 h-5 text-purple-400" />
                Submission Input
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Assignment Title</label>
                  <input
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    placeholder="e.g., Counting Objects to 20"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Grade Level / Age</label>
                  <input
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    placeholder="e.g., Grade R or Age 5"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Class</label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="all">All my classes</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.grade ? `${cls.name} (${cls.grade})` : cls.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Student (optional)</label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      disabled={loadingPeople}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:opacity-50"
                    >
                      <option value="">No specific student</option>
                      {visibleStudents.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.fullName} • {student.classLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">AI Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  >
                    {GRADING_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Rubric Criteria (one per line)</label>
                  <textarea
                    value={rubricText}
                    onChange={(e) => setRubricText(e.target.value)}
                    rows={4}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Student Submission</label>
                  <textarea
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    rows={8}
                    placeholder="Paste the learner submission text here..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGrade}
                  disabled={grading || saving}
                  className="w-full px-4 py-3 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
                >
                  {(grading || saving) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {grading ? 'Grading submission...' : 'Saving result...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Grade with AI
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="card p-md">
              <h2 className="text-lg font-semibold mb-4 text-white">Grading Result</h2>

              {!result ? (
                <div className="text-sm text-gray-400">
                  Run AI grading to view score, strengths, improvement areas, and suggestions.
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    className="rounded-xl px-4 py-3 text-white flex items-center justify-between"
                    style={{ background: `linear-gradient(135deg, ${scoreColor(result.score)}, #1f2937)` }}
                  >
                    <span className="text-sm uppercase tracking-wide opacity-90">Score</span>
                    <strong style={{ fontSize: 28 }}>{result.score ?? 'N/A'}</strong>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-300 mb-1">Feedback</h3>
                    <p className="text-sm text-gray-100 whitespace-pre-wrap">{result.feedback || 'No feedback generated.'}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-300 mb-2">Strengths</h3>
                      {result.strengths.length === 0 ? (
                        <p className="text-sm text-gray-400">No strengths listed.</p>
                      ) : (
                        <ul className="text-sm text-gray-200 list-disc pl-5 space-y-1">
                          {result.strengths.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-amber-300 mb-2">Areas For Improvement</h3>
                      {result.areasForImprovement.length === 0 ? (
                        <p className="text-sm text-gray-400">No areas listed.</p>
                      ) : (
                        <ul className="text-sm text-gray-200 list-disc pl-5 space-y-1">
                          {result.areasForImprovement.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-cyan-300 mb-2">Suggestions</h3>
                    {result.suggestions.length === 0 ? (
                      <p className="text-sm text-gray-400">No suggestions listed.</p>
                    ) : (
                      <ul className="text-sm text-gray-200 list-disc pl-5 space-y-1">
                        {result.suggestions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {result.rubricAssessment.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-violet-300 mb-2">Rubric Breakdown</h3>
                      <div className="space-y-2">
                        {result.rubricAssessment.map((row) => (
                          <div key={row.criterion} className="rounded-lg border border-gray-700 px-3 py-2 bg-gray-900/50">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-gray-200">{row.criterion}</span>
                              <span className="text-xs text-gray-400">
                                Score: {row.score === null ? 'N/A' : row.score}
                              </span>
                            </div>
                            {row.note && <p className="text-xs text-gray-400 mt-1">{row.note}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {rawResponse && (
                    <details className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2">
                      <summary className="cursor-pointer text-sm text-gray-300">Show raw AI response</summary>
                      <pre className="mt-2 text-xs text-gray-400 whitespace-pre-wrap break-words">{rawResponse}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500 flex items-center gap-2">
            <User className="w-3.5 h-3.5" />
            Student linking is optional, but selecting a student improves traceability in reports.
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}
