/**
 * useStudentAssignments
 *
 * Fetches real assignment data for K-12 student screens.
 * Replaces hardcoded mock data in app/(k12)/student/assignments.tsx.
 */

import { useEffect, useState } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { FeatureItem } from '@/domains/k12/components/K12StudentFeatureScreen';

const SUBJECT_ICONS: Record<string, string> = {
  mathematics: 'calculator-outline',
  math: 'calculator-outline',
  english: 'book-outline',
  science: 'flask-outline',
  physics: 'flash-outline',
  history: 'time-outline',
  geography: 'globe-outline',
  technology: 'laptop-outline',
  art: 'color-palette-outline',
  music: 'musical-notes-outline',
  life: 'heart-outline',
};

const SUBJECT_TONES: Record<string, string> = {
  mathematics: '#10B981',
  math: '#10B981',
  english: '#6366F1',
  science: '#F59E0B',
  physics: '#EF4444',
  history: '#8B5CF6',
  geography: '#3B82F6',
};

function getSubjectIcon(subject: string): string {
  const lower = subject.toLowerCase();
  for (const [key, icon] of Object.entries(SUBJECT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return 'document-text-outline';
}

function getSubjectTone(subject: string): string {
  const lower = subject.toLowerCase();
  for (const [key, tone] of Object.entries(SUBJECT_TONES)) {
    if (lower.includes(key)) return tone;
  }
  return '#6366F1';
}

function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return 'No due date';
  const due = new Date(dueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return `Due ${due.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}`;
}

export function useStudentAssignments() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeatureItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchAssignments = async () => {
      try {
        const supabase = assertSupabase();
        const { data, error } = await supabase
          .from('lesson_assignments')
          .select('id, title, subject, due_at, status')
          .eq('student_id', user.id)
          .in('status', ['pending', 'in_progress'])
          .order('due_at', { ascending: true })
          .limit(20);

        if (error || !data || cancelled) return;

        const mapped: FeatureItem[] = data.map((a: any) => ({
          id: a.id,
          title: a.title || 'Untitled Assignment',
          subtitle: `${formatDueDate(a.due_at)} • ${a.status === 'in_progress' ? 'In progress' : 'Not started'}`,
          icon: getSubjectIcon(a.subject || '') as any,
          tone: getSubjectTone(a.subject || ''),
        }));

        setItems(mapped);
      } catch {
        // Silently fail — empty list is shown
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAssignments();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { items, loading };
}
