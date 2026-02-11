'use client';

import { BookOpen, Clock3, Sparkles, User } from 'lucide-react';
import type { ParsedLessonContent } from '@/lib/utils/lessonContent';

interface LessonContentSectionProps {
  parsedContent: ParsedLessonContent | null;
  rawContent: string | null;
}

export function LessonContentSection({ parsedContent, rawContent }: LessonContentSectionProps) {
  return (
    <div className="section">
      <div className="card p-md">
        <h2 className="text-lg font-semibold text-white mb-3 inline-flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-300" />
          Lesson Content
        </h2>

        {parsedContent?.lesson_flow && Array.isArray(parsedContent.lesson_flow) ? (
          <div className="space-y-4">
            {parsedContent.lesson_flow.map((phase, index) => (
              <div key={`${phase.title || 'phase'}-${index}`} className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {phase.title || phase.phase || `Phase ${index + 1}`}
                  </h3>
                  {phase.duration && (
                    <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                      <Clock3 className="w-3.5 h-3.5" />
                      {phase.duration}
                    </span>
                  )}
                </div>
                {phase.instructions && <p className="text-sm text-slate-300 whitespace-pre-wrap">{phase.instructions}</p>}
                {!phase.instructions && phase.teacher_script && (
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{phase.teacher_script}</p>
                )}
              </div>
            ))}
          </div>
        ) : rawContent ? (
          <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed bg-slate-950/40 border border-slate-700 rounded-lg p-4">
            {rawContent}
          </pre>
        ) : (
          <p className="text-sm text-slate-400">No lesson content available.</p>
        )}

        {parsedContent?.interactive_activities && parsedContent.interactive_activities.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-100 mb-2 inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              Interactive Activities
            </h3>
            <div className="space-y-2">
              {parsedContent.interactive_activities.map((activity, index) => (
                <div key={`${activity.name || 'interactive'}-${index}`} className="rounded-lg border border-cyan-700/30 bg-cyan-950/10 p-3">
                  <p className="text-sm font-medium text-cyan-100">{activity.name || `Activity ${index + 1}`}</p>
                  {(activity.type || activity.description) && (
                    <p className="text-xs text-cyan-200/80 mt-1">
                      {[activity.type, activity.description].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {parsedContent?.differentiation && (
          <div className="mt-4 rounded-lg border border-emerald-700/30 bg-emerald-950/10 p-3">
            <h3 className="text-sm font-semibold text-emerald-200 mb-1 inline-flex items-center gap-2">
              <User className="w-4 h-4" />
              Differentiation
            </h3>
            <p className="text-sm text-emerald-100/90 whitespace-pre-wrap">
              {typeof parsedContent.differentiation === 'string'
                ? parsedContent.differentiation
                : [parsedContent.differentiation.support, parsedContent.differentiation.extension]
                    .filter(Boolean)
                    .join('\n')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
