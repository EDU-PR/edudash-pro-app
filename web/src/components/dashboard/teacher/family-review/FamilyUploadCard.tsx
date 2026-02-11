'use client';

import { ExternalLink, Sparkles } from 'lucide-react';
import type { ProgressUpload, TutorAttempt } from './types';
import { formatDateTime, formatRelative, toName } from './types';

interface FamilyUploadCardProps {
  upload: ProgressUpload;
  linkedAttempt: TutorAttempt | undefined;
  openingUploadId: string | null;
  onOpenEvidence: (upload: ProgressUpload) => void;
  onGradeWithDash: (upload: ProgressUpload) => void;
}

export function FamilyUploadCard({
  upload,
  linkedAttempt,
  openingUploadId,
  onOpenEvidence,
  onGradeWithDash,
}: FamilyUploadCardProps) {
  const statusGood = Boolean(linkedAttempt);
  const relative = formatRelative(upload.created_at);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/35 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-white font-semibold">{upload.title}</div>
          <div className="text-xs text-slate-400 mt-1">
            {toName(upload.student)} · {formatDateTime(upload.created_at)}
            {relative ? ` (${relative})` : ''}
          </div>
        </div>
        <div
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{
            background: statusGood ? 'rgba(34, 197, 94, 0.16)' : 'rgba(251, 191, 36, 0.2)',
            color: statusGood ? '#86efac' : '#fde68a',
          }}
        >
          {statusGood ? 'Graded' : 'Needs grading'}
        </div>
      </div>

      {!!upload.description && (
        <div className="text-sm text-slate-300 mt-3">{upload.description}</div>
      )}

      <div className="flex gap-2 mt-4 flex-wrap">
        <button
          onClick={() => onOpenEvidence(upload)}
          disabled={openingUploadId === upload.id}
          className="px-3 py-2 rounded-lg border border-sky-500/40 text-sky-200 text-xs font-semibold hover:bg-sky-900/20 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {openingUploadId === upload.id ? 'Opening...' : 'View evidence'}
        </button>
        <button
          onClick={() => onGradeWithDash(upload)}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white inline-flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {linkedAttempt ? 'Regrade with Dash' : 'Grade with Dash'}
        </button>
      </div>
    </div>
  );
}
