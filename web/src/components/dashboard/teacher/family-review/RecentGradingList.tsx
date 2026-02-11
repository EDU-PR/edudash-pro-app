'use client';

import type { ProgressUpload, TutorAttempt } from './types';
import { formatDateTime, parseMetadata, parseScore, toName } from './types';

interface RecentGradingListProps {
  attempts: TutorAttempt[];
  uploads: ProgressUpload[];
}

export function RecentGradingList({ attempts, uploads }: RecentGradingListProps) {
  const recentAttempts = attempts.slice(0, 8);

  return (
    <div className="section">
      <div className="card p-md">
        <h2 className="text-lg font-semibold text-white mb-3">Recent Dash Grading</h2>
        {recentAttempts.length === 0 ? (
          <div className="text-sm text-slate-400">No grading attempts recorded yet.</div>
        ) : (
          <div className="space-y-2">
            {recentAttempts.map((attempt) => {
              const metadata = parseMetadata(attempt.metadata);
              const uploadId = String(metadata.progress_upload_id || '');
              const linkedUpload = uploads.find((upload) => upload.id === uploadId);
              const score = parseScore(attempt.score);

              return (
                <div key={attempt.id} className="rounded-lg border border-slate-700 bg-slate-900/35 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">
                      {attempt.topic || linkedUpload?.title || 'Family Activity Review'}
                    </div>
                    <div className="text-sm font-bold" style={{ color: score === null ? '#cbd5e1' : '#86efac' }}>
                      {score === null ? '--' : `${score}%`}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {linkedUpload ? toName(linkedUpload.student) : 'Student'} · {formatDateTime(attempt.created_at)}
                  </div>
                  {!!attempt.feedback && (
                    <div className="text-sm text-slate-300 mt-2 line-clamp-2">{attempt.feedback}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
