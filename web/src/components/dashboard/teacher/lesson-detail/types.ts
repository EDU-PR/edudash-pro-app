export interface TeacherMini {
  first_name: string | null;
  last_name: string | null;
}

export interface LessonRow {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  age_group: string;
  duration_minutes: number | null;
  status: string;
  is_ai_generated: boolean | null;
  teacher_id: string | null;
  preschool_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  objectives: string[] | null;
  materials_needed: string | null;
  content: string | null;
  teacher?: TeacherMini | TeacherMini[] | null;
}

export const PRINCIPAL_ROLES = ['principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];

export const normalizeTeacher = (value?: TeacherMini | TeacherMini[] | null): TeacherMini | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] || null) : value;
};

export const nextStatusForAction = (status: string): { nextStatus: string; ctaLabel: string } => {
  const current = String(status || '').toLowerCase();

  if (current === 'draft') return { nextStatus: 'published', ctaLabel: 'Publish Lesson' };
  if (current === 'active' || current === 'published') return { nextStatus: 'archived', ctaLabel: 'Archive Lesson' };
  if (current === 'archived') return { nextStatus: 'active', ctaLabel: 'Restore Lesson' };

  return { nextStatus: 'active', ctaLabel: 'Set Active' };
};

export const statusPillClass = (status: string): string => {
  const current = String(status || '').toLowerCase();
  if (current === 'draft') return 'border-amber-500/40 bg-amber-900/20 text-amber-300';
  if (current === 'active') return 'border-emerald-500/40 bg-emerald-900/20 text-emerald-300';
  if (current === 'published') return 'border-blue-500/40 bg-blue-900/20 text-blue-300';
  if (current === 'archived') return 'border-slate-500/40 bg-slate-900/20 text-slate-300';
  return 'border-slate-500/40 bg-slate-900/20 text-slate-300';
};
