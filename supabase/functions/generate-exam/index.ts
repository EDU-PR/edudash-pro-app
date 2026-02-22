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
const OPENAI_API_KEY =
  Deno.env.get('OPENAI_API_KEY') ||
  Deno.env.get('SERVER_OPENAI_API_KEY') ||
  Deno.env.get('OPENAI_API_KEY_2') ||
  '';
const OPENAI_EXAM_MODEL = Deno.env.get('OPENAI_EXAM_MODEL') || 'gpt-4o-mini';

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
  subscription_tier: string | null;
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
  intentTaggedCount?: number;
};

type ExamTeacherAlignmentSummary = {
  assignmentCount: number;
  lessonCount: number;
  intentTaggedCount: number;
  coverageScore: number;
};

type ExamBlueprintAudit = {
  minQuestions: number;
  maxQuestions: number;
  actualQuestions: number;
  totalMarks: number;
  objectiveMarks: number;
  shortMarks: number;
  extendedMarks: number;
  objectiveRatio: number;
  shortRatio: number;
  extendedRatio: number;
};

type StudyCoachDayPlan = {
  day: string;
  focus: string;
  readingPiece: string;
  paperWritingDrill: string;
  memoryActivity: string;
  parentTip: string;
};

type StudyCoachPack = {
  mode: 'guided_first';
  planTitle: string;
  days: StudyCoachDayPlan[];
  testDayChecklist: string[];
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

function normalizeTierForExamRole(role: string, profileTier: string | null, resolvedTier: string | null): string {
  const normalizedRole = String(role || '').toLowerCase();
  const normalizedProfileTier = String(profileTier || 'free').toLowerCase();
  const normalizedResolvedTier = String(resolvedTier || 'free').toLowerCase();

  if (normalizedRole === 'super_admin') return 'enterprise';

  // Parents/students must use personal tier only (do not inherit school enterprise plans).
  if (PARENT_ROLES.has(normalizedRole) || STUDENT_ROLES.has(normalizedRole)) {
    return normalizedProfileTier || 'free';
  }

  return normalizedResolvedTier || normalizedProfileTier || 'free';
}

function buildModelFallbackChain(preferredModel: string): string[] {
  const ordered = [
    preferredModel,
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-haiku-20240307',
  ];
  return [...new Set(ordered.filter(Boolean))];
}

function isCreditOrBillingError(status: number, responseText: string): boolean {
  const text = String(responseText || '').toLowerCase();
  if (status === 402) return true;
  return (
    text.includes('credit balance is too low') ||
    text.includes('insufficient credits') ||
    text.includes('insufficient_quota') ||
    text.includes('quota') && text.includes('exceeded') ||
    text.includes('billing')
  );
}

function buildLocalFallbackExam(
  grade: string,
  subject: string,
  examType: string,
  contextSummary: ExamContextSummary,
) {
  const focusTopics = contextSummary.focusTopics.length > 0
    ? contextSummary.focusTopics.slice(0, 6)
    : [
        `${subject} fundamentals`,
        `core ${subject} concepts`,
        `problem solving in ${subject}`,
      ];

  const weakTopics = contextSummary.weakTopics.slice(0, 3);
  const revisionTopics = [...new Set([...weakTopics, ...focusTopics])].slice(0, 6);

  const sectionAQuestions = focusTopics.slice(0, 6).map((topic, index) => ({
    id: `A${index + 1}`,
    type: 'multiple_choice',
    marks: 2,
    question: `Which option best matches a correct CAPS-level understanding of ${topic} in ${subject}?`,
    options: [
      `A basic fact without clear reasoning`,
      `A concept explained with correct terms and a clear example`,
      `An unrelated idea from another topic`,
      `A guess without subject vocabulary`,
    ],
    correctAnswer: 'B',
    explanation: `A strong CAPS-aligned answer should include accurate terminology and an example tied to ${topic}.`,
  }));

  const sectionBQuestions = revisionTopics.map((topic, index) => ({
    id: `B${index + 1}`,
    type: 'short_answer',
    marks: 3,
    question: `Write a short answer explaining one key idea about ${topic} and how it applies in ${subject}.`,
    correctAnswer: `A valid answer should define ${topic}, include one correct subject example, and use grade-appropriate vocabulary.`,
    explanation: `Use one definition, one worked/contextual example, and one sentence linking the idea back to ${subject}.`,
  }));

  return {
    title: `${subject} ${examType.replace(/_/g, ' ')} (Fallback)`,
    grade,
    subject,
    duration: '60 minutes',
    totalMarks: 30,
    sections: [
      {
        name: 'Section A: Multiple Choice',
        questions: sectionAQuestions,
      },
      {
        name: 'Section B: Short Answers',
        questions: sectionBQuestions,
      },
    ],
  };
}

function parseGradeNumber(grade: string): number {
  const normalized = String(grade || '').toLowerCase().trim();
  if (!normalized) return 6;
  if (normalized === 'grade_r' || normalized === 'grader' || normalized === 'r') return 0;
  const match = normalized.match(/grade[_\s-]*(\d{1,2})/);
  if (match?.[1]) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) return value;
  }
  return 6;
}

