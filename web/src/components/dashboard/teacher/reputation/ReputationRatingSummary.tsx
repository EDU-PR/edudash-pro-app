'use client';

import { Star } from 'lucide-react';
import type { RatingSummaryRow } from './types';
import { getInsights, starRows } from './types';

interface ReputationRatingSummaryProps {
  summary: RatingSummaryRow | null;
}

export function ReputationRatingSummary({ summary }: ReputationRatingSummaryProps) {
  return (
    <div className="section">
      <div className="card p-md">
        <div className="text-sm text-slate-400 mb-2">Overall rating</div>
        {summary?.avg_rating ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              {starRows(summary.avg_rating).map((active, idx) => (
                <Star
                  key={idx}
                  className="w-5 h-5"
                  style={{ color: active ? '#f59e0b' : '#475569', fill: active ? '#f59e0b' : 'transparent' }}
                />
              ))}
            </div>
            <div className="text-2xl font-bold text-white">{summary.avg_rating.toFixed(1)}</div>
            <div className="text-sm text-slate-400">({summary.rating_count || 0} ratings)</div>
          </div>
        ) : (
          <div className="text-sm text-slate-300">No ratings yet.</div>
        )}

        <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-950/20 p-3 text-sm text-blue-100">
          {getInsights(summary)}
        </div>
      </div>
    </div>
  );
}
