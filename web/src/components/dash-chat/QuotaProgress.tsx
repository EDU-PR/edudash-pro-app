'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, Zap } from 'lucide-react';

interface QuotaProgressProps {
  userId: string;
  refreshTrigger?: number; // Increment this to trigger a refresh
}

interface QuotaData {
  used: number;
  limit: number;
  tier: string;
  resetDate?: string;
}

export function QuotaProgress({ userId, refreshTrigger }: QuotaProgressProps) {
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchQuota();
  }, [userId, refreshTrigger]); // Re-fetch when refreshTrigger changes

  const fetchQuota = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.rpc('check_ai_usage_limit', {
        p_user_id: userId,
        p_request_type: 'chat_message',
      });

      if (error) {
        console.error('[QuotaProgress] Failed to fetch:', error);
        return;
      }

      if (data) {
        // Calculate used from remaining
        const used = data.limit - data.remaining;
        setQuota({
          used,
          limit: data.limit,
          tier: data.current_tier || 'free',
        });
      }
    } catch (error) {
      console.error('[QuotaProgress] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !quota) return null;

  const percentage = quota.limit > 0 ? Math.min((quota.used / quota.limit) * 100, 100) : 0;
  const isLow = percentage > 80;
  const isExceeded = quota.used >= quota.limit;

  // Don't show for unlimited tiers
  if (quota.limit === -1 || quota.limit > 10000) return null;

  return (
    <div className="px-8 py-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-b border-gray-700/50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3 gap-4">
          <div className="flex items-center gap-2.5">
            <Zap className={`w-4 h-4 ${isLow ? 'text-orange-400' : 'text-purple-400'}`} />
            <span className="text-sm font-medium text-gray-200">
              {isExceeded ? 'Daily Quota Reached' : 'AI Usage Today'}
            </span>
          </div>
          <span className="text-xs text-gray-400 capitalize">
            {quota.tier.replace(/_/g, ' ')} Plan
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 h-2 bg-gray-700/50 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-300 ease-out ${
                isExceeded
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : isLow
                  ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                  : 'bg-gradient-to-r from-purple-500 to-blue-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className={`text-xs font-mono tabular-nums ${isExceeded ? 'text-red-400' : 'text-gray-400'}`}>
            {quota.used}/{quota.limit}
          </span>
        </div>

        {isExceeded && (
          <div className="mt-2 flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-300">
              You've reached your daily limit. Upgrade for more messages or wait until tomorrow.
            </p>
          </div>
        )}

        {isLow && !isExceeded && (
          <div className="mt-2">
            <p className="text-xs text-orange-300">
              ⚡ Running low on messages! Only {quota.limit - quota.used} left today.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
