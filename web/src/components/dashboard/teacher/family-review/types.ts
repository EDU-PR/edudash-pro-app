import { formatDistanceToNow } from 'date-fns';

export interface StudentSummary {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  class_id?: string | null;
}

export interface ClassSummary {
  id: string;
}

export interface ProgressUpload {
  id: string;
  student_id: string;
  title: string;
  description?: string | null;
  subject?: string | null;
  learning_area?: string | null;
  achievement_level?: string | null;
  status?: string | null;
  file_path: string;
  file_name?: string | null;
  created_at: string;
  student?: StudentSummary | StudentSummary[] | null;
}

export interface TutorAttempt {
  id: string;
  student_id: string;
  score?: number | null;
  feedback?: string | null;
  topic?: string | null;
  subject?: string | null;
  metadata?: unknown;
  created_at: string;
}

export type ReviewFilter = 'all' | 'needs_grading' | 'graded';

export const STAFF_ROLES = ['teacher', 'principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];
export const PRINCIPAL_ROLES = ['principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];
export const PROGRESS_STORAGE_BUCKET = 'proof-of-payments';

export const pickStudent = (student?: StudentSummary | StudentSummary[] | null): StudentSummary | null => {
  if (!student) return null;
  return Array.isArray(student) ? (student[0] || null) : student;
};

export const toName = (student?: StudentSummary | StudentSummary[] | null): string => {
  const target = pickStudent(student);
  if (!target) return 'Student';
  const full = `${target.first_name || ''} ${target.last_name || ''}`.trim();
  return full || 'Student';
};

export const parseMetadata = (metadata: unknown): Record<string, unknown> => {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof metadata === 'object') return metadata as Record<string, unknown>;
  return {};
};

export const parseScore = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const maybe = Number(value);
  return Number.isFinite(maybe) ? Math.round(maybe) : null;
};

export const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Unknown time';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

export const formatRelative = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatDistanceToNow(parsed, { addSuffix: true });
};
