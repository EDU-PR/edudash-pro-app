/**
 * Generate Exam Edge Function (Exam Prep V2)
 *
 * - Structured exam generation via Anthropic
 * - Optional teacher-artifact context resolution (homework + lessons)
 * - Access checks by role scope (parent/student/staff)
 * - Canonical persistence to exam_generations
 */

import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY=REDACTED
const ANTHROPIC_API_KEY=REDACTED

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

type JsonRecord = Record<string, unknown>;

type ProfileRow = {
  id: string;
  role: string | null;
  organization_id: string | null;
  preschool_id: string | null;
  auth_user_id: string | null;
};

type StudentRow = {
  id: string;
  parent_id: string | null;
  guardian_id: string | null;
  class_id: string | null;
  organization_id: string | null;
  preschool_id: string | null;
  grade: string | null;
  grade_level: string | null;
  student_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

type HomeworkRow = {
  id: string;
  title: string | null;
  subject: string | null;
  instructions: string | null;
  description: string | null;
  metadata: unknown;
  due_date: string | null;
  created_at: string | null;
  assigned_at: string | null;
  class_id: string | null;
  lesson_id: string | null;
  is_published: boolean | null;
  is_active: boolean | null;
  status: string | null;
  preschool_id: string | null;
};

type HomeworkSubmissionRow = {
  assignment_id: string | null;
  homework_assignment_id: string | null;
  grade: number | null;
  feedback: string | null;
  ai_feedback: string | null;
  status: string | null;
  submitted_at: string | null;
};

type LessonRow = {
  id: string;
  title: string | null;
  subject: string | null;
  objectives: string[] | null;
  content: string | null;
  description: string | null;
};

type LessonAssignmentRow = {
  id: string;
  lesson_id: string | null;
  due_date: string | null;
  assigned_at: string | null;
  status: string | null;
  class_id: string | null;
  student_id: string | null;
  preschool_id: string | null;
  notes: string | null;
  lessons: LessonRow | LessonRow[] | null;
};

type ExamContextSummary = {
  assignmentCount: number;
  lessonCount: number;
  focusTopics: string[];
  weakTopics: string[];
  sourceAssignmentIds: string[];
  sourceLessonIds: string[];
};

type AuthorizedRequestScope = {
  profile: ProfileRow;
  role: string;
  student: StudentRow | null;
  effectiveClassId: string | null;
  effectiveSchoolId: string | null;
  effectiveStudentId: string | null;
};

const STAFF_ROLES = new Set([
  'teacher',
  'principal',
  'principal_admin',
  'admin',
  'school_admin',
  'super_admin',
]);

const PARENT_ROLES = new Set(['parent', 'guardian', 'sponsor']);
const STUDENT_ROLES = new Set(['student', 'learner']);

const SUPPORTED_QUESTION_TYPES = new Set([
  'multiple_choice',
  'true_false',
  'short_answer',
  'fill_in_blank',
]);

const EXAM_SYSTEM_PROMPT = `You are an expert South African CAPS/DBE exam generator.
Return ONLY valid JSON and no markdown.

Required JSON shape:
{
  "title": "string",
  "grade": "string",
  "subject": "string",
  "duration": "string",
  "totalMarks": number,
  "sections": [
    {
      "name": "string",
      "questions": [
        {
          "id": "q1",
          "question": "string",
          "type": "multiple_choice|true_false|short_answer|fill_in_blank",
          "marks": number,
          "options": ["A", "B", "C", "D"],
          "correctAnswer": "string",
          "explanation": "string"
        }
      ]
    }
  ]
}

Rules:
- CAPS/DBE aligned for selected grade and subject.
- Include mark allocation on every question.
- Use age-appropriate cognitive progression and South African context.
- Provide a valid correctAnswer and explanation for each question.
- At least 2 sections and at least 12 questions for practice_test unless user requests shorter.
- Prefer concise, clean question text.
`;

function jsonResponse(body: JsonRecord, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeOrgId(profile: ProfileRow): string | null {
  return profile.organization_id || profile.preschool_id || null;
}

function getDefaultModelForTier(tier: string | null | undefined): string {
  const t = String(tier ?? 'free').toLowerCase();
  if (t.includes('enterprise') || t === 'superadmin' || t === 'super_admin') return 'claude-sonnet-4-20250514';
  if (t.includes('premium') || t.includes('pro') || t.includes('plus') || t.includes('basic')) {
    return 'claude-3-7-sonnet-20250219';
  }
  if (t.includes('starter') || t === 'trial') return 'claude-3-5-sonnet-20241022';
  return 'claude-3-haiku-20240307';
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesSubject(candidate: string | null | undefined, requested: string): boolean {
  const c = normalizeText(candidate);
  const r = normalizeText(requested);

  if (!c || !r) return false;
  if (c.includes(r) || r.includes(c)) return true;

  const tokens = r.split(' ').filter((token) => token.length >= 4);
  if (tokens.length === 0) return false;
  return tokens.some((token) => c.includes(token));
}

function parseDateValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isRecent(row: { due_date?: string | null; assigned_at?: string | null; created_at?: string | null }, lookbackMs: number): boolean {
  const values = [
    parseDateValue(row.due_date || null),
    parseDateValue(row.assigned_at || null),
    parseDateValue(row.created_at || null),
  ].filter((item): item is number => item !== null);

  if (values.length === 0) return true;
  return values.some((value) => value >= lookbackMs);
}

function sanitizeTopic(value: string | null | undefined): string | null {
  const cleaned = String(value || '')
    .replace(/[\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 3) return null;
  if (cleaned.length > 80) return `${cleaned.slice(0, 77)}...`;
  return cleaned;
}

function pickTopTopics(map: Map<string, number>, limit: number): string[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic]) => topic);
}

function normalizeQuestionType(type: string | null | undefined): string {
  const raw = String(type || 'short_answer').toLowerCase();
  if (raw === 'fill_blank') return 'fill_in_blank';
  if (raw === 'fill-in-the-blank') return 'fill_in_blank';
  if (raw === 'fillintheblank') return 'fill_in_blank';
  if (SUPPORTED_QUESTION_TYPES.has(raw)) return raw;
  if (raw.includes('true')) return 'true_false';
  if (raw.includes('multiple')) return 'multiple_choice';
  return 'short_answer';
}

function normalizeExamShape(rawExam: any, grade: string, subject: string, examType: string) {
  const rawSections = Array.isArray(rawExam?.sections)
    ? rawExam.sections
    : Array.isArray(rawExam?.questions)
    ? [{ name: 'Section A', questions: rawExam.questions }]
    : [];

  let questionCounter = 0;
  const sections = rawSections.map((section: any, sectionIndex: number) => {
    const rawQuestions = Array.isArray(section?.questions) ? section.questions : [];
    const normalizedQuestions = rawQuestions.map((question: any, questionIndex: number) => {
      questionCounter += 1;
      const marks = Number(question?.marks ?? question?.points ?? question?.score ?? 1);
      const type = normalizeQuestionType(question?.type);
      const options = Array.isArray(question?.options)
        ? question.options.map((item: unknown) => String(item))
        : undefined;
      const prompt = String(question?.question ?? question?.text ?? '').trim();

      return {
        id: String(question?.id || `q_${sectionIndex + 1}_${questionIndex + 1}`),
        question: prompt,
        text: prompt,
        type,
        marks: Number.isFinite(marks) ? Math.max(1, marks) : 1,
        options,
        correctAnswer: String(question?.correctAnswer ?? question?.correct_answer ?? question?.answer ?? ''),
        explanation: String(question?.explanation || '').trim() || undefined,
      };
    });

    const sectionMarks = normalizedQuestions.reduce((sum: number, question: any) => sum + Number(question.marks || 0), 0);

    return {
      id: String(section?.id || `section_${sectionIndex + 1}`),
      name: String(section?.name || section?.title || `Section ${sectionIndex + 1}`),
      title: String(section?.title || section?.name || `Section ${sectionIndex + 1}`),
      questions: normalizedQuestions,
      totalMarks: sectionMarks,
    };
  });

  const totalMarks = sections.reduce((sum: number, section: any) => sum + Number(section.totalMarks || 0), 0);

  return {
    title: String(rawExam?.title || `${subject} ${examType.replace(/_/g, ' ')}`),
    grade,
    subject,
    duration: String(rawExam?.duration || '90 minutes'),
    totalMarks,
    sections,
  };
}

function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1];

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch?.[0]) return jsonMatch[0];

  throw new Error('No JSON payload found in AI response');
}