function getQuestionCountPolicy(grade: string, examType: string): { min: number; max: number } {
  const level = parseGradeNumber(grade);
  const type = String(examType || 'practice_test').toLowerCase();

  if (type === 'practice_test') {
    if (level >= 10) return { min: 28, max: 40 };
    if (level >= 7) return { min: 22, max: 30 };
    if (level >= 4) return { min: 20, max: 24 };
    return { min: 12, max: 18 };
  }

  if (type === 'flashcards') {
    if (level >= 10) return { min: 20, max: 32 };
    if (level >= 7) return { min: 16, max: 24 };
    return { min: 12, max: 18 };
  }

  if (type === 'study_guide') {
    if (level >= 10) return { min: 12, max: 20 };
    return { min: 8, max: 14 };
  }

  if (type === 'revision_notes') {
    if (level >= 10) return { min: 14, max: 24 };
    if (level >= 7) return { min: 12, max: 20 };
    return { min: 10, max: 16 };
  }

  return { min: 12, max: 20 };
}

function getMinimumQuestionCount(grade: string, examType: string): number {
  return getQuestionCountPolicy(grade, examType).min;
}

function buildSupplementQuestion(
  index: number,
  subject: string,
  topic: string,
): {
  id: string;
  question: string;
  text: string;
  type: string;
  marks: number;
  options?: string[];
  correctAnswer: string;
  explanation: string;
} {
  const slot = index % 4;
  const safeTopic = sanitizeTopic(topic) || `${subject} concept`;

  if (slot === 0) {
    const question = `Which statement best describes ${safeTopic} in ${subject}?`;
    return {
      id: `q_auto_${index + 1}`,
      question,
      text: question,
      type: 'multiple_choice',
      marks: 2,
      options: [
        'A fact that is unrelated to the topic',
        'A concept explained with correct vocabulary and context',
        'A random guess with no evidence',
        'A misconception from another topic',
      ],
      correctAnswer: 'B',
      explanation: `The best answer uses correct subject terminology and applies it directly to ${safeTopic}.`,
    };
  }

  if (slot === 1) {
    const question = `${safeTopic} is always applied without checking context.`;
    return {
      id: `q_auto_${index + 1}`,
      question,
      text: question,
      type: 'true_false',
      marks: 2,
      options: ['True', 'False'],
      correctAnswer: 'False',
      explanation: `In ${subject}, learners must apply ${safeTopic} using context and reasoned steps.`,
    };
  }

  if (slot === 2) {
    const question = `Fill in the blank: A key idea in ${safeTopic} is ________.`;
    return {
      id: `q_auto_${index + 1}`,
      question,
      text: question,
      type: 'fill_in_blank',
      marks: 2,
      correctAnswer: `${safeTopic}`,
      explanation: `A valid answer identifies a core concept related to ${safeTopic} using grade-appropriate language.`,
    };
  }

  const question = `Write a short response showing how ${safeTopic} can be used to solve a problem in ${subject}.`;
  return {
    id: `q_auto_${index + 1}`,
    question,
    text: question,
    type: 'short_answer',
    marks: 3,
    correctAnswer: `A complete answer should define ${safeTopic}, apply it correctly, and justify the result with one clear example.`,
    explanation: `Use one definition, one correct example, and one reason why the method works.`,
  };
}

function recalculateExamMarks(exam: any) {
  const sections = Array.isArray(exam?.sections) ? exam.sections : [];
  let totalMarks = 0;

  sections.forEach((section: any) => {
    const sectionQuestions = Array.isArray(section?.questions) ? section.questions : [];
    const sectionMarks = sectionQuestions.reduce((sum: number, question: any) => {
      const marks = Number(question?.marks ?? question?.points ?? 1);
      return sum + (Number.isFinite(marks) ? Math.max(1, marks) : 1);
    }, 0);

    section.totalMarks = sectionMarks;
    totalMarks += sectionMarks;
  });

  exam.totalMarks = totalMarks;
  return exam;
}

