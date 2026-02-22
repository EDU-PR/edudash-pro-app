import { track } from '@/lib/analytics';
import { LessonPlanV2Schema, type LessonPlanStep, type LessonPlanV2 } from './lessonPlanSchema';

function extractJsonCandidate(raw: string): unknown {
  const text = String(raw || '').trim();
  if (!text) return null;

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const firstCandidate = (fence?.[1] || text).trim();
  try {
    return JSON.parse(firstCandidate);
  } catch {
    // Continue to loose object extraction
  }

  const loose = text.match(/\{[\s\S]*\}/);
  if (!loose) return null;
  try {
    return JSON.parse(loose[0]);
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function normalizeStep(step: any, idx: number): LessonPlanStep {
  const instructions = toStringArray(step?.instructions);
  const fallbackInstruction = String(step?.instruction || step?.description || '').trim();
  const normalizedInstructions =
    instructions.length > 0
      ? instructions
      : fallbackInstruction
        ? [fallbackInstruction]
        : ['Follow classroom-ready instructions for this step.'];

  const minutesRaw = Number(step?.minutes ?? step?.timeMinutes ?? step?.duration ?? 10);
  const minutes = Number.isFinite(minutesRaw) ? Math.max(1, Math.min(240, Math.round(minutesRaw))) : 10;

  return {
    title: String(step?.title || step?.name || `Step ${idx + 1}`).trim() || `Step ${idx + 1}`,
    minutes,
    objective: String(step?.objective || step?.goal || 'Support the lesson objective.').trim(),
    teacherPrompt: String(
      step?.teacherPrompt || step?.teacher_prompt || step?.facilitation || 'Ask one diagnostic and one extension question.',
    ).trim(),
    example: String(step?.example || step?.workedExample || step?.worked_example || 'Provide one worked classroom example.').trim(),
    instructions: normalizedInstructions,
  };
}

function normalizeJsonPlan(rawPlan: any): LessonPlanV2 | null {
  if (!rawPlan || typeof rawPlan !== 'object') return null;
  const source = rawPlan.lessonPlan || rawPlan.plan || rawPlan.lesson || rawPlan;

  const stepsRaw: unknown[] = Array.isArray(source?.steps)
    ? source.steps
    : Array.isArray(source?.activities)
      ? source.activities
      : [];
  const steps = stepsRaw.map((step, idx) => normalizeStep(step, idx));

  const objectives = toStringArray(source?.objectives);
  const materials = toStringArray(source?.materials);
  const assessment = toStringArray(source?.assessment);

  const durationMinutesFromSteps = steps.reduce((sum, step) => sum + step.minutes, 0);
  const durationCandidate = source?.durationMinutes ?? source?.duration ?? (durationMinutesFromSteps || 45);
  const durationMinutesRaw = Number(durationCandidate);
  const durationMinutes = Number.isFinite(durationMinutesRaw)
    ? Math.max(1, Math.min(480, Math.round(durationMinutesRaw)))
    : Math.max(1, durationMinutesFromSteps || 45);

  const candidate: LessonPlanV2 = {
    title: String(source?.title || source?.lessonTitle || source?.name || 'Lesson Plan').trim() || 'Lesson Plan',
    summary: String(source?.summary || source?.overview || 'Structured classroom-ready lesson plan.').trim() || 'Structured classroom-ready lesson plan.',
    objectives: objectives.length > 0 ? objectives : ['Deliver the core lesson objective clearly.'],
    materials: materials.length > 0 ? materials : ['Classroom board', 'Learner notebooks', 'Basic stationery'],
    steps: steps.length > 0
      ? steps
      : [
          {
            title: 'Main Lesson Step',
            minutes: 20,
            objective: 'Teach the key concept.',
            teacherPrompt: 'Ask learners to explain their reasoning.',
            example: 'Demonstrate one worked example.',
            instructions: ['Introduce concept', 'Model example', 'Guide learner practice'],
          },
        ],
    assessment: assessment.length > 0 ? assessment : ['Quick formative check at end of lesson.'],
    differentiation: {
      support: String(source?.differentiation?.support || source?.support || 'Use scaffolding and guided prompts.').trim(),
      extension: String(source?.differentiation?.extension || source?.extension || 'Provide one stretch challenge.').trim(),
    },
    closure: String(source?.closure || source?.reflection || 'Summarize key learning and assign a quick exit check.').trim(),
    durationMinutes,
    sourceFormat: 'json',
  };

  return LessonPlanV2Schema.parse(candidate);
}

function parseMinutes(text: string): number | null {
  const match = text.match(/(\d+)\s*min/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? Math.max(1, Math.min(240, value)) : null;
}

function parseMarkdownFallback(raw: string): LessonPlanV2 {
  const text = String(raw || '').trim();
  const lines = text.split('\n').map((line) => line.trim());

  const titleLine = lines.find((line) => /^#\s+/.test(line));
  const title = titleLine ? titleLine.replace(/^#\s+/, '').trim() : 'Lesson Plan';

  const headings: Array<{ heading: string; body: string[] }> = [];
  let currentHeading = 'Overview';
  let buffer: string[] = [];

  const pushSection = () => {
    headings.push({ heading: currentHeading, body: buffer.slice() });
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      pushSection();
      currentHeading = headingMatch[1].trim();
      continue;
    }
    buffer.push(line);
  }
  pushSection();

  const pickSection = (tokens: string[]): { heading: string; body: string[] } | null => {
    const found = headings.find((section) => {
      const heading = section.heading.toLowerCase();
      return tokens.some((token) => heading.includes(token));
    });
    return found || null;
  };

  const bulletLines = (section: { heading: string; body: string[] } | null): string[] => {
    if (!section) return [];
    return section.body
      .map((line) => line.replace(/^[-*]\s+/, '').trim())
      .filter((line) => line.length > 0);
  };

  const objectives = bulletLines(pickSection(['objective']));
  const materials = bulletLines(pickSection(['material']));
  const assessment = bulletLines(pickSection(['assessment', 'check']));
  const closureSection = pickSection(['closure', 'reflection']);
  const closure = closureSection?.body.filter(Boolean).join(' ').trim() || 'Summarize the key concept and confirm understanding.';

  const stepSections = headings.filter((section) => {
    const key = section.heading.toLowerCase();
    return (
      key.includes('activity') ||
      key.includes('step') ||
      key.includes('warm') ||
      key.includes('main') ||
      key.includes('transition') ||
      key.includes('closing')
    );
  });

  const steps: LessonPlanStep[] = stepSections.map((section, idx) => {
    const bodyLines = section.body.filter(Boolean);
    const instructionLines = bodyLines
      .map((line) => line.replace(/^[-*]\s+/, '').trim())
      .filter(Boolean);
    const teacherPrompt =
      bodyLines.find((line) => /teacher|prompt|question/i.test(line)) ||
      'Ask learners to explain their reasoning for this step.';
    const example =
      bodyLines.find((line) => /example|e\.g\./i.test(line)) ||
      'Give one worked classroom example.';

    return {
      title: section.heading,
      minutes: parseMinutes(section.heading) ?? 10,
      objective: `Complete ${section.heading}.`,
      teacherPrompt: teacherPrompt.replace(/^[-*]\s+/, '').trim(),
      example: example.replace(/^[-*]\s+/, '').trim(),
      instructions:
        instructionLines.length > 0
          ? instructionLines
          : ['Present this step clearly and check learner understanding.'],
    };
  });

  const durationMinutesFromSteps = steps.reduce((sum, step) => sum + step.minutes, 0);

  const fallbackPlan: LessonPlanV2 = {
    title,
    summary: headings.find((section) => section.heading.toLowerCase() === 'overview')?.body.join(' ').trim() ||
      'Classroom-ready lesson generated from markdown fallback.',
    objectives: objectives.length > 0 ? objectives : ['Deliver one clear learning objective for the topic.'],
    materials: materials.length > 0 ? materials : ['Board and markers', 'Learner notebooks'],
    steps: steps.length > 0
      ? steps
      : [
          {
            title: 'Guided Lesson Step',
            minutes: 20,
            objective: 'Teach the key concept.',
            teacherPrompt: 'Ask one diagnostic question.',
            example: 'Model one worked example.',
            instructions: ['Introduce concept', 'Guide practice', 'Check understanding'],
          },
        ],
    assessment: assessment.length > 0 ? assessment : ['Run one quick understanding check.'],
    differentiation: {
      support: 'Use guided prompts and additional examples for support.',
      extension: 'Add one challenge question for early finishers.',
    },
    closure,
    durationMinutes: Math.max(1, durationMinutesFromSteps || 45),
    sourceFormat: 'markdown_fallback',
    rawContent: text,
  };

  return LessonPlanV2Schema.parse(fallbackPlan);
}

export function parseLessonPlanResponse(raw: string): LessonPlanV2 {
  const jsonCandidate = extractJsonCandidate(raw);
  if (jsonCandidate) {
    try {
      return normalizeJsonPlan(jsonCandidate) as LessonPlanV2;
    } catch (error) {
      track('lesson.parse_fallback_used', {
        reason: 'json_validation_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    track('lesson.parse_fallback_used', {
      reason: 'json_missing',
    });
  }
  return parseMarkdownFallback(raw);
}
