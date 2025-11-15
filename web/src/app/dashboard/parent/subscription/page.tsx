'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useParentDashboardData } from '@/lib/hooks/useParentDashboardData';
import { useQuotaCheck } from '@/hooks/useQuotaCheck';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import {
  Crown,
  Zap,
  TrendingUp,
  Calendar,
  CreditCard,
  ArrowUpCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Users,
  School,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Subscription {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  created_at: string;
  updated_at: string;
  payment_reference?: string;
  amount_paid?: number;
}

interface TierInfo {
  name: string;
  displayName: string;
  price: number;
  color: string;
  icon: any;
  features: string[];
  limits: {
    exams: number;
    explanations: number;
    chat: number;
  };
}

const TIER_INFO: Record<string, TierInfo> = {
  free: {
    name: 'free',
    displayName: 'Free',
    price: 0,
    color: '#6b7280',
    icon: Users,
    features: [
      '5 exams per month',
      '5 explanations per month',
      '10 chat messages per day',
      'CAPS curriculum aligned',
      'Basic support',
    ],
    limits: { exams: 5, explanations: 5, chat: 10 },
  },
  trial: {
    name: 'trial',
    displayName: '7-Day Trial',
    price: 0,
    color: '#f59e0b',
    icon: Sparkles,
    features: [
      '20 exams per month',
      '20 explanations per month',
      '50 chat messages per day',
      'All CAPS subjects',
      'Priority support',
      'No credit card required',
    ],
    limits: { exams: 20, explanations: 20, chat: 50 },
  },
  basic: {
    name: 'basic',
    displayName: 'Parent Starter',
    price: 99,
    color: '#3b82f6',
    icon: Zap,
    features: [
      '50 exams per month',
      '50 explanations per month',
      '100 chat messages per day',
      'All CAPS subjects',
      'Interactive exercises',
      'Progress tracking',
      'Email support',
    ],
    limits: { exams: 50, explanations: 50, chat: 100 },
  },
  premium: {
    name: 'premium',
    displayName: 'Parent Plus',
    price: 199,
    color: '#8b5cf6',
    icon: Crown,
    features: [
      'Unlimited exams',
      'Unlimited explanations',
      'Unlimited chat',
      'All CAPS subjects',
      'Interactive exercises',
      'Advanced progress analytics',
      'Multiple children support',
      'Priority support',
      'Gamification features',
    ],
    limits: { exams: 999999, explanations: 999999, chat: 999999 },
  },
  school: {
    name: 'school',
    displayName: 'School Plan',
    price: 999,
    color: '#10b981',
    icon: School,
    features: [
      'Unlimited everything',
      'Multi-tenant management',
      'Teacher dashboards',
      'Class analytics',
      'Bulk student import',
      'Custom branding',
      'API access',
      'Dedicated support',
    ],
    limits: { exams: 999999, explanations: 999999, chat: 999999 },
  },
};

export default function SubscriptionPage() {
  const router = useRouter();
  const supabase = createClient();
  const { userId, userName, hasOrganization, tenantSlug } = useParentDashboardData();
  const { usage, refreshUsage } = useQuotaCheck(userId);

  const [currentTier, setCurrentTier] = useState<string>('free');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadSubscriptionData();
      refreshUsage();
    }
  }, [userId]);

  const loadSubscriptionData = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Get current tier
      const { data: tierData, error: tierError } = await supabase
        .from('user_ai_tiers')
        .select('tier')
        .eq('user_id', userId)
        .single();

      if (tierError) {
        console.error('[Subscription] Failed to fetch tier:', tierError);
      } else if (tierData) {
        setCurrentTier(tierData.tier || 'free');
      }

      // Get payment history
      const { data: subsData, error: subsError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (subsError) {
        console.error('[Subscription] Failed to fetch history:', subsError);
      } else if (subsData) {
        setSubscriptions(subsData);
      }
    } catch (error) {
      console.error('[Subscription] Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = (targetTier: string) => {
    // Redirect to pricing page with selected tier
    router.push(`/pricing?tier=${targetTier}`);
  };

  const tierInfo = TIER_INFO[currentTier] || TIER_INFO.free;
  const TierIcon = tierInfo.icon;

  return (
    <ParentShell
      userName={userName}
      preschoolName={hasOrganization ? undefined : undefined}
      hasOrganization={hasOrganization}
      tenantSlug={tenantSlug}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>
            Subscription & Billing
          </h1>
          <p style={{ color: 'var(--textMuted)', fontSize: '16px' }}>
            Manage your plan, view usage, and upgrade for more features
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
            <p style={{ color: 'var(--textMuted)' }}>Loading subscription data...</p>
          </div>
        ) : (
          <>
            {/* Current Plan Card */}
            <div
              style={{
                background: `linear-gradient(135deg, ${tierInfo.color}15, ${tierInfo.color}05)`,
                border: `2px solid ${tierInfo.color}40`,
                borderRadius: '16px',
                padding: '32px',
                marginBottom: '32px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: tierInfo.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <TierIcon size={28} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--textMuted)', marginBottom: '4px' }}>
                        Current Plan
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 800 }}>
                        {tierInfo.displayName}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px' }}>
                    R{tierInfo.price}
                    <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--textMuted)' }}>
                      /month
                    </span>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0 0' }}>
                    {tierInfo.features.map((feature, idx) => (
                      <li
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '8px',
                        }}
                      >
                        <CheckCircle size={16} color={tierInfo.color} />
                        <span style={{ fontSize: '14px' }}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {currentTier !== 'premium' && currentTier !== 'school' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
                    <button
                      onClick={() => handleUpgrade(currentTier === 'basic' ? 'premium' : 'basic')}
                      className="btn btnCyan"
                      style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        fontWeight: 700,
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <ArrowUpCircle size={20} />
                      Upgrade Plan
                    </button>
                    <p style={{ fontSize: '12px', color: 'var(--textMuted)', maxWidth: '200px', textAlign: 'right' }}>
                      Get more exams, explanations, and features
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Usage Stats */}
            {usage && (
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
                  Current Usage
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                  <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Calendar size={20} color="white" />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--textMuted)' }}>Exams</div>
                        <div style={{ fontSize: '20px', fontWeight: 700 }}>
                          {usage.exams_generated_this_month} / {tierInfo.limits.exams === 999999 ? '∞' : tierInfo.limits.exams}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '4px',
                        background: 'var(--cardBg)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, (usage.exams_generated_this_month / tierInfo.limits.exams) * 100)}%`,
                          height: '100%',
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                  </div>

                  <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Sparkles size={20} color="white" />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--textMuted)' }}>Explanations</div>
                        <div style={{ fontSize: '20px', fontWeight: 700 }}>
                          {usage.explanations_requested_this_month} / {tierInfo.limits.explanations === 999999 ? '∞' : tierInfo.limits.explanations}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '4px',
                        background: 'var(--cardBg)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, (usage.explanations_requested_this_month / tierInfo.limits.explanations) * 100)}%`,
                          height: '100%',
                          background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                  </div>

                  <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Zap size={20} color="white" />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--textMuted)' }}>Chat Today</div>
                        <div style={{ fontSize: '20px', fontWeight: 700 }}>
                          {usage.chat_messages_today} / {tierInfo.limits.chat === 999999 ? '∞' : tierInfo.limits.chat}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '4px',
                        background: 'var(--cardBg)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, (usage.chat_messages_today / tierInfo.limits.chat) * 100)}%`,
                          height: '100%',
                          background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment History */}
            {subscriptions.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
                  Payment History
                </h2>
                <div className="card" style={{ overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--cardBorder)' }}>
                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--textMuted)' }}>
                          Date
                        </th>
                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--textMuted)' }}>
                          Plan
                        </th>
                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--textMuted)' }}>
                          Amount
                        </th>
                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--textMuted)' }}>
                          Status
                        </th>
                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--textMuted)' }}>
                          Reference
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.map((sub) => {
                        const subTierInfo = TIER_INFO[sub.tier] || TIER_INFO.free;
                        return (
                          <tr key={sub.id} style={{ borderBottom: '1px solid var(--cardBorder)' }}>
                            <td style={{ padding: '16px', fontSize: '14px' }}>
                              {formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', fontWeight: 600 }}>
                              {subTierInfo.displayName}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', fontWeight: 700 }}>
                              R{sub.amount_paid || subTierInfo.price}
                            </td>
                            <td style={{ padding: '16px' }}>
                              <span
                                style={{
                                  padding: '4px 12px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  background: sub.status === 'active' ? '#10b98120' : '#6b728020',
                                  color: sub.status === 'active' ? '#10b981' : '#6b7280',
                                }}
                              >
                                {sub.status}
                              </span>
                            </td>
                            <td style={{ padding: '16px', fontSize: '12px', color: 'var(--textMuted)', fontFamily: 'monospace' }}>
                              {sub.payment_reference || 'N/A'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Available Upgrades */}
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
                Available Plans
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {Object.values(TIER_INFO)
                  .filter((tier) => tier.name !== currentTier && tier.name !== 'school')
                  .map((tier) => {
                    const Icon = tier.icon;
                    const isCurrent = tier.name === currentTier;
                    return (
                      <div
                        key={tier.name}
                        className="card"
                        style={{
                          padding: '24px',
                          border: isCurrent ? `2px solid ${tier.color}` : undefined,
                          opacity: isCurrent ? 0.6 : 1,
                          cursor: isCurrent ? 'default' : 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onClick={() => !isCurrent && handleUpgrade(tier.name)}
                      >
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: tier.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '16px',
                          }}
                        >
                          <Icon size={24} color="white" />
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
                          {tier.displayName}
                        </h3>
                        <div style={{ fontSize: '32px', fontWeight: 800, marginBottom: '16px' }}>
                          R{tier.price}
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--textMuted)' }}>
                            /mo
                          </span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px' }}>
                          {tier.features.slice(0, 5).map((feature, idx) => (
                            <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <CheckCircle size={14} color={tier.color} />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        {!isCurrent && (
                          <button
                            className="btn btnCyan"
                            style={{
                              width: '100%',
                              marginTop: '16px',
                              padding: '10px',
                              fontSize: '14px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                            }}
                          >
                            Select Plan <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </div>
    </ParentShell>
  );
}
