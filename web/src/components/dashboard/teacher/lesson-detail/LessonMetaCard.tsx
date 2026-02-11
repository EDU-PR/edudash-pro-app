'use client';

import { BookOpen, Clock3, Sparkles } from 'lucide-react';
import { getInitials } from '@/lib/utils/lessonContent';
import type { LessonRow, TeacherMini } from './types';
import { normalizeTeacher, statusPillClass } from './types';

interface LessonMetaCardProps {
  lesson: LessonRow;
  ownerLabel: string;
}

export function LessonMetaCard({ lesson, ownerLabel }: LessonMetaCardProps) {
  const teacher = normalizeTeacher(lesson.teacher);

  return (
    <div className="section">
      <div className="card p-md">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">{lesson.title || 'Untitled lesson'}</h1>
                <p className="text-sm text-slate-300">
                  {lesson.description || 'No description yet.'}
                </p>
              </div>

              <div className={`text-xs px-2.5 py-1 rounded-full border ${statusPillClass(lesson.status)}`}>
                {lesson.status}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
                <div className="text-xs text-slate-400">Subject</div>
                <div className="text-sm font-semibold text-slate-100">{lesson.subject || 'General'}</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
                <div className="text-xs text-slate-400">Age Group</div>
                <div className="text-sm font-semibold text-slate-100">{lesson.age_group || 'All ages'}</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
                <div className="text-xs text-slate-400">Duration</div>
                <div className="text-sm font-semibold text-slate-100 inline-flex items-center gap-1">
                  <Clock3 className="w-3.5 h-3.5" />
                  {lesson.duration_minutes || 30} min
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
                <div className="text-xs text-slate-400">Owner</div>
                <div className="text-sm font-semibold text-slate-100 inline-flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-slate-700 text-slate-200 text-[10px] font-semibold flex items-center justify-center">
                    {getInitials(teacher?.first_name, teacher?.last_name)}
                  </span>
                  {ownerLabel}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
              {lesson.is_ai_generated && (
                <span className="inline-flex items-center gap-1 text-cyan-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI generated
                </span>
              )}
              {lesson.created_at && <span>Created {new Date(lesson.created_at).toLocaleString()}</span>}
              {lesson.updated_at && <span>Updated {new Date(lesson.updated_at).toLocaleString()}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