async function fetchProfileByAuthUser(supabase: ReturnType<typeof createClient>, authUserId: string): Promise<ProfileRow | null> {
  const byAuth = await supabase
    .from('profiles')
    .select('id, role, organization_id, preschool_id, auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (!byAuth.error && byAuth.data) {
    return byAuth.data as ProfileRow;
  }

  const byId = await supabase
    .from('profiles')
    .select('id, role, organization_id, preschool_id, auth_user_id')
    .eq('id', authUserId)
    .maybeSingle();

  if (!byId.error && byId.data) {
    return byId.data as ProfileRow;
  }

  return null;
}

async function isParentLinkedToStudent(
  supabase: ReturnType<typeof createClient>,
  parentProfileId: string,
  studentId: string,
): Promise<boolean> {
  const studentResult = await supabase
    .from('students')
    .select('id')
    .eq('id', studentId)
    .or(`parent_id.eq.${parentProfileId},guardian_id.eq.${parentProfileId}`)
    .maybeSingle();

  if (!studentResult.error && studentResult.data) {
    return true;
  }

  const relationResult = await supabase
    .from('student_parent_relationships')
    .select('id')
    .eq('student_id', studentId)
    .eq('parent_id', parentProfileId)
    .maybeSingle();

  return !relationResult.error && !!relationResult.data;
}

