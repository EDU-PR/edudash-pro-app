/* eslint-disable i18next/no-literal-string */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { SubPageHeader } from '@/components/dashboard/SubPageHeader';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, CreditCard, FileText } from 'lucide-react';

interface PaymentMethod {
  id: string;
  method_name: string;
  display_name: string;
  processing_fee: number;
  fee_type: string;
  description?: string | null;
  instructions?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  branch_code?: string | null;
  preferred: boolean;
}

const formatCurrency = (amount: number) => `R ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;

export default function PaymentFlowPage() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const childId = searchParams.get('childId') || '';
  const childName = searchParams.get('childName') || '';
  const studentCode = searchParams.get('studentCode') || '';
  const feeId = searchParams.get('feeId') || '';
  const feeAmountParam = searchParams.get('feeAmount') || '0';
  const feeDescription = searchParams.get('feeDescription') || 'School Fees';
  const feeDueDate = searchParams.get('feeDueDate') || '';
  const preschoolId = searchParams.get('preschoolId') || '';
  const preschoolName = searchParams.get('preschoolName') || '';

  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const { slug } = useTenantSlug(userId);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const amount = useMemo(() => {
    const parsed = Number.parseFloat(feeAmountParam);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [feeAmountParam]);

  const preferredMethod = useMemo(() => {
    if (paymentMethods.length === 0) return null;
    return paymentMethods.find((method) => method.preferred) || paymentMethods[0];
  }, [paymentMethods]);

  const copyValue = useCallback(async (value: string, field: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // Ignore clipboard errors (unsupported browser)
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setEmail(session.user.email || '');
      setUserId(session.user.id);

      if (preschoolId) {
        const { data } = await supabase
          .from('organization_payment_methods')
          .select('*')
          .eq('organization_id', preschoolId)
          .eq('active', true)
          .order('preferred', { ascending: false });

        setPaymentMethods((data || []) as PaymentMethod[]);
      }

      setLoading(false);
    })();
  }, [preschoolId, router, supabase]);

  return (
    <ParentShell tenantSlug={slug} userEmail={email} preschoolName={preschoolName}>
      <div style={{ margin: 'calc(var(--space-3) * -1) calc(var(--space-2) * -1)', padding: 0 }}>
        <SubPageHeader
          title="Make a Payment"
          subtitle={preschoolName || 'School payment flow'}
          icon={<CreditCard size={28} color="white" />}
        />

        <div style={{ width: '100%', padding: 20 }}>
          <button
            onClick={() => router.push('/dashboard/parent/payments')}
            className="btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 20,
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            Back to Payments
          </button>

          {loading ? (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
              <p className="muted" style={{ marginTop: 12 }}>Loading payment details…</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Payment Summary</div>
                <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="muted">For</span>
                    <span>{feeDescription}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="muted">Child</span>
                    <span>{childName || 'N/A'}</span>
                  </div>
                  {feeDueDate && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">Due date</span>
                      <span>{new Date(feeDueDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Total</span>
                    <span>{formatCurrency(amount)}</span>
                  </div>
                </div>
                {studentCode && (
                  <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'rgba(59,130,246,0.08)' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Payment Reference</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{studentCode}</span>
                      <button
                        className="btn btnSecondary"
                        onClick={() => copyValue(studentCode, 'reference')}
                        style={{ padding: '6px 10px', fontSize: 12 }}
                      >
                        {copiedField === 'reference' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        {copiedField === 'reference' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Banking Details</div>
                {preferredMethod?.bank_name ? (
                  <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span className="muted">Bank</span>
                      <span>{preferredMethod.bank_name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span className="muted">Account Number</span>
                      <span style={{ fontWeight: 600 }}>{preferredMethod.account_number || 'N/A'}</span>
                    </div>
                    {preferredMethod.branch_code && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span className="muted">Branch Code</span>
                        <span>{preferredMethod.branch_code}</span>
                      </div>
                    )}
                    {preferredMethod.instructions && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                        {preferredMethod.instructions}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
                    <AlertCircle size={16} />
                    No banking details available. Please contact the school.
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Next Steps</div>
                <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 13, color: 'var(--muted)' }}>
                  <li>Open your banking app and make the transfer.</li>
                  <li>Use the payment reference exactly as shown above.</li>
                  <li>Upload proof of payment once done.</li>
                </ol>
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button
                    className="btn btnPrimary"
                    onClick={() => router.push(`/dashboard/parent/payments/pop-upload?child=${childId}&feeId=${feeId}`)}
                  >
                    <FileText size={16} />
                    Upload Proof of Payment
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ParentShell>
  );
}
