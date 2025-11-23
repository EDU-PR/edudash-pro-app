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
  ShieldCheck,
  Trash2,
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
  payment_verified?: boolean;
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
      
      // If payment is already verified, set popVerified to true
      if (data.registration_fee_paid) {
        setPopVerified(true);
      }
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

      // Only update status - payment should already be verified
      const updates: any = {
        status: 'approved',
        reviewed_by: user?.email,
        reviewed_date: new Date().toISOString(),
      };

      // Update local EduDashPro database
      const { error } = await supabase
        .from('registration_requests')
        .update(updates)
        .eq('id', registration.id);

      if (error) throw error;

      // Trigger sync to create parent account and student record
      console.log('Triggering sync for registration:', registration.id);
      const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-registration-to-edudash', {
        body: { registration_id: registration.id },
      });

      console.log('Sync result:', syncResult);
      console.log('Sync error:', syncError);

      // Check if sync was successful
      if (syncError || (syncResult && !syncResult.success)) {
        const errorMessage = syncError?.message || syncResult?.error || 'Unknown error';
        console.error('Sync failed:', errorMessage);
        
        // Show error but don't block the approval
        alert(`⚠️ Registration approved locally.\n\nHowever, parent account creation ${syncError ? 'failed' : 'may have failed'}:\n${errorMessage}\n\nYou may need to create the parent account manually.`);
      } else {
        alert('✅ Registration approved successfully!\n\nParent account created and welcome email sent.');
      }

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
          registration_fee_paid: false, // Clear payment status when rejecting
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

  const handleVerifyPayment = async (verify: boolean) => {
    if (!registration) return;

    const action = verify ? 'verify' : 'remove verification for';
    if (!confirm(`${verify ? 'Verify' : 'Remove verification for'} payment for ${registration.student_first_name} ${registration.student_last_name}?`)) {
      return;
    }

    setProcessing(true);
    try {
      // Update directly using client (RLS will handle permissions)
      const updateData: any = {
        payment_verified: verify,
        payment_date: verify ? new Date().toISOString() : null,
      };
      
      if (verify) {
        updateData.registration_fee_paid = true;
      }

      const { error } = await supabase
        .from('registration_requests')
        .update(updateData)
        .eq('id', registration.id);

      if (error) throw error;

      // Also update students table if exists
      await supabase
        .from('students')
        .update(updateData)
        .eq('organization_id', registration.organization_id)
        .ilike('first_name', registration.student_first_name)
        .ilike('last_name', registration.student_last_name);

      alert(`Payment ${verify ? 'verified' : 'verification removed'}!`);
      await fetchRegistration();
    } catch (error: any) {
      console.error(`Error ${action}ing payment:`, error);
      alert(`Failed to ${action} payment. Please try again.`);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!registration) return;

    const reason = prompt(`⚠️ WARNING: This will DELETE the student and potentially their parent account.

Enter reason for deletion:
(This will be sent to the parent)`);
    if (!reason) return;

    if (!confirm(`🚨 FINAL CONFIRMATION 🚨

This will:
- Delete ${registration.student_first_name} ${registration.student_last_name}
- Delete the registration record
- Potentially delete the parent's account if no other students
- Send an email notification

Type 'DELETE' to confirm this cannot be undone.`)) {
      return;
    }

    setProcessing(true);
    try {
      // First, find the student ID from the approved registration
      const { data: students, error: findError } = await supabase
        .from('students')
        .select('id, parent_user_id')
        .eq('organization_id', registration.organization_id)
        .ilike('first_name', registration.student_first_name)
        .ilike('last_name', registration.student_last_name);

      if (findError || !students || students.length === 0) {
        throw new Error('Student not found in database. They may not have been approved yet.');
      }

      const studentId = students[0].id;

      // Call delete API
      const response = await fetch('/api/students/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, reason }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete student');
      }

      alert(`✅ ${result.message}\n\nParent email: ${result.parentEmail}\nAccount deleted: ${result.accountDeleted ? 'Yes' : 'No (has other students)'}`);
      
      // Delete the registration request too
      await supabase
        .from('registration_requests')
        .delete()
        .eq('id', registration.id);

      router.push('/dashboard/principal/registrations');
    } catch (error: any) {
      console.error('Error deleting student:', error);
      alert(`❌ Error: ${error.message}`);
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

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {registration.status === 'approved' && registration.proof_of_payment_url && !registration.payment_verified && (
                <button
                  onClick={() => handleVerifyPayment(true)}
                  disabled={processing}
                  className="btn"
                  style={{ 
                    background: '#f59e0b',
                    color: 'white',
                    opacity: processing ? 0.5 : 1 
                  }}
                >
                  <ShieldCheck size={18} style={{ marginRight: 8 }} />
                  Verify Payment
                </button>
              )}
              {registration.status === 'approved' && registration.payment_verified && (
                <button
                  onClick={() => handleVerifyPayment(false)}
                  disabled={processing}
                  className="btn"
                  style={{ 
                    background: '#6b7280',
                    color: 'white',
                    opacity: processing ? 0.5 : 1 
                  }}
                >
                  <XCircle size={18} style={{ marginRight: 8 }} />
                  Unverify Payment
                </button>
              )}
              {registration.status === 'approved' && (
                <button
                  onClick={handleDeleteStudent}
                  disabled={processing}
                  className="btn"
                  style={{ 
                    background: '#dc2626',
                    color: 'white',
                    opacity: processing ? 0.5 : 1 
                  }}
                >
                  <Trash2 size={18} style={{ marginRight: 8 }} />
                  Delete Student
                </button>
              )}
              {registration.status === 'pending' && (
                <>
                  {registration.proof_of_payment_url && registration.registration_fee_paid && !registration.payment_verified && (
                    <button
                      onClick={() => handleVerifyPayment(true)}
                      disabled={processing}
                      className="btn"
                      style={{ 
                        background: '#f59e0b',
                        color: 'white',
                        opacity: processing ? 0.5 : 1 
                      }}
                    >
                      <ShieldCheck size={18} style={{ marginRight: 8 }} />
                      Verify Payment
                    </button>
                  )}
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
                    disabled={processing || !registration.payment_verified}
                    className="btn btnPrimary"
                    style={{ 
                      opacity: (processing || !registration.payment_verified) ? 0.5 : 1,
                      cursor: (!registration.payment_verified) ? 'not-allowed' : 'pointer'
                    }}
                    title={!registration.payment_verified ? 'Please verify payment first' : 'Approve registration'}
                  >
                    <CheckCircle2 size={18} style={{ marginRight: 8 }} />
                    Approve
                  </button>
                </>
              )}
            </div>
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
                  R{registration.registration_fee_amount || 200}
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
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Status</div>
                <div style={{ marginTop: 6 }}>
                  {registration.payment_verified && registration.status !== 'rejected' ? (
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
                      <ShieldCheck size={16} />
                      Verified
                    </span>
                  ) : registration.registration_fee_paid && registration.status !== 'rejected' ? (
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
                      Paid (Pending)
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
                      background: '#fee2e2',
                      color: '#991b1b'
                    }}>
                      <XCircle size={16} />
                      No Payment
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proof of Payment</div>
                <div style={{ marginTop: 6 }}>
                  {registration.proof_of_payment_url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {registration.payment_verified ? (
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
            {registration.proof_of_payment_url && registration.payment_verified && (
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
                  {!registration.payment_verified && (
                    <button
                      onClick={() => handleVerifyPayment(true)}
                      disabled={processing}
                      className="btn"
                      style={{ 
                        background: '#f59e0b',
                        color: 'white',
                        opacity: processing ? 0.5 : 1 
                      }}
                    >
                      <ShieldCheck size={16} style={{ marginRight: 8 }} />
                      Verify Payment
                    </button>
                  )}
                  {registration.payment_verified && (
                    <button
                      onClick={() => handleVerifyPayment(false)}
                      disabled={processing}
                      className="btn"
                      style={{ 
                        background: '#6b7280',
                        color: 'white',
                        opacity: processing ? 0.5 : 1 
                      }}
                    >
                      <XCircle size={16} style={{ marginRight: 8 }} />
                      Unverify Payment
                    </button>
                  )}
                </div>
              </div>

              {/* Warning if not verified */}
              {!registration.payment_verified && registration.status === 'pending' && (
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