async function resolveStudentForRequest(
  supabase: ReturnType<typeof createClient>,
  studentId: string,
): Promise<StudentRow | null> {
  const { data, error } = await supabase
    .from('students')
    .select('id, parent_id, guardian_id, class_id, organization_id, preschool_id, grade, grade_level, student_id, first_name, last_name')
    .eq('id', studentId)
    .maybeSingle();

  if (error || !data) return null;
  return data as StudentRow;
}

async function resolveStudentForStudentRole(
  supabase: ReturnType<typeof createClient>,
  profile: ProfileRow,
  authUserId: string,
): Promise<StudentRow | null> {
  const candidateIds = [profile.id, authUserId]
    .map((value) => String(value || '').trim())
    .filter((value) => value.length > 0);

  if (candidateIds.length === 0) return null;

  for (const candidate of candidateIds) {
    const { data, error } = await supabase
      .from('students')
      .select('id, parent_id, guardian_id, class_id, organization_id, preschool_id, grade, grade_level, student_id, first_name, last_name')
      .eq('student_id', candidate)
      .limit(1);

    if (!error && data && data.length === 1) {
      return data[0] as StudentRow;
    }
  }

  return null;
}

async function resolveAuthorizedScope(
  supabase: ReturnType<typeof createClient>,
  authUserId: string,
  payload: {
    studentId?: string;
    classId?: string;
    schoolId?: string;
    useTeacherContext: boolean;
  },
): Promise<AuthorizedRequestScope> {
  const profile = await fetchProfileByAuthUser(supabase, authUserId);
  if (!profile) {
    throw new Error('Organization membership required');
  }

  const role = String(profile.role || '').toLowerCase();
  const isParent = PARENT_ROLES.has(role);
  const isStudent = STUDENT_ROLES.has(role);
  const isStaff = STAFF_ROLES.has(role);
  const isSuperAdmin = role === 'super_admin';
  const profileOrgId = normalizeOrgId(profile);

  if (isStaff && !isSuperAdmin && !profileOrgId) {
    throw new Error('School membership required for staff exam generation');
  }

  let student: StudentRow | null = null;
  if (payload.studentId) {
    student = await resolveStudentForRequest(supabase, payload.studentId);
  } else if (isStudent) {
    student = await resolveStudentForStudentRole(supabase, profile, authUserId);
  }

  if (payload.studentId && !student && payload.useTeacherContext && !isStudent) {
    throw new Error('Requested student record was not found');
  }

  if (student) {
    if (isParent) {
      const linked = await isParentLinkedToStudent(supabase, profile.id, student.id);
      if (!linked) {
        throw new Error('Parent can only generate exams for linked children');
      }
    }

    if (isStudent) {
      const matchesSelf =
        student.id === profile.id ||
        student.student_id === profile.id ||
        student.student_id === authUserId;

      if (!matchesSelf && payload.studentId) {
        throw new Error('Student can only generate for self');
      }
    }

    if (isStaff && !isSuperAdmin) {
      const studentOrg = student.organization_id || student.preschool_id || null;
      if (profileOrgId && studentOrg && profileOrgId !== studentOrg) {
        throw new Error('Staff can only access students in their own school scope');
      }
    }
  } else if (isParent && payload.useTeacherContext) {
    throw new Error('A linked learner is required to use teacher artifact context');
  }

  const studentOrgId = student?.organization_id || student?.preschool_id || null;

  let effectiveSchoolId = payload.schoolId || studentOrgId || profileOrgId || null;
  if (payload.schoolId) {
    if (studentOrgId && payload.schoolId !== studentOrgId) {
      throw new Error('Requested school scope does not match learner scope');
    }

    if (!studentOrgId && isStaff && !isSuperAdmin && profileOrgId && payload.schoolId !== profileOrgId) {
      throw new Error('Requested school scope is outside staff access');
    }
  }

  let effectiveClassId = payload.classId || student?.class_id || null;
  if (student?.class_id) {
    effectiveClassId = student.class_id;
  }

  if (!effectiveClassId && payload.useTeacherContext && (isParent || isStudent)) {
    // Teacher context can still run with school scope only, but this is a useful guardrail.
    console.warn('[generate-exam] teacher context running without class scope', {
      role,
      studentId: student?.id,
    });
  }

  if (isStaff && effectiveClassId && !isSuperAdmin && profileOrgId) {
    const { data: klass } = await supabase
      .from('classes')
      .select('id, preschool_id, organization_id')
      .eq('id', effectiveClassId)
      .maybeSingle();

    if (!klass) {
      throw new Error('Requested class was not found');
    }

    const classOrg = klass.organization_id || klass.preschool_id || null;
    if (classOrg && classOrg !== profileOrgId) {
      throw new Error('Requested class is outside staff school scope');
    }

    if (!effectiveSchoolId) {
      effectiveSchoolId = classOrg;
    }
  }

  return {
    profile,
    role,
    student,
    effectiveClassId,
    effectiveSchoolId,
    effectiveStudentId: student?.id || null,
  };
}

