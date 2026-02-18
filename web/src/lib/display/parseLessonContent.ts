/**
 * Parse lesson content JSON for room display (steps and resources).
 * Mirrors logic from app/screens/lesson-viewer.tsx for consistency.
 */

export interface LessonContentParsed {
  lesson_flow?: Array<{
    phase?: string;
    duration?: string;
    title?: string;
    instructions?: string;
    teacher_script?: string;
    activities?: unknown[];
  }>;
  materials?: string[];
  resources?: string[];
}

export interface LessonStepDisplay {
  title: string;
  duration: string;
  description: string;
}

export interface LessonMediaDisplay {
  thumbnail_url?: string | null;
  resources: Array<{ title: string; type?: string; url?: string }>;
}

function parseContent(raw: unknown): LessonContentParsed | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null) return raw as LessonContentParsed;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as LessonContentParsed;
    } catch {
      return null;
    }
  }
  return null;
}

export function extractStepsFromContent(
  content: unknown,
  materialsNeeded?: string[]
): LessonStepDisplay[] {
  const parsed = parseContent(content);
  if (!parsed?.lesson_flow?.length) {
    return [];
  }

  const steps: LessonStepDisplay[] = [];
  for (const phase of parsed.lesson_flow) {
    const title = phase.title || phase.phase || 'Step';
    const duration = phase.duration || '10 min';
    const description =
      phase.instructions || phase.teacher_script || '';
    if (title) {
      steps.push({ title, duration, description });
    }
    if (Array.isArray(phase.activities)) {
      for (const sub of phase.activities) {
        const subTitle =
          typeof sub === 'object' && sub !== null && 'name' in sub
            ? String((sub as { name?: string }).name)
            : typeof sub === 'string'
              ? sub
              : 'Activity';
        steps.push({
          title: subTitle,
          duration: '5 min',
          description: typeof sub === 'object' && sub !== null && 'description' in sub
            ? String((sub as { description?: string }).description || '')
            : '',
        });
      }
    }
  }
  return steps;
}

export function extractMediaFromContent(
  content: unknown,
  thumbnailUrl?: string | null
): LessonMediaDisplay {
  const parsed = parseContent(content);
  const resources: Array<{ title: string; type?: string; url?: string }> = [];

  if (parsed?.materials?.length) {
    parsed.materials.forEach((m) =>
      resources.push({ title: typeof m === 'string' ? m : String(m) })
    );
  }
  if (parsed?.resources?.length) {
    for (const r of parsed.resources) {
      if (typeof r === 'string') {
        resources.push({ title: r });
      } else if (r && typeof r === 'object' && 'title' in r) {
        resources.push({
          title: String((r as { title?: string }).title || 'Resource'),
          type: (r as { type?: string }).type,
          url: (r as { url?: string }).url,
        });
      }
    }
  }

  return {
    thumbnail_url: thumbnailUrl || null,
    resources,
  };
}
