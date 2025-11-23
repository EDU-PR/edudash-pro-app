'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Phone,
  Mail,
  Calendar,
  User,
  Baby,
  Bell,
  Download,
  DollarSign,
  ArrowLeft,
} from 'lucide-react';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';

interface Registration {
  id: string;
  organization_id: string;
  organization_name?: string;
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  guardian_address: string;
  student_first_name: string;
  student_last_name: string;
  student_dob: string;
  student_gender: string;
  student_birth_certificate_url?: string;
  student_clinic_card_url?: string;
  guardian_id_document_url?: string;
  documents_uploaded: boolean;
  documents_deadline?: string;
  payment_reference?: string;
  registration_fee_amount?: number;
  registration_fee_paid: boolean;
  payment_method?: string;
  proof_of_payment_url?: string;
  campaign_applied?: string;
  discount_amount?: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export default function RegistrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [popVerified, setPopVerified] = useState(false);

  useEffect(() => {
    fetchRegistration();
  }, [params.id]);

  const fetchRegistration = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setRegistration(data);
    } catch (error) {
      console.error('Error fetching registration:', error);
      alert('Failed to load registration details');
      router.push('/dashboard/principal/registrations');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!registration) return;

    if (!confirm(`Approve registration for ${registration.student_first_name} ${registration.student_last_name}?`)) {
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // When approving, also verify payment if there's a proof of payment
      const updates: any = {
        status: 'approved',
        reviewed_by: user?.email,
        reviewed_date: new Date().toISOString(),
      };

      // If there's a proof of payment, mark it as verified
      if (registration.proof_of_payment_url) {
        updates.registration_fee_paid = true;
        updates.payment_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('registration_requests')
        .update(updates)
        .eq('id', registration.id);

      if (error) throw error;

      // Trigger sync to create student record
      await supabase.functions.invoke('sync-registration-to-edudash', {
        body: { registration_id: registration.id },
      });

      alert('Registration approved successfully!');
      router.push('/dashboard/principal/registrations');
    } catch (error) {
      console.error('Error approving registration:', error);
      alert('Failed to approve registration. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!registration) return;

    const reason = prompt(`Enter reason for rejecting ${registration.student_first_name} ${registration.student_last_name}'s registration:`);
    if (!reason) return;

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('registration_requests')
        .update({
          status: 'rejected',
          reviewed_by: user?.email,
          reviewed_date: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', registration.id);

      if (error) throw error;

      alert('Registration rejected.');
      router.push('/dashboard/principal/registrations');
    } catch (error) {
      console.error('Error rejecting registration:', error);
      alert('Failed to reject registration. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <PrincipalShell hideRightSidebar={true}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600"></div>
            <p className="mt-4 text-gray-400">Loading registration details...</p>
          </div>
        </div>
      </PrincipalShell>
    );
  }

  if (!registration) {
    return null;
  }

  return (
    <PrincipalShell hideRightSidebar={true}>
      <div className="section">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => router.push('/dashboard/principal/registrations')}
            className="btn btnSecondary"
            style={{ marginBottom: 16 }}
          >
            <ArrowLeft size={18} style={{ marginRight: 8 }} />
            Back to Registrations
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <h1 className="h1">Registration Details</h1>
              <p style={{ color: 'var(--muted)', marginTop: 4 }}>
                {registration.student_first_name} {registration.student_last_name}
              </p>
            </div>

            {registration.status === 'pending' && (
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleReject}
                  disabled={processing}
                  className="btn"
                  style={{ 
                    background: 'var(--red)', 
                    color: 'white',
                    opacity: processing ? 0.5 : 1 
                  }}
                >
                  <XCircle size={18} style={{ marginRight: 8 }} />
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={processing || !popVerified}
                  className="btn btnPrimary"
                  style={{ 
                    opacity: (processing || !popVerified) ? 0.5 : 1,
                    cursor: (!popVerified) ? 'not-allowed' : 'pointer'
                  }}
                  title={!popVerified ? 'Please verify proof of payment first' : 'Approve registration'}
                >
                  <CheckCircle2 size={18} style={{ marginRight: 8 }} />
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content Grid - Mobile: Stack, Tablet+: 2 columns */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr',
          gap: 16,
          marginBottom: 24 
        }} className="reg-detail-grid">
          {/* Student Information */}
          <div className="card">
            <h3 className="sectionTitle" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Baby size={20} color="var(--primary)" />
              Student Information
            </h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</div>
                <div style={{ marginTop: 6, fontSize: 15, fontWeight: 500 }}>
                  {registration.student_first_name} {registration.student_last_name}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date of Birth</div>
                <div style={{ marginTop: 6, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} color="var(--muted)" />
                  {new Date(registration.student_dob).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gender</div>
                <div style={{ marginTop: 6, fontSize: 15, textTransform: 'capitalize' }}>
                  {registration.student_gender || 'Not specified'}
                </div>
              </div>
            </div>
          </div>

          {/* Guardian Information */}
          <div className="card">
            <h3 className="sectionTitle" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={20} color="var(--primary)" />
              Guardian Information
            </h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</div>
                <div style={{ marginTop: 6, fontSize: 15, fontWeight: 500 }}>
                  {registration.guardian_name}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</div>
                <div style={{ marginTop: 6, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={16} color="var(--muted)" />
                  {registration.guardian_email}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</div>
                <div style={{ marginTop: 6, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Phone size={16} color="var(--muted)" />
                  {registration.guardian_phone}
                </div>
              </div>
            </div>
          </div>

          {/* Registration Details */}
          <div className="card">
            <h3 className="sectionTitle" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={20} color="var(--primary)" />
              Registration Details
            </h3>
            <div style={{ display: 'grid', gap: 16 }}>
              {registration.payment_reference && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Reference</div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>
                    {registration.payment_reference}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 20,
                    background: registration.status === 'pending' ? '#fef3c7' : registration.status === 'approved' ? '#d1fae5' : '#fee2e2',
                    color: registration.status === 'pending' ? '#92400e' : registration.status === 'approved' ? '#065f46' : '#991b1b'
                  }}>
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      marginRight: 8,
                      background: registration.status === 'pending' ? '#f59e0b' : registration.status === 'approved' ? '#10b981' : '#ef4444'
                    }} />
                    {registration.status}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registration Date</div>
                <div style={{ marginTop: 6, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} color="var(--muted)" />
                  {new Date(registration.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registration Fee</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
                  R150
                </div>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="card">
            <h3 className="sectionTitle" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={20} color="var(--primary)" />
              Payment Status
            </h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Received</div>
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 500,
                    borderRadius: 8,
                    background: registration.registration_fee_paid ? '#d1fae5' : '#fee2e2',
                    color: registration.registration_fee_paid ? '#065f46' : '#991b1b'
                  }}>
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: registration.registration_fee_paid ? '#10b981' : '#ef4444'
                    }} />
                    {registration.registration_fee_paid ? 'Paid' : 'No Payment'}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proof of Payment</div>
                <div style={{ marginTop: 6 }}>
                  {registration.proof_of_payment_url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {popVerified ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 12px',
                          fontSize: 13,
                          fontWeight: 500,
                          borderRadius: 8,
                          background: '#d1fae5',
                          color: '#065f46'
                        }}>
                          <CheckCircle2 size={16} />
                          Verified
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 12px',
                          fontSize: 13,
                          fontWeight: 500,
                          borderRadius: 8,
                          background: '#fef3c7',
                          color: '#92400e'
                        }}>
                          <Clock size={16} />
                          Pending Verification
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      borderRadius: 8,
                      background: '#fee2e2',
                      color: '#991b1b'
                    }}>
                      <XCircle size={16} />
                      Not Uploaded
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Proof of Payment Section - Full Width */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 className="sectionTitle" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={20} color="var(--primary)" />
              Proof of Payment
            </h3>
            {registration.proof_of_payment_url && popVerified && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 20,
                background: '#d1fae5',
                color: '#065f46'
              }}>
                <CheckCircle2 size={18} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Verified</span>
              </div>
            )}
          </div>

          {registration.proof_of_payment_url ? (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* POP Image Preview */}
              <div style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                border: '2px solid var(--border)',
                background: '#000'
              }}>
                <img
                  src={registration.proof_of_payment_url}
                  alt="Proof of Payment"
                  style={{
                    width: '100%',
                    height: 'auto',
                    objectFit: 'contain',
                    maxHeight: '600px'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => window.open(registration.proof_of_payment_url, '_blank')}
                    className="btn"
                    style={{ background: 'var(--primary)' }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View Full Size
                  </button>
                  {!popVerified && registration.status === 'pending' && (
                    <button
                      onClick={() => setPopVerified(true)}
                      className="btn"
                      style={{ background: 'var(--green)' }}
                    >
                      <CheckCircle2 size={16} style={{ marginRight: 8 }} />
                      Verify Payment
                    </button>
                  )}
                </div>
              </div>

              {/* Warning if not verified */}
              {!popVerified && registration.status === 'pending' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 16,
                  borderRadius: 12,
                  border: '2px solid #fbbf24',
                  background: 'rgba(251, 191, 36, 0.1)'
                }}>
                  <div style={{
                    flexShrink: 0,
                    padding: 8,
                    background: '#f59e0b',
                    borderRadius: 8
                  }}>
                    <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24' }}>Payment Verification Required</h4>
                    <p style={{ marginTop: 4, fontSize: 13, color: '#fcd34d' }}>
                      Please verify the proof of payment before approving this registration.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 48,
              textAlign: 'center',
              borderRadius: 12,
              border: '2px dashed var(--border)',
              background: 'rgba(0,0,0,0.2)'
            }}>
              <div style={{
                padding: 16,
                background: 'var(--card)',
                borderRadius: '50%',
                marginBottom: 16
              }}>
                <FileText size={48} color="var(--muted)" />
              </div>
              <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Proof of Payment</h4>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                The parent has not uploaded proof of payment yet.
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 8,
                border: '2px solid #ef4444',
                background: 'rgba(239, 68, 68, 0.1)'
              }}>
                <XCircle size={20} color="#ef4444" />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#ef4444' }}>
                  Cannot approve without payment verification
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .reg-detail-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        
        @media (min-width: 768px) {
          .reg-detail-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
        }
        
        @media (min-width: 1024px) {
          .reg-detail-grid {
            gap: 24px;
          }
        }
      `}</style>
    </PrincipalShell>
  );
}