function addWeightedTopic(map: Map<string, number>, topic: string | null | undefined, weight: number) {
  const clean = sanitizeTopic(topic);
  if (!clean) return;

  const key = clean.toLowerCase();
  const previous = map.get(key) || 0;
  map.set(key, previous + weight);
}

function hydrateFocusFromMetadata(map: Map<string, number>, metadata: unknown, fallbackTitle: string | null, fallbackWeight: number) {
  if (!metadata || typeof metadata !== 'object') {
    addWeightedTopic(map, fallbackTitle, fallbackWeight);
    return;
  }

  const record = metadata as Record<string, unknown>;
  const topics = Array.isArray(record.topics)
    ? record.topics
    : Array.isArray(record.focus_topics)
    ? record.focus_topics
    : null;

  if (topics && topics.length > 0) {
    topics.forEach((item) => addWeightedTopic(map, String(item || ''), 4));
    return;
  }

  addWeightedTopic(map, fallbackTitle, fallbackWeight);
}

async function resolveTeacherContext(
  supabase: ReturnType<typeof createClient>,
  scope: AuthorizedRequestScope,
  payload: {
    subject: string;
    useTeacherContext: boolean;
    lookbackDays: number;
  },
): Promise<ExamContextSummary> {
  const emptySummary: ExamContextSummary = {
    assignmentCount: 0,
    lessonCount: 0,
    focusTopics: [],
    weakTopics: [],
    sourceAssignmentIds: [],
    sourceLessonIds: [],
  };

  if (!payload.useTeacherContext) return emptySummary;

  const now = Date.now();
  const lookbackMs = now - payload.lookbackDays * 24 * 60 * 60 * 1000;

  let homeworkQuery = supabase
    .from('homework_assignments')
    .select('id, title, subject, instructions, description, metadata, due_date, created_at, assigned_at, class_id, lesson_id, is_published, is_active, status, preschool_id')
    .order('created_at', { ascending: false })
    .limit(150);

  if (scope.effectiveClassId) {
    homeworkQuery = homeworkQuery.eq('class_id', scope.effectiveClassId);
  }

  if (scope.effectiveSchoolId) {
    homeworkQuery = homeworkQuery.eq('preschool_id', scope.effectiveSchoolId);
  }

  const { data: homeworkRowsRaw, error: homeworkError } = await homeworkQuery;
  if (homeworkError) {
    console.warn('[generate-exam] homework context query failed', homeworkError.message);
  }

  const homeworkRows = ((homeworkRowsRaw || []) as HomeworkRow[])
    .filter((row) => {
      if (!matchesSubject(row.subject || row.title || row.description, payload.subject)) return false;
      if (!isRecent(row, lookbackMs)) return false;

      const status = String(row.status || '').toLowerCase();
      const published = row.is_published === true || row.is_active === true;
      const statusActive = ['published', 'active', 'assigned', 'open', 'ongoing'].includes(status);
      return published || statusActive;
    })
    .slice(0, 40);

  const assignmentIds = homeworkRows.map((row) => row.id);

  let submissionRows: HomeworkSubmissionRow[] = [];
  if (scope.effectiveStudentId && assignmentIds.length > 0) {
    let submissionQuery = supabase
      .from('homework_submissions')
      .select('assignment_id, homework_assignment_id, grade, feedback, ai_feedback, status, submitted_at')
      .eq('student_id', scope.effectiveStudentId)
      .in('assignment_id', assignmentIds)
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (scope.effectiveSchoolId) {
      submissionQuery = submissionQuery.eq('preschool_id', scope.effectiveSchoolId);
    }

    const { data: submissionData, error: submissionError } = await submissionQuery;
    if (submissionError) {
      console.warn('[generate-exam] submission context query failed', submissionError.message);
    } else {
      submissionRows = (submissionData || []) as HomeworkSubmissionRow[];
    }
  }

  let lessonQuery = supabase
    .from('lesson_assignments')
    .select('id, lesson_id, due_date, assigned_at, status, class_id, student_id, preschool_id, notes, lessons(id, title, subject, objectives, content, description)')
    .order('assigned_at', { ascending: false })
    .limit(150);

  if (scope.effectiveClassId) {
    lessonQuery = lessonQuery.eq('class_id', scope.effectiveClassId);
  } else if (scope.effectiveStudentId) {
    lessonQuery = lessonQuery.eq('student_id', scope.effectiveStudentId);
  }

  if (scope.effectiveSchoolId) {
    lessonQuery = lessonQuery.eq('preschool_id', scope.effectiveSchoolId);
  }

  const { data: lessonRowsRaw, error: lessonError } = await lessonQuery;
  if (lessonError) {
    console.warn('[generate-exam] lesson context query failed', lessonError.message);
  }

  const lessonRows = ((lessonRowsRaw || []) as LessonAssignmentRow[])
    .filter((row) => {
      if (!isRecent(row, lookbackMs)) return false;
      const status = String(row.status || '').toLowerCase();
      const active = ['assigned', 'published', 'active', 'completed', 'in_progress'].includes(status) || !status;
      if (!active) return false;

      const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
      if (!lesson) return false;
      return matchesSubject(lesson.subject || lesson.title || lesson.description || row.notes, payload.subject);
    })
    .slice(0, 40);

  const focusMap = new Map<string, number>();
  const weakMap = new Map<string, number>();

  const assignmentById = new Map<string, HomeworkRow>();
  homeworkRows.forEach((assignment) => {
    assignmentById.set(assignment.id, assignment);
    addWeightedTopic(focusMap, assignment.title, 5);
    addWeightedTopic(focusMap, assignment.subject, 3);
    hydrateFocusFromMetadata(focusMap, assignment.metadata, assignment.title, 3);
  });

  lessonRows.forEach((assignment) => {
    const lesson = Array.isArray(assignment.lessons) ? assignment.lessons[0] : assignment.lessons;
    if (!lesson) return;
    addWeightedTopic(focusMap, lesson.title, 4);
    addWeightedTopic(focusMap, lesson.subject, 2);
    if (Array.isArray(lesson.objectives)) {
      lesson.objectives.forEach((objective) => addWeightedTopic(focusMap, objective, 3));
    }
  });

  submissionRows.forEach((submission) => {
    const grade = Number(submission.grade ?? NaN);
    const sourceId = submission.assignment_id || submission.homework_assignment_id || '';
    const linkedAssignment = assignmentById.get(sourceId);

    if (Number.isFinite(grade) && grade < 60) {
      addWeightedTopic(weakMap, linkedAssignment?.title || linkedAssignment?.subject || null, 4);
    }

    const status = String(submission.status || '').toLowerCase();
    if (status.includes('late') || status.includes('missing')) {
      addWeightedTopic(weakMap, linkedAssignment?.title || linkedAssignment?.subject || null, 2);
    }
  });

  const lessonIds = lessonRows
    .map((item) => {
      const lesson = Array.isArray(item.lessons) ? item.lessons[0] : item.lessons;
      return lesson?.id || item.lesson_id || item.id;
    })
    .filter((value): value is string => Boolean(value));

  return {
    assignmentCount: assignmentIds.length,
    lessonCount: lessonIds.length,
    focusTopics: pickTopTopics(focusMap, 8),
    weakTopics: pickTopTopics(weakMap, 6),
    sourceAssignmentIds: assignmentIds,
    sourceLessonIds: lessonIds,
  };
}

