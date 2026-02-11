export interface LessonFlowPhase {
  phase?: string;
  duration?: string;
  title?: string;
  instructions?: string;
  teacher_script?: string;
  activities?: Array<Record<string, unknown> | string>;
}

export interface ParsedLessonContent {
  overview?: string;
  lesson_flow?: LessonFlowPhase[];
  interactive_activities?: Array<{
    name?: string;
    type?: string;
    description?: string;
  }>;
  differentiation?: {
    support?: string;
    extension?: string;
  } | string;
  [key: string]: unknown;
}

const toString = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

export const normalizeStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => toString(item))
      .filter(Boolean);
  }

  const text = toString(value);
  if (!text) return [];

  const parsed = text
    .split(/[\n,]/)
    .map((item) => item.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

  return parsed;
};

export const normalizeMaterialsList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => toString(item))
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item) => toString(item))
      .filter(Boolean);
  }

  return normalizeStringList(value);
};

export const parseLessonContent = (value: unknown): ParsedLessonContent | null => {
  if (!value) return null;

  if (typeof value === 'object') {
    return value as ParsedLessonContent;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as ParsedLessonContent;
  } catch {
    return null;
  }
};

export const splitTextareaLines = (value: string): string[] => {
  return value
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
};

export const toTextareaValue = (value: unknown): string => {
  return normalizeStringList(value).join('\n');
};

export const getLessonSummary = (description: unknown, content: unknown): string => {
  const textDescription = toString(description);
  if (textDescription) return textDescription;

  const parsed = parseLessonContent(content);
  if (parsed?.overview && parsed.overview.trim()) {
    return parsed.overview.trim();
  }

  const textContent = toString(content);
  if (textContent) {
    return textContent.slice(0, 220);
  }

  return 'No description available yet.';
};

export const getInitials = (firstName?: string | null, lastName?: string | null): string => {
  const first = (firstName || '').trim();
  const last = (lastName || '').trim();
  const raw = `${first[0] || ''}${last[0] || ''}`.toUpperCase();
  return raw || 'T';
};
