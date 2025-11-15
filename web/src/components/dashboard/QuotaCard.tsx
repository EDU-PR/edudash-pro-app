'use client';

import { useQuotaCheck, type QuotaUsage } from '@/hooks/useQuotaCheck';
import { useEffect, useState } from 'react';
import { TrendingUp, MessageSquare, FileText, HelpCircle } from 'lucide-react';

interface QuotaCardProps {
  userId: string;
}

interface TierLimits {
  exams_per_month: number;
  explanations_per_month: number;
  chat_messages_per_day: number;
}

// Tier limits from database configuration
const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    exams_per_month: 3,
    explanations_per_month: 5,
    chat_messages_per_day: 10,
  },
  trial: {
    exams_per_month: 10,
    explanations_per_month: 20,
    chat_messages_per_day: 50,
  },
  basic: {
    exams_per_month: 30,
    explanations_per_month: 100,
    chat_messages_per_day: 200,
  },
  premium: {
    exams_per_month: 100,
    explanations_per_month: 500,
    chat_messages_per_day: 1000,
  },
  school: {
    exams_per_month: 999999,
    explanations_per_month: 999999,
    chat_messages_per_day: 999999,
  },
};

export function QuotaCard({ userId }: QuotaCardProps) {
  const { usage, loading, refreshUsage } = useQuotaCheck(userId);
  const [limits, setLimits] = useState<TierLimits | null>(null);

  useEffect(() => {
    if (usage?.current_tier) {
      const tierLimits = TIER_LIMITS[usage.current_tier.toLowerCase()] || TIER_LIMITS.free;
      setLimits(tierLimits);
    }
  }, [usage?.current_tier]);

  if (loading || !usage || !limits) {
    return (
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <div className="loading-skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  const isUnlimited = usage.current_tier.toLowerCase() === 'school';

  const quotaItems = [
    {
      icon: FileText,
      label: 'Exams Generated',
      used: usage.exams_generated_this_month,
      limit: limits.exams_per_month,
      period: 'this month',
      color: '#3b82f6',
    },
    {
      icon: HelpCircle,
      label: 'Explanations',
      used: usage.explanations_requested_this_month,
      limit: limits.explanations_per_month,
      period: 'this month',
      color: '#8b5cf6',
    },
    {
      icon: MessageSquare,
      label: 'Chat Messages',
      used: usage.chat_messages_today,
      limit: limits.chat_messages_per_day,
      period: 'today',
      color: '#10b981',
    },
  ];

  const getPercentage = (used: number, limit: number) => {
    if (isUnlimited) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return '#ef4444'; // red
    if (percentage >= 70) return '#f59e0b'; // orange
    return '#10b981'; // green
  };

  return (
    <div className="card" style={{ padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          <TrendingUp size={20} style={{ verticalAlign: 'middle', marginRight: 'var(--space-2)' }} />
          AI Usage
        </h3>
        <span 
          className="badge badge-primary" 
          style={{ 
            textTransform: 'capitalize',
            fontSize: 12,
          }}
        >
          {usage.current_tier} Plan
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {quotaItems.map((item) => {
          const percentage = getPercentage(item.used, item.limit);
          const statusColor = getStatusColor(percentage);
          const Icon = item.icon;

          return (
            <div key={item.label}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Icon size={16} style={{ color: item.color }} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {isUnlimited ? (
                    <span style={{ color: item.color, fontWeight: 600 }}>Unlimited</span>
                  ) : (
                    <>
                      <strong style={{ color: statusColor }}>{item.used}</strong> / {item.limit} {item.period}
                    </>
                  )}
                </span>
              </div>
              
              {!isUnlimited && (
                <div 
                  style={{
                    height: 8,
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${percentage}%`,
                      backgroundColor: statusColor,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isUnlimited && (
        <div 
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3)',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            💡 Need more? <a href="/dashboard/parent/subscription" className="link">Upgrade your plan</a> for higher limits and priority support.
          </p>
        </div>
      )}

      <button
        onClick={refreshUsage}
        className="btn btn-ghost"
        style={{ marginTop: 'var(--space-3)', width: '100%', fontSize: 13 }}
      >
        Refresh Usage
      </button>
    </div>
  );
}
