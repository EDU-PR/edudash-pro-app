'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PostgrestError } from '@supabase/supabase-js';
import { AlertTriangle, Bell, CheckCircle2, MessageSquare, Star } from 'lucide-react';

type NoteType = 'highlight' | 'concern' | 'achievement' | 'reminder' | 'general';

interface TeacherNoteRow {
  id: string;
  student_id: string;
  teacher_id: string | null;
  note_type: NoteType | null;
  title: string | null;
  content: string | null;
  is_read: boolean | null;
  requires_acknowledgment: boolean | null;
  acknowledged_at: string | null;
  created_at: string;
}

interface TeacherProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface TeacherNote {
  id: string;
  studentId: string;
  noteType: NoteType;
  title: string;
  content: string;
  isRead: boolean;
  requiresAcknowledgment: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  teacherName: string;
}

interface TeacherQuickNotesCardProps {
  studentId: string;
  maxItems?: number;
  showHeader?: boolean;
}

const NOTE_TYPES: Record<
  NoteType,
  { label: string; color: string; icon: typeof Star }
> = {
  highlight: { label: 'Daily Highlight', color: '#f59e0b', icon: Star },
  concern: { label: 'Please Note', color: '#ef4444', icon: AlertTriangle },
  achievement: { label: 'Achievement', color: '#10b981', icon: CheckCircle2 },
  reminder: { label: 'Reminder', color: '#6366f1', icon: Bell },
  general: { label: 'Note', color: '#3b82f6', icon: MessageSquare },
};

const isMissingSchema = (error?: PostgrestError | null) => {
  if (!error) return false;
  return error.code === '42P01' || error.code === '42703';
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export function TeacherQuickNotesCard({
  studentId,
  maxItems = 5,
  showHeader = true,
}: TeacherQuickNotesCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [notes, setNotes] = useState<TeacherNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    if (!studentId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('teacher_student_notes')
        .select('id, student_id, teacher_id, note_type, title, content, is_read, requires_acknowledgment, acknowledged_at, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(maxItems);

      if (error) {
        if (!isMissingSchema(error)) {
          setNotes([]);
        }
        setLoading(false);
        return;
      }

      const rows = (data || []) as TeacherNoteRow[];
      const teacherIds = rows
        .map((row) => row.teacher_id)
        .filter((id): id is string => Boolean(id));
      const uniqueTeacherIds = Array.from(new Set(teacherIds));

      let teacherMap: Record<string, TeacherProfileRow> = {};
      if (uniqueTeacherIds.length > 0) {
        const { data: teachers } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', uniqueTeacherIds);

        teacherMap = (teachers || []).reduce<Record<string, TeacherProfileRow>>((acc, row) => {
          acc[row.id] = row as TeacherProfileRow;
          return acc;
        }, {});
      }

      const mapped = rows.map((row) => {
        const profile = row.teacher_id ? teacherMap[row.teacher_id] : undefined;
        const teacherName = profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Teacher'
          : 'Teacher';

        return {
          id: row.id,
          studentId: row.student_id,
          noteType: (row.note_type || 'general') as NoteType,
          title: row.title || 'Update',
          content: row.content || '',
          isRead: Boolean(row.is_read),
          requiresAcknowledgment: Boolean(row.requires_acknowledgment),
          acknowledgedAt: row.acknowledged_at,
          createdAt: row.created_at,
          teacherName,
        };
      });

      setNotes(mapped);
    } finally {
      setLoading(false);
    }
  }, [maxItems, studentId, supabase]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(`teacher-notes-${studentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teacher_student_notes', filter: `student_id=eq.${studentId}` },
        () => {
          void loadNotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNotes, studentId, supabase]);

  const handleAcknowledge = async (noteId: string) => {
    await supabase
      .from('teacher_student_notes')
      .update({
        acknowledged_at: new Date().toISOString(),
        is_read: true,
      })
      .eq('id', noteId);
    void loadNotes();
  };

  if (loading) {
    return (
      <div className="card">
        <div className="sectionTitle">From Teacher</div>
        <div className="muted">Loading notes...</div>
      </div>
    );
  }

  if (notes.length === 0) {
    return null;
  }

  const unreadCount = notes.filter((note) => !note.isRead).length;

  return (
    <div className="card">
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={18} style={{ color: 'var(--primary)' }} />
            <div className="sectionTitle" style={{ margin: 0 }}>From Teacher</div>
          </div>
          {unreadCount > 0 && (
            <span style={{
              background: 'var(--primary)',
              color: 'white',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
            }}>
              {unreadCount} new
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {notes.map((note) => {
          const config = NOTE_TYPES[note.noteType] || NOTE_TYPES.general;
          const Icon = config.icon;
          const isExpanded = expandedId === note.id;

          return (
            <div
              key={note.id}
              style={{
                borderRadius: 12,
                border: `1px solid ${note.isRead ? 'var(--border)' : `${config.color}55`}`,
                background: note.isRead ? 'var(--surface-1)' : `${config.color}12`,
                padding: 12,
              }}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : note.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    background: `${config.color}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon size={16} style={{ color: config.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: config.color }}>{config.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatRelativeTime(note.createdAt)}</div>
                  </div>
                  {!note.isRead && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: config.color }} />
                  )}
                </div>

                <div style={{ fontWeight: 600, marginBottom: 6 }}>{note.title}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {isExpanded ? note.content : `${note.content.slice(0, 120)}${note.content.length > 120 ? '…' : ''}`}
                </div>
              </button>

              {isExpanded && (
                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>From: {note.teacherName}</div>
                  {note.requiresAcknowledgment && !note.acknowledgedAt && (
                    <button
                      className="btn btnPrimary"
                      onClick={() => handleAcknowledge(note.id)}
                      style={{ width: 'fit-content' }}
                    >
                      Acknowledge
                    </button>
                  )}
                  {note.acknowledgedAt && (
                    <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                      Acknowledged
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