function ensureMinimumQuestionCoverage(
  exam: any,
  payload: {
    grade: string;
    subject: string;
    examType: string;
    contextSummary: ExamContextSummary;
    minQuestionCount?: number;
  },
) {
  const minQuestions = Number.isFinite(Number(payload.minQuestionCount))
    ? Math.max(1, Number(payload.minQuestionCount))
    : getMinimumQuestionCount(payload.grade, payload.examType);
  const sections = Array.isArray(exam?.sections)
    ? exam.sections.filter((section: any) => section && Array.isArray(section.questions))
    : [];

  if (sections.length === 0) return exam;

  const currentQuestionCount = sections.reduce(
    (sum: number, section: any) => sum + section.questions.length,
    0,
  );

  if (currentQuestionCount >= minQuestions) {
    return recalculateExamMarks(exam);
  }

  const needed = minQuestions - currentQuestionCount;
  const topics = [
    ...payload.contextSummary.weakTopics,
    ...payload.contextSummary.focusTopics,
    `${payload.subject} fundamentals`,
    `${payload.subject} applications`,
    `${payload.subject} problem solving`,
  ].filter((topic) => sanitizeTopic(topic));

  const topicPool = topics.length > 0 ? topics : [payload.subject];

  let supplementSection = sections.find((section: any) =>
    normalizeText(String(section?.name || section?.title || '')).includes('extended practice'),
  );

  if (!supplementSection) {
    supplementSection = {
      id: `section_${sections.length + 1}`,
      name: 'Section C: Extended Practice',
      title: 'Section C: Extended Practice',
      questions: [],
      totalMarks: 0,
    };
    sections.push(supplementSection);
    exam.sections = sections;
  }

  for (let i = 0; i < needed; i += 1) {
    const topic = String(topicPool[i % topicPool.length] || payload.subject);
    supplementSection.questions.push(
      buildSupplementQuestion(currentQuestionCount + i, payload.subject, topic),
    );
  }

  return recalculateExamMarks(exam);
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
        ? [...new Set(
            question.options
              .map((item: unknown) =>
                String(item || '')
                  .replace(/^(?:\s*[A-D]\s*[\.\)\-:]\s*)+/i, '')
                  .trim(),
              )
              .filter((item: string) => item.length > 0),
          )]
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
        visual:
          question?.visual && typeof question.visual === 'object'
            ? question.visual
            : undefined,
      };
    });

    const sectionMarks = normalizedQuestions.reduce((sum: number, question: any) => sum + Number(question.marks || 0), 0);

    return {
      id: String(section?.id || `section_${sectionIndex + 1}`),
      name: String(section?.name || section?.title || `Section ${sectionIndex + 1}`),
      title: String(section?.title || section?.name || `Section ${sectionIndex + 1}`),
      instructions: String(section?.instructions || '').trim() || undefined,
      readingPassage:
        String(section?.readingPassage || section?.reading_passage || '').trim() || undefined,
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

function countQuestions(exam: any): number {
  const sections = Array.isArray(exam?.sections) ? exam.sections : [];
  return sections.reduce(
    (sum: number, section: any) => sum + (Array.isArray(section?.questions) ? section.questions.length : 0),
    0,
  );
}

function enforceQuestionUpperBound(exam: any, maxQuestions: number) {
  if (!Number.isFinite(maxQuestions) || maxQuestions <= 0) return exam;
  let remaining = countQuestions(exam) - maxQuestions;
  if (remaining <= 0) return exam;

  const sections = Array.isArray(exam?.sections) ? exam.sections : [];
  for (let i = sections.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const questions = Array.isArray(sections[i]?.questions) ? sections[i].questions : [];
    if (questions.length === 0) continue;

    const cutCount = Math.min(remaining, Math.max(0, questions.length - 1));
    if (cutCount > 0) {
      sections[i].questions = questions.slice(0, questions.length - cutCount);
      remaining -= cutCount;
    }
  }

  if (remaining > 0) {
    for (let i = sections.length - 1; i >= 0 && remaining > 0; i -= 1) {
      const questions = Array.isArray(sections[i]?.questions) ? sections[i].questions : [];
      if (questions.length === 0) continue;
      const cutCount = Math.min(remaining, questions.length);
      sections[i].questions = questions.slice(0, Math.max(0, questions.length - cutCount));
      remaining -= cutCount;
    }
  }

  return recalculateExamMarks(exam);
}

function isLanguageSubject(subject: string): boolean {
  const normalized = normalizeText(subject);
  return (
    normalized.includes('language') ||
    normalized.includes('english') ||
    normalized.includes('afrikaans') ||
    normalized.includes('isizulu') ||
    normalized.includes('isixhosa') ||
    normalized.includes('sepedi')
  );
}

function ensureLanguageReadingPassage(exam: any, subject: string, grade: string, language: string) {
  if (!isLanguageSubject(subject)) return exam;

  const sections = Array.isArray(exam?.sections) ? exam.sections : [];
  if (sections.length === 0) return exam;

  const first = sections[0];
  const sectionTitle = normalizeText(first?.title || first?.name || '');
  const needsPassage =
    sectionTitle.includes('lees') ||
    sectionTitle.includes('read') ||
    sectionTitle.includes('comprehension') ||
    sectionTitle.includes('begrip') ||
    sections.some((section: any) => normalizeText(section?.title || '').includes('lees')) ||
    sections.some((section: any) => normalizeText(section?.title || '').includes('read'));

  if (!needsPassage) return exam;

  const existingPassage = String(first?.readingPassage || first?.reading_passage || first?.instructions || '').trim();
  if (existingPassage.length >= 120) return exam;

  first.readingPassage = `Lees die storie hieronder en beantwoord die vrae wat volg.

Mia en haar broer, Tumi, het Saterdag vroeg op hul oupa se plaas gaan help. Hulle het eers die hoenders gevoer, daarna groente geplant en later saam met Oupa die kraal skoongemaak. Teen die middag het dit begin reën, maar hulle het onder die stoep gesit en stories geluister. Voor hulle huis toe is, het Ouma vir hulle warm sop gegee en almal het saam gelag.

Read the passage carefully and answer in ${language}.`;

  first.instructions = `Grade: ${grade}. Read the passage first, then answer with full meaning and context clues.`;
  return exam;
}

function computeBlueprintAudit(exam: any, grade: string, examType: string): ExamBlueprintAudit {
  const policy = getQuestionCountPolicy(grade, examType);
  const sections = Array.isArray(exam?.sections) ? exam.sections : [];
  let objectiveMarks = 0;
  let shortMarks = 0;
  let extendedMarks = 0;

  sections.forEach((section: any) => {
    const questions = Array.isArray(section?.questions) ? section.questions : [];
    questions.forEach((question: any) => {
      const marks = Number(question?.marks ?? 1);
      const safeMarks = Number.isFinite(marks) ? Math.max(1, marks) : 1;
      const type = normalizeQuestionType(question?.type);
      if (type === 'multiple_choice' || type === 'true_false' || type === 'fill_in_blank') {
        objectiveMarks += safeMarks;
      } else if (type === 'short_answer') {
        shortMarks += safeMarks;
      } else {
        extendedMarks += safeMarks;
      }
    });
  });

  const totalMarks = Number(exam?.totalMarks || objectiveMarks + shortMarks + extendedMarks || 1);
  const actualQuestions = countQuestions(exam);
  const denominator = totalMarks > 0 ? totalMarks : 1;

  return {
    minQuestions: policy.min,
    maxQuestions: policy.max,
    actualQuestions,
    totalMarks,
    objectiveMarks,
    shortMarks,
    extendedMarks,
    objectiveRatio: Number((objectiveMarks / denominator).toFixed(3)),
    shortRatio: Number((shortMarks / denominator).toFixed(3)),
    extendedRatio: Number((extendedMarks / denominator).toFixed(3)),
  };
}

function computeTeacherAlignmentSummary(contextSummary: ExamContextSummary): ExamTeacherAlignmentSummary {
  const intentTaggedCount = Number(contextSummary.intentTaggedCount || 0);
  const taughtSignals = contextSummary.assignmentCount + contextSummary.lessonCount + intentTaggedCount;
  const weakSignals = contextSummary.weakTopics.length;
  const coverageScore = Math.max(
    0,
    Math.min(100, Math.round((taughtSignals / Math.max(1, taughtSignals + weakSignals)) * 100)),
  );

  return {
    assignmentCount: contextSummary.assignmentCount,
    lessonCount: contextSummary.lessonCount,
    intentTaggedCount,
    coverageScore,
  };
}

function buildStudyCoachPack(
  grade: string,
  subject: string,
  language: string,
  contextSummary: ExamContextSummary,
): StudyCoachPack {
  const focus = contextSummary.focusTopics.length > 0
    ? contextSummary.focusTopics
    : [`${subject} foundations`, `${subject} problem solving`, `${subject} vocabulary`];

  const days: StudyCoachDayPlan[] = [
    {
      day: 'Day 1',
      focus: `Understand core concepts: ${focus[0] || subject}`,
      readingPiece: `Read a short ${subject} passage and underline 5 key words. Summarize it in 5 sentences in ${language}.`,
      paperWritingDrill: 'Write definitions by hand, then explain one example in your own words.',
      memoryActivity: 'Use 10-minute active recall: close notes and write everything remembered.',
      parentTip: 'Ask the learner to teach you the concept in 2 minutes.',
    },
    {
      day: 'Day 2',
      focus: `Practice with guided questions: ${focus[1] || subject}`,
      readingPiece: 'Read one worked example slowly and identify each solving step.',
      paperWritingDrill: 'Do 8 mixed questions on paper with full working.',
      memoryActivity: 'Create 6 flash cards and self-test twice (morning/evening).',
      parentTip: 'Check if steps are written clearly, not only final answers.',
    },
    {
      day: 'Day 3',
      focus: `Fix weak areas: ${contextSummary.weakTopics[0] || focus[2] || subject}`,
      readingPiece: 'Read a short explanatory text and answer 4 comprehension prompts.',
      paperWritingDrill: 'Write one paragraph explaining a common mistake and how to avoid it.',
      memoryActivity: 'Spaced recall block: 5-5-5 minute review (now, later, before sleep).',
      parentTip: 'Encourage corrections in a different pen color to build reflection.',
    },
    {
      day: 'Day 4',
      focus: 'Timed exam rehearsal',
      readingPiece: 'Skim instructions first, then read questions in order of confidence.',
      paperWritingDrill: 'Complete a timed mini paper and mark with memo hints.',
      memoryActivity: 'Rapid retrieval: list formulas/keywords without notes in 3 minutes.',
      parentTip: 'Simulate a calm test environment with no interruptions.',
    },
  ];

  return {
    mode: 'guided_first',
    planTitle: `${grade} ${subject} - 4 Day Study Coach + Test Day`,
    days,
    testDayChecklist: [
      'Sleep early and review only summary notes.',
      'Start with easiest section to build confidence.',
      'Show full working and label answers clearly.',
      'Leave 10 minutes to review skipped or uncertain questions.',
    ],
  };
}

function augmentQuestionVisuals(exam: any, visualMode: 'off' | 'hybrid') {
  if (visualMode !== 'hybrid') return exam;
  const sections = Array.isArray(exam?.sections) ? exam.sections : [];

  sections.forEach((section: any) => {
    const questions = Array.isArray(section?.questions) ? section.questions : [];
    questions.forEach((question: any) => {
      const text = normalizeText(question?.question || question?.text || '');
      if (!text) return;

      if (question?.visual) return;
      if (!(text.includes('diagram') || text.includes('graph') || text.includes('chart') || text.includes('table'))) {
        return;
      }

      question.visual = {
        mode: 'diagram',
        altText: `Supporting visual for question: ${String(question.question || '').slice(0, 90)}`,
        diagramSpec: {
          type: 'flow',
          title: 'Concept Flow',
          nodes: ['Input', 'Process', 'Output'],
          edges: [
            { from: 'Input', to: 'Process' },
            { from: 'Process', to: 'Output' },
          ],
        },
      };
    });
  });

  return exam;
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
    .select('id, role, organization_id, preschool_id, auth_user_id, subscription_tier')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (!byAuth.error && byAuth.data) {
    return byAuth.data as ProfileRow;
  }

  const byId = await supabase
    .from('profiles')
    .select('id, role, organization_id, preschool_id, auth_user_id, subscription_tier')
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
    examIntentMode: 'teacher_weighted' | 'caps_only';
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
  const intentTaggedIds = new Set<string>();

  const assignmentById = new Map<string, HomeworkRow>();
  homeworkRows.forEach((assignment) => {
    assignmentById.set(assignment.id, assignment);
    const metadata = assignment.metadata && typeof assignment.metadata === 'object'
      ? (assignment.metadata as Record<string, unknown>)
      : null;
    const isExamIntent =
      metadata?.is_test_relevant === true ||
      metadata?.exam_intent === true ||
      metadata?.test_relevant === true ||
      metadata?.priority_weight === 'high';

    if (isExamIntent) {
      intentTaggedIds.add(assignment.id);
    }

    const baseTitleWeight =
      payload.examIntentMode === 'teacher_weighted' && isExamIntent ? 8 : 5;
    addWeightedTopic(focusMap, assignment.title, baseTitleWeight);
    addWeightedTopic(focusMap, assignment.subject, 3);

    if (metadata && Array.isArray(metadata.caps_topics)) {
      metadata.caps_topics.forEach((topic) => addWeightedTopic(focusMap, String(topic || ''), 5));
    }

    hydrateFocusFromMetadata(
      focusMap,
      assignment.metadata,
      assignment.title,
      payload.examIntentMode === 'teacher_weighted' && isExamIntent ? 6 : 3,
    );
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
    intentTaggedCount: intentTaggedIds.size,
  };
}

/**
 * Returns CAPS-aligned subject-specific section structure instructions.
 * Used to ensure Dash generates exams in the same format as our reference designs.
 */
function getSubjectSectionStructure(subject: string, grade: string, examType: string): string | null {
  const s = normalizeText(subject);

  // Afrikaans (Home Language & First Additional)
  if (s.includes('afrikaans')) {
    return `SUBJECT-SPECIFIC STRUCTURE (Afrikaans - CAPS/DBE):
- Section A: Leesbegrip (Reading Comprehension) – include a short passage/story in section instructions, then comprehension questions. Target ~15 marks.
- Section B: Taalstrukture en -konvensies (Language Structures and Conventions) – grammar, punctuation, sentence structure. Target ~15 marks.
- Section C: Woordeskat (Vocabulary) – word meaning, synonyms, context, idioms. Target ~10 marks.
- Section D: Skryfwerk (Writing) – short written task (paragraph, letter, or descriptive piece). Target ~10 marks.
- Total ~50 marks, 60 minutes. Questions and passage in Afrikaans where appropriate. Provide correctAnswer and explanation for each question.`;
  }

  // English (Home Language & First Additional)
  if (s.includes('english')) {
    return `SUBJECT-SPECIFIC STRUCTURE (English - CAPS/DBE):
- Section A: Reading Comprehension – include a short passage/story in section instructions, then comprehension questions. Target ~15 marks.
- Section B: Language Structures and Conventions – grammar, punctuation, sentence structure. Target ~15 marks.
- Section C: Vocabulary – word meaning, synonyms, context, idioms. Target ~10 marks.
- Section D: Writing – short written task (paragraph, letter, or descriptive piece). Target ~10 marks.
- Total ~50 marks, 60 minutes. Provide correctAnswer and explanation for each question.`;
  }

  // isiZulu, isiXhosa, Sepedi (Home Language & First Additional)
  if (s.includes('isizulu') || s.includes('isixhosa') || s.includes('sepedi')) {
    const langName = s.includes('isizulu') ? 'isiZulu' : s.includes('isixhosa') ? 'isiXhosa' : 'Sepedi';
    return `SUBJECT-SPECIFIC STRUCTURE (${langName} - CAPS/DBE):
- Section A: Ukufunda nokuqonda / Ukuqonda okufundiweyo / Tlhaloso ya go bala (Reading Comprehension) – include a short passage/story in section instructions. Target ~15 marks.
- Section B: Izakhiwo zolimi / Iindlela zolimi / Dikopano tša polelo (Language Structures and Conventions) – grammar, punctuation. Target ~15 marks.
- Section C: Amagama / Amazwi / Mantšu (Vocabulary) – word meaning, context. Target ~10 marks.
- Section D: Ukubhala / Ukubhala / Go ngwala (Writing) – short written task. Target ~10 marks.
- Total ~50 marks, 60 minutes. Questions and passage in ${langName} where appropriate. Provide correctAnswer and explanation for each question.`;
  }

  // Mathematics & Mathematical Literacy
  if (s.includes('mathematic') && !s.includes('literacy')) {
    return `SUBJECT-SPECIFIC STRUCTURE (Mathematics - CAPS/DBE):
- Section A: Multiple Choice – short objective questions covering core topics. Target ~40% of marks.
- Section B: Short Questions – calculations, working must be shown. Target ~35% of marks.
- Section C: Problem Solving / Long Questions – multi-step problems, reasoning, proofs where applicable. Target ~25% of marks.
- Include mark allocation per question. Use age-appropriate cognitive level. Provide correctAnswer and explanation for each question.`;
  }
  if (s.includes('mathematical') && s.includes('literacy')) {
    return `SUBJECT-SPECIFIC STRUCTURE (Mathematical Literacy - CAPS/DBE):
- Section A: Multiple Choice – real-world contexts (budgets, maps, data). Target ~40% of marks.
- Section B: Short Questions – calculations in context. Target ~35% of marks.
- Section C: Long Questions – extended real-life scenarios. Target ~25% of marks.
- Use South African contexts. Provide correctAnswer and explanation for each question.`;
  }

  // Natural Sciences, Physical Sciences, Life Sciences
  if (s.includes('physical science') || s.includes('life science') || (s.includes('natural science') && !s.includes('technology'))) {
    const subj = s.includes('physical') ? 'Physical Sciences' : s.includes('life science') ? 'Life Sciences' : 'Natural Sciences';
    return `SUBJECT-SPECIFIC STRUCTURE (${subj} - CAPS/DBE):
- Section A: Multiple Choice – concepts, definitions, recall. Target ~40% of marks.
- Section B: Short Questions – calculations, diagrams, short explanations. Target ~35% of marks.
- Section C: Long Questions / Data Response – extended reasoning, experiments, data analysis. Target ~25% of marks.
- Include correctAnswer and explanation for each question. Use scientific terminology.`;
  }
  if (s.includes('natural science') && s.includes('technology')) {
    return `SUBJECT-SPECIFIC STRUCTURE (Natural Sciences & Technology - CAPS/DBE):
- Section A: Multiple Choice – science and technology concepts. Target ~40% of marks.
- Section B: Short Questions – practical applications, simple investigations. Target ~35% of marks.
- Section C: Design/Problem Solving – technology task or extended science question. Target ~25% of marks.
- Provide correctAnswer and explanation for each question.`;
  }

  // History
  if (s.includes('history')) {
    return `SUBJECT-SPECIFIC STRUCTURE (History - CAPS/DBE):
- Section A: Source-based Questions – analyse sources (text, image, map). Target ~50% of marks.
- Section B: Essay / Extended Writing – structured essay from given topics. Target ~50% of marks.
- Include source material in section instructions where applicable. Provide correctAnswer and explanation for each question.`;
  }

  // Geography
  if (s.includes('geography')) {
    return `SUBJECT-SPECIFIC STRUCTURE (Geography - CAPS/DBE):
- Section A: Map Work & Short Questions – map skills, calculations, short answers. Target ~45% of marks.
- Section B: Data Response & Essay – data interpretation, extended writing. Target ~55% of marks.
- Include map/data contexts. Provide correctAnswer and explanation for each question.`;
  }

  // Economic & Management Sciences (EMS - Senior Phase) - check before Economics
  if (s.includes('economic') && s.includes('management')) {
    return `SUBJECT-SPECIFIC STRUCTURE (Economic & Management Sciences - CAPS/DBE):
- Section A: Multiple Choice – EMS concepts. Target ~30% of marks.
- Section B: Short Questions – economy, entrepreneurship, accounting basics. Target ~40% of marks.
- Section C: Case / Extended – integrated EMS task. Target ~30% of marks.
- Provide correctAnswer and explanation for each question.`;
  }

  // Accounting
  if (s.includes('accounting')) {
    return `SUBJECT-SPECIFIC STRUCTURE (Accounting - CAPS/DBE):
- Section A: Multiple Choice – concepts, theory. Target ~25% of marks.
- Section B: Short Questions – calculations, ledger entries, ratios. Target ~40% of marks.
- Section C: Case Study / Long Questions – integrated tasks, financial statements. Target ~35% of marks.
- Provide correctAnswer and explanation for each question.`;
  }

  // Business Studies & Economics
  if (s.includes('business study') || s.includes('economic')) {
    const subj = s.includes('business') ? 'Business Studies' : 'Economics';
    return `SUBJECT-SPECIFIC STRUCTURE (${subj} - CAPS/DBE):
- Section A: Multiple Choice – concepts, definitions. Target ~30% of marks.
- Section B: Short Questions – case snippets, calculations. Target ~40% of marks.
- Section C: Essay / Extended – case study or essay. Target ~30% of marks.
- Use South African business/economic contexts. Provide correctAnswer and explanation for each question.`;
  }

  // Technology, CAT, IT
  if (s.includes('technology') || s.includes('computer application') || s.includes('information technology')) {
    const subj = s.includes('computer') ? 'Computer Applications Technology' : s.includes('information') ? 'Information Technology' : 'Technology';
    return `SUBJECT-SPECIFIC STRUCTURE (${subj} - CAPS/DBE):
- Section A: Multiple Choice – theory, terminology, concepts. Target ~40% of marks.
- Section B: Short Questions – practical applications, problem solving. Target ~35% of marks.
- Section C: Extended / Scenario – real-world task or project-type question. Target ~25% of marks.
- Provide correctAnswer and explanation for each question.`;
  }

  // Life Orientation & Life Skills
  if (s.includes('life orientation') || s.includes('life skill')) {
    const subj = s.includes('orientation') ? 'Life Orientation' : 'Life Skills';
    return `SUBJECT-SPECIFIC STRUCTURE (${subj} - CAPS/DBE):
- Section A: Multiple Choice – development, health, citizenship, study skills. Target ~40% of marks.
- Section B: Short Questions – scenario-based, reflective. Target ~35% of marks.
- Section C: Extended – project-type or essay on life skills topics. Target ~25% of marks.
- Use age-appropriate, inclusive contexts. Provide correctAnswer and explanation for each question.`;
  }

  // Creative Arts
  if (s.includes('creative art')) {
    return `SUBJECT-SPECIFIC STRUCTURE (Creative Arts - CAPS/DBE):
- Section A: Multiple Choice – art forms, terminology, theory. Target ~40% of marks.
- Section B: Short Questions – analysis, practical knowledge. Target ~35% of marks.
- Section C: Extended – creative task or analysis. Target ~25% of marks.
- Cover performing and visual arts. Provide correctAnswer and explanation for each question.`;
  }

  // Tourism
  if (s.includes('tourism')) {
    return `SUBJECT-SPECIFIC STRUCTURE (Tourism - CAPS/DBE):
- Section A: Multiple Choice – tourism concepts, destinations. Target ~40% of marks.
- Section B: Short Questions – map work, calculations, scenarios. Target ~35% of marks.
- Section C: Extended – case study, itinerary, report. Target ~25% of marks.
- Use South African and global contexts. Provide correctAnswer and explanation for each question.`;
  }

  return null;
}

function buildUserPrompt(payload: {
  grade: string;
  subject: string;
  examType: string;
  language: string;
  customPrompt?: string;
  contextSummary: ExamContextSummary;
  useTeacherContext: boolean;
  fullPaperMode: boolean;
  guidedMode: 'guided_first' | 'memo_first';
}) {
  const countPolicy = getQuestionCountPolicy(payload.grade, payload.examType);
  const base = [
    `Generate a ${payload.examType} exam for ${payload.grade}.`,
    `Subject: ${payload.subject}.`,
    `Language: ${payload.language}.`,
    `Minimum total questions required: ${countPolicy.min}.`,
    `Maximum total questions allowed: ${countPolicy.max}.`,
    'Align strictly to CAPS/DBE outcomes and cognitive level for this grade.',
    'Include a balanced progression from foundational to challenging items.',
    payload.fullPaperMode
      ? 'Full-paper mode is ON: include formal section progression and realistic exam pacing.'
      : 'Use compact paper mode with high quality question diversity.',
    'Target mark distribution: objective 45-60%, short response 25-35%, extended response 10-20%.',
    'For language subjects with comprehension, include a passage/story in section instructions.',
    'Do not duplicate option letters inside option strings.',
    'Always include explanation for each answer key item.',
  ];

  const subjectStructure = getSubjectSectionStructure(payload.subject, payload.grade, payload.examType);
  if (subjectStructure) {
    base.push(subjectStructure);
  }

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

  base.push(
    payload.guidedMode === 'guided_first'
      ? 'Guided-first policy: hints should be prioritized before full memo style explanations.'
      : 'Memo-first mode allowed.',
  );

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
    const examIntentMode =
      body?.examIntentMode === 'caps_only' ? 'caps_only' : 'teacher_weighted';
    const fullPaperMode = body?.fullPaperMode !== false;
    const visualMode = body?.visualMode === 'hybrid' ? 'hybrid' : 'off';
    const guidedMode = body?.guidedMode === 'memo_first' ? 'memo_first' : 'guided_first';

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
      examIntentMode,
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

    const { data: tierData } = await supabase.rpc('get_user_subscription_tier', {
      user_id: scope.profile.id,
    });

    const effectiveTierForRole = normalizeTierForExamRole(
      scope.role,
      scope.profile.subscription_tier,
      typeof tierData === 'string' ? tierData : null,
    );
    const preferredModel = modelOverride || getDefaultModelForTier(effectiveTierForRole);
    const modelCandidates = buildModelFallbackChain(preferredModel);
    let modelUsed = preferredModel;

    const userPrompt = buildUserPrompt({
      grade,
      subject,
      examType,
      language,
      customPrompt,
      contextSummary,
      useTeacherContext,
      fullPaperMode,
      guidedMode,
    });

    console.log('[generate-exam] generating', {
      grade,
      subject,
      examType,
      userId: user.id,
      profileId: scope.profile.id,
      preferredModel,
      useTeacherContext,
      effectiveTierForRole,
      examIntentMode,
      fullPaperMode,
      visualMode,
      guidedMode,
      assignmentCount: contextSummary.assignmentCount,
      lessonCount: contextSummary.lessonCount,
    });

    let aiContent = '';
    let localFallbackReason: string | null = null;
    let lastModelError = 'Failed to generate exam content';
    let anthropicCreditIssue = false;

    if (ANTHROPIC_API_KEY) {
      for (const candidateModel of modelCandidates) {
        const candidateResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: candidateModel,
            max_tokens: 4096,
            system: EXAM_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });

        if (candidateResponse.ok) {
          const aiData = await candidateResponse.json();
          aiContent = String(aiData?.content?.[0]?.text || '');
          modelUsed = candidateModel;
          break;
        }

        const errText = await candidateResponse.text();
        lastModelError = errText || `status=${candidateResponse.status}`;
        console.error('[generate-exam] Anthropic API error:', candidateResponse.status, candidateModel, errText);

        if (candidateResponse.status === 429) {
          throw new Error('AI service is busy. Please try again in a moment.');
        }

        if (isCreditOrBillingError(candidateResponse.status, errText)) {
          anthropicCreditIssue = true;
          break;
        }
      }
    } else {
      lastModelError = 'ANTHROPIC_API_KEY missing';
    }

    if (!aiContent && OPENAI_API_KEY) {
      const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_EXAM_MODEL,
          temperature: 0.2,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: EXAM_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (openAIResponse.ok) {
        const openAIData = await openAIResponse.json();
        aiContent = String(openAIData?.choices?.[0]?.message?.content || '');
        modelUsed = `openai:${OPENAI_EXAM_MODEL}`;
      } else {
        const openAIErr = await openAIResponse.text();
        lastModelError = openAIErr || `openai_status=${openAIResponse.status}`;
        console.error('[generate-exam] OpenAI API error:', openAIResponse.status, openAIErr);
        if (openAIResponse.status === 429 && !isCreditOrBillingError(openAIResponse.status, openAIErr)) {
          throw new Error('AI service is busy. Please try again in a moment.');
        }
      }
    }

    let normalizedExam: any;

    if (!aiContent) {
      modelUsed = 'fallback:local-template-v1';
      localFallbackReason = anthropicCreditIssue
        ? 'AI provider credits are currently depleted. Generated a local fallback practice exam.'
        : 'AI providers are currently unavailable. Generated a local fallback practice exam.';
      normalizedExam = normalizeExamShape(
        buildLocalFallbackExam(grade, subject, examType, contextSummary),
        grade,
        subject,
        examType,
      );
    } else {
      let parsedRawExam: any;
      try {
        parsedRawExam = JSON.parse(extractJsonBlock(aiContent));
        normalizedExam = normalizeExamShape(parsedRawExam, grade, subject, examType);
      } catch (parseError) {
        console.error('[generate-exam] parse error', parseError);
        modelUsed = 'fallback:local-template-v1';
        localFallbackReason = 'AI returned malformed exam JSON. Generated a local fallback practice exam.';
        normalizedExam = normalizeExamShape(
          buildLocalFallbackExam(grade, subject, examType, contextSummary),
          grade,
          subject,
          examType,
        );
      }
    }

    const countPolicy = getQuestionCountPolicy(grade, examType);

    normalizedExam = ensureMinimumQuestionCoverage(normalizedExam, {
      grade,
      subject,
      examType,
      contextSummary,
      minQuestionCount: fullPaperMode ? countPolicy.min : Math.min(countPolicy.min, 16),
    });
    normalizedExam = enforceQuestionUpperBound(normalizedExam, countPolicy.max);
    normalizedExam = ensureLanguageReadingPassage(normalizedExam, subject, grade, language);
    normalizedExam = augmentQuestionVisuals(normalizedExam, visualMode);
    normalizedExam = recalculateExamMarks(normalizedExam);

    if (!normalizedExam.sections.length || !normalizedExam.sections.some((section: any) => section.questions.length > 0)) {
      throw new Error(`Generated exam has no valid questions. ${lastModelError}`);
    }

    const teacherAlignment = computeTeacherAlignmentSummary(contextSummary);
    const examBlueprintAudit = computeBlueprintAudit(normalizedExam, grade, examType);
    const studyCoachPack = buildStudyCoachPack(grade, subject, language, contextSummary);

    const metadata = {
      source: localFallbackReason
        ? 'local_fallback'
        : useTeacherContext
        ? 'teacher_artifact_context'
        : 'caps_baseline',
      contextSummary,
      teacherAlignment,
      examBlueprintAudit,
      studyCoachPack,
      caps: {
        aligned: true,
        framework: 'CAPS/DBE',
        lookbackDays,
        language,
      },
      generationWarning: localFallbackReason || undefined,
    };

    let persistedExamId = `temp-${Date.now()}`;
    const warningParts: string[] = [];
    if (localFallbackReason) warningParts.push(localFallbackReason);

    const { data: savedExam, error: saveError } = await supabase
      .from('exam_generations')
      .insert({
        user_id: scope.profile.id,
        grade,
        subject,
        exam_type: examType,
        display_title: normalizedExam.title,
        generated_content: JSON.stringify(normalizedExam),
        status: 'completed',
        model_used: modelUsed,
        metadata,
      })
      .select('id')
      .single();

    if (saveError) {
      console.warn('[generate-exam] Could not persist exam_generations row', saveError.message);
      warningParts.push('Exam generated, but cloud save failed. You can still continue with this attempt.');
    } else if (savedExam?.id) {
      persistedExamId = String(savedExam.id);
    }

    const persistenceWarning = warningParts.length > 0 ? warningParts.join(' ') : undefined;

    return jsonResponse(
      {
        success: true,
        exam: normalizedExam,
        examId: persistedExamId,
        contextSummary,
        teacherAlignment,
        examBlueprintAudit,
        studyCoachPack,
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
