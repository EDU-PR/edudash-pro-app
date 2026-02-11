'use client';

import { Star } from 'lucide-react';
import type { ReferenceViewModel } from './types';
import { formatReferenceDate, starRows } from './types';

interface ReferencesListProps {
  references: ReferenceViewModel[];
}

export function ReferencesList({ references }: ReferencesListProps) {
  return (
    <div className="section">
      <div className="card p-md">
        <h2 className="text-lg font-semibold text-white mb-3">References</h2>
        {references.length === 0 ? (
          <div className="text-sm text-slate-400">No references yet.</div>
        ) : (
          <div className="space-y-3">
            {references.map((reference) => (
              <div key={reference.id} className="rounded-lg border border-slate-700 bg-slate-900/35 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-semibold">{reference.school_name}</div>
                    {reference.principal_name && (
                      <div className="text-xs text-slate-400 mt-1">{reference.principal_name}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {starRows(reference.rating_overall).map((active, idx) => (
                      <Star
                        key={idx}
                        className="w-4 h-4"
                        style={{ color: active ? '#f59e0b' : '#475569', fill: active ? '#f59e0b' : 'transparent' }}
                      />
                    ))}
                  </div>
                </div>

                {reference.title && (
                  <div className="text-sm text-slate-100 font-medium mt-2">{reference.title}</div>
                )}
                {reference.comment && (
                  <div className="text-sm text-slate-300 mt-1">{reference.comment}</div>
                )}
                <div className="text-xs text-slate-500 mt-2">{formatReferenceDate(reference.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