function buildUserPrompt(payload: {
  grade: string;
  subject: string;
  examType: string;
  language: string;
  customPrompt?: string;
  contextSummary: ExamContextSummary;
  useTeacherContext: boolean;
}) {
  const base = [
    `Generate a ${payload.examType} exam for ${payload.grade}.`,
    `Subject: ${payload.subject}.`,
    `Language: ${payload.language}.`,
    'Align strictly to CAPS/DBE outcomes and cognitive level for this grade.',
    'Include a balanced progression from foundational to challenging items.',
  ];

  if (payload.useTeacherContext) {
    const focus = payload.contextSummary.focusTopics.length > 0
      ? payload.contextSummary.focusTopics.join(', ')
      : 'No explicit focus topics available';
    const weak = payload.contextSummary.weakTopics.length > 0
      ? payload.contextSummary.weakTopics.join(', ')
      : 'No weak-topic signals available';

    base.push(
      `Teacher artifacts discovered: ${payload.contextSummary.assignmentCount} assignments and ${payload.contextSummary.lessonCount} lessons.`,
      `Prioritize these taught/assigned focus topics: ${focus}.`,
      `Reinforce these weak topics with scaffolded questions: ${weak}.`,
      'Weight about 70% of marks to taught artifacts and 30% to broader CAPS mastery checks.',
    );
  } else {
    base.push('Teacher artifact context is disabled. Build from CAPS baseline only.');
  }

  if (payload.customPrompt) {
    base.push(`Additional instructions: ${payload.customPrompt}`);
  }

  base.push('Return only strict JSON matching the required schema.');

  return base.join('\n');
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid session' }, 401, corsHeaders);
    }

    const body = await req.json();
    const grade = String(body?.grade || '').trim();
    const subject = String(body?.subject || '').trim();
    const examType = String(body?.examType || 'practice_test').trim();
    const customPrompt = body?.customPrompt ? String(body.customPrompt) : undefined;
    const modelOverride = body?.model ? String(body.model) : undefined;
    const language = body?.language ? String(body.language) : 'en-ZA';
    const studentId = body?.studentId ? String(body.studentId) : undefined;
    const classId = body?.classId ? String(body.classId) : undefined;
    const schoolId = body?.schoolId ? String(body.schoolId) : undefined;
    const useTeacherContext = body?.useTeacherContext !== false;
    const previewContext = body?.previewContext === true;
    const lookbackDays = Number.isFinite(Number(body?.lookbackDays))
      ? Math.max(7, Math.min(180, Number(body.lookbackDays)))
      : 45;

    if (!grade || !subject) {
      return jsonResponse({ error: 'Missing required fields: grade, subject' }, 400, corsHeaders);
    }

    const scope = await resolveAuthorizedScope(supabase, user.id, {
      studentId,
      classId,
      schoolId,
      useTeacherContext,
    });

    const contextSummary = await resolveTeacherContext(supabase, scope, {
      subject,
      useTeacherContext,
      lookbackDays,
    });

    if (previewContext) {
      return jsonResponse(
        {
          success: true,
          examId: 'preview-only',
          contextSummary,
        },
        200,
        corsHeaders,
      );
    }

    if (!ANTHROPIC_API_KEY) {
      throw new Error('AI service not configured');
    }

    const { data: tierData } = await supabase.rpc('get_user_subscription_tier', {
      user_id: scope.profile.id,
    });

    const model = modelOverride || getDefaultModelForTier(typeof tierData === 'string' ? tierData : null);

    const userPrompt = buildUserPrompt({
      grade,
      subject,
      examType,
      language,
      customPrompt,
      contextSummary,
      useTeacherContext,
    });

    console.log('[generate-exam] generating', {
      grade,
      subject,
      examType,
      userId: user.id,
      profileId: scope.profile.id,
      model,
      useTeacherContext,
      assignmentCount: contextSummary.assignmentCount,
      lessonCount: contextSummary.lessonCount,
    });

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: EXAM_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[generate-exam] AI API error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        throw new Error('AI service is busy. Please try again in a moment.');
      }
      throw new Error('Failed to generate exam content');
    }

    const aiData = await aiResponse.json();
    const content = String(aiData?.content?.[0]?.text || '');

    let parsedRawExam: any;
    try {
      parsedRawExam = JSON.parse(extractJsonBlock(content));
    } catch (parseError) {
      console.error('[generate-exam] parse error', parseError);
      throw new Error('Failed to parse generated exam JSON. Please retry.');
    }

    const normalizedExam = normalizeExamShape(parsedRawExam, grade, subject, examType);
    if (!normalizedExam.sections.length || !normalizedExam.sections.some((section: any) => section.questions.length > 0)) {
      throw new Error('Generated exam has no valid questions. Please retry.');
    }

    const metadata = {
      source: useTeacherContext ? 'teacher_artifact_context' : 'caps_baseline',
      contextSummary,
      caps: {
        aligned: true,
        framework: 'CAPS/DBE',
        lookbackDays,
        language,
      },
    };

    let persistedExamId = `temp-${Date.now()}`;
    let persistenceWarning: string | undefined;

    const { data: savedExam, error: saveError } = await supabase
      .from('exam_generations')
      .insert({
        user_id: scope.profile.id,
        grade,
        subject,
        exam_type: examType,
        display_title: normalizedExam.title,
        generated_content: JSON.stringify(normalizedExam),
        status: 'generated',
        model_used: model,
        metadata,
      })
      .select('id')
      .single();

    if (saveError) {
      console.warn('[generate-exam] Could not persist exam_generations row', saveError.message);
      persistenceWarning = 'Exam generated, but cloud save failed. You can still continue with this attempt.';
    } else if (savedExam?.id) {
      persistedExamId = String(savedExam.id);
    }

    return jsonResponse(
      {
        success: true,
        exam: normalizedExam,
        examId: persistedExamId,
        contextSummary,
        persistenceWarning,
      },
      200,
      corsHeaders,
    );
  } catch (err) {
    console.error('[generate-exam] Error:', err);
    return jsonResponse(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      500,
      corsHeaders,
    );
  }
});
