'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { DollarSign, TrendingUp, TrendingDown, Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface FinancialMetrics {
  totalRevenue: number;
  paidCount: number;
  pendingCount: number;
  pendingAmount: number;
}

interface Payment {
  id: string;
  student_first_name: string;
  student_last_name: string;
  registration_fee_amount: number;
  registration_fee_paid: boolean;
  payment_date: string | null;
  created_at: string;
}

export default function FinancialsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    totalRevenue: 0,
    paidCount: 0,
    pendingCount: 0,
    pendingAmount: 0,
  });
  const [payments, setPayments] = useState<Payment[]>([]);

  const { profile } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const preschoolName = profile?.preschoolName;
  const preschoolId = profile?.preschoolId;

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
    };
    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (!preschoolId) {
      console.log('Waiting for preschoolId...');
      return;
    }

    const loadFinancials = async () => {
      setLoading(true);
      try {
        // Load all registration requests
        const { data: registrations, error } = await supabase
          .from('registration_requests')
          .select('id, student_first_name, student_last_name, registration_fee_amount, registration_fee_paid, payment_date, created_at')
          .eq('preschool_id', preschoolId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading financials:', error);
          setLoading(false);
          return;
        }

        if (registrations) {
          const paid = registrations.filter(r => r.registration_fee_paid);
          const pending = registrations.filter(r => !r.registration_fee_paid && r.registration_fee_amount);

          const totalRevenue = paid.reduce((sum, r) => sum + (parseFloat(r.registration_fee_amount as any) || 0), 0);
          const pendingAmount = pending.reduce((sum, r) => sum + (parseFloat(r.registration_fee_amount as any) || 0), 0);

          setMetrics({
            totalRevenue,
            paidCount: paid.length,
            pendingCount: pending.length,
            pendingAmount,
          });

          setPayments(registrations as Payment[]);
        }
      } catch (error) {
        console.error('Error loading financials:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFinancials();
  }, [preschoolId, supabase]);

  if (loading) {
    return (
      <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId} hideRightSidebar={true}>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400">Loading financials...</p>
        </div>
      </PrincipalShell>
    );
  }

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId} hideRightSidebar={true}>
      <div className="section">
        <h1 className="h1">Financial Dashboard</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
          Track registration fees and payments
        </p>

        <div className="grid2" style={{ marginBottom: 24 }}>
          <div className="card tile">
            <div className="metricValue" style={{ color: '#10b981' }}>
              R{metrics.totalRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="metricLabel">Total Revenue</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              {metrics.paidCount} payments received
            </div>
          </div>
          <div className="card tile">
            <div className="metricValue" style={{ color: '#f59e0b' }}>
              R{metrics.pendingAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="metricLabel">Pending Payments</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              {metrics.pendingCount} outstanding
            </div>
          </div>
          <div className="card tile">
            <div className="metricValue">{metrics.paidCount + metrics.pendingCount}</div>
            <div className="metricLabel">Total Registrations</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              {metrics.paidCount} paid, {metrics.pendingCount} pending
            </div>
          </div>
          <div className="card tile">
            <div className="metricValue" style={{ color: metrics.pendingCount === 0 ? '#10b981' : '#f59e0b' }}>
              {metrics.paidCount > 0 ? Math.round((metrics.paidCount / (metrics.paidCount + metrics.pendingCount)) * 100) : 0}%
            </div>
            <div className="metricLabel">Collection Rate</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Payment success rate
            </div>
          </div>
        </div>

        <div className="sectionTitle">Recent Transactions</div>
        {payments.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <DollarSign size={48} style={{ margin: '0 auto 16px', color: 'var(--muted)' }} />
            <h3 style={{ marginBottom: 8 }}>No transactions yet</h3>
            <p style={{ color: 'var(--muted)' }}>
              Registration payments will appear here
            </p>
          </div>
        ) : (
          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
                      Student Name
                    </th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
                      Amount
                    </th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
                      Status
                    </th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 500 }}>{payment.student_first_name} {payment.student_last_name}</div>
                      </td>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 600 }}>
                          R{parseFloat(payment.registration_fee_amount as any || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td style={{ padding: 12 }}>
                        {payment.registration_fee_paid ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 12px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: '#10b98120',
                            color: '#10b981',
                          }}>
                            <CheckCircle size={14} />
                            Paid
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 12px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: '#f59e0b20',
                            color: '#f59e0b',
                          }}>
                            <Clock size={14} />
                            Pending
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 12, color: 'var(--muted)', fontSize: 14 }}>
                        {payment.payment_date 
                          ? new Date(payment.payment_date).toLocaleDateString('en-ZA')
                          : new Date(payment.created_at).toLocaleDateString('en-ZA')
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PrincipalShell>
  );
}
