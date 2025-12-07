'use client';

import Link from 'next/link';
import { useState, FormEvent } from 'react';

interface RequestData {
  fullName: string;
  email: string;
  role: string;
  preschool: string;
  deletionTypes: string[];
  reason: string;
  timestamp: string;
  requestId: string;
}

function generateRequestId(): string {
  return 'DEL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

export default function DataDeletionPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: '',
    preschool: '',
    reason: '',
  });
  const [deletionTypes, setDeletionTypes] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestData, setRequestData] = useState<RequestData | null>(null);
  const [error, setError] = useState('');

  const handleDeletionTypeChange = (value: string, checked: boolean) => {
    if (value === 'full_account' && checked) {
      const confirmed = window.confirm(
        '⚠️ WARNING: Full account deletion will permanently remove all your data and you will lose access to EduDash Pro. Are you sure?'
      );
      if (!confirmed) return;
    }
    setDeletionTypes(prev =>
      checked ? [...prev, value] : prev.filter(t => t !== value)
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (deletionTypes.length === 0) {
      setError('Please select at least one type of data to delete.');
      return;
    }

    if (!consent) {
      setError('You must read and consent to the deletion process.');
      return;
    }

    const data: RequestData = {
      fullName: formData.fullName,
      email: formData.email,
      role: formData.role,
      preschool: formData.preschool || 'Not provided',
      deletionTypes,
      reason: formData.reason || 'Not provided',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    };

    setRequestData(data);

    // Send via mailto
    const subject = encodeURIComponent(`Data Deletion Request - ${data.requestId}`);
    const body = encodeURIComponent(
      `Data Deletion Request\n\n` +
      `Request ID: ${data.requestId}\n` +
      `Timestamp: ${data.timestamp}\n\n` +
      `User Information:\n` +
      `- Name: ${data.fullName}\n` +
      `- Email: ${data.email}\n` +
      `- Role: ${data.role}\n` +
      `- Preschool: ${data.preschool}\n\n` +
      `Deletion Requested For:\n` +
      `${data.deletionTypes.map(type => `- ${type.replace(/_/g, ' ')}`).join('\n')}\n\n` +
      `Reason:\n${data.reason}\n\n` +
      `---\n` +
      `JSON Format (for processing):\n` +
      JSON.stringify(data, null, 2)
    );

    window.location.href = `mailto:privacy@edudashpro.org.za?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  const copyJSON = () => {
    if (requestData) {
      navigator.clipboard.writeText(JSON.stringify(requestData, null, 2)).then(() => {
        alert('✅ Request details copied to clipboard!');
      }).catch(() => {
        alert('❌ Failed to copy. Please select and copy manually.');
      });
    }
  };

  const downloadJSON = () => {
    if (requestData) {
      const jsonText = JSON.stringify(requestData, null, 2);
      const blob = new Blob([jsonText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edudash-deletion-request-${requestData.requestId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const styles = {
    container: { minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'system-ui, sans-serif' },
    header: { padding: '20px 24px', borderBottom: '1px solid #1f1f23' },
    backLink: { color: '#00f5ff', textDecoration: 'none', fontSize: 16, fontWeight: 600 },
    main: { maxWidth: 800, margin: '0 auto', padding: '40px 24px' },
    title: { fontSize: 36, fontWeight: 700, marginBottom: 10, color: '#00f5ff' } as const,
    subtitle: { color: '#9CA3AF', lineHeight: 1.6, marginBottom: 24 },
    section: { marginBottom: 40 },
    h2: { fontSize: 24, fontWeight: 600, marginBottom: 16, color: '#00f5ff', marginTop: 32 } as const,
    h3: { fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 12 } as const,
    text: { color: '#9CA3AF', lineHeight: 1.6, marginBottom: 12 },
    infoBox: { background: 'rgba(0, 245, 255, 0.05)', padding: 20, borderRadius: 8, margin: '20px 0', borderLeft: '4px solid #00f5ff' },
    warningBox: { background: 'rgba(255, 170, 0, 0.05)', padding: 20, borderRadius: 8, margin: '20px 0', borderLeft: '4px solid #ffaa00' },
    warningText: { color: '#ffaa00' },
    timeline: { background: 'rgba(0, 245, 255, 0.05)', padding: 24, borderRadius: 8, margin: '24px 0' },
    timelineItem: { display: 'flex', gap: 16, marginBottom: 16 } as const,
    timelineNumber: { background: '#00f5ff', color: '#0a0a0f', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 } as const,
    formGroup: { marginBottom: 24 },
    label: { display: 'block', marginBottom: 8, fontWeight: 500 },
    required: { color: '#ff4444' },
    input: { width: '100%', padding: 12, background: '#0a0a0f', border: '2px solid #2a2a3a', borderRadius: 8, color: '#fff', fontSize: 16 },
    select: { width: '100%', padding: 12, background: '#0a0a0f', border: '2px solid #2a2a3a', borderRadius: 8, color: '#fff', fontSize: 16 },
    textarea: { width: '100%', padding: 12, background: '#0a0a0f', border: '2px solid #2a2a3a', borderRadius: 8, color: '#fff', fontSize: 16, minHeight: 120, resize: 'vertical' as const },
    checkboxGroup: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
    checkboxItem: { display: 'flex', alignItems: 'flex-start', gap: 12 },
    checkbox: { width: 20, height: 20, marginTop: 2, cursor: 'pointer' },
    button: { background: '#00f5ff', color: '#0a0a0f', padding: '14px 32px', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
    secondaryButton: { background: '#1a1a24', color: '#fff', padding: '14px 32px', border: '2px solid #2a2a3a', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
    buttonGroup: { display: 'flex', gap: 16, marginTop: 32, flexWrap: 'wrap' as const },
    errorMessage: { background: 'rgba(255, 68, 68, 0.1)', border: '2px solid #ff4444', padding: 16, borderRadius: 8, marginTop: 16, color: '#ff4444' },
    successBox: { background: 'rgba(0, 255, 136, 0.1)', border: '2px solid #00ff88', padding: 20, borderRadius: 8, marginTop: 24 },
    successTitle: { color: '#00ff88', marginTop: 0 },
    jsonOutput: { background: '#0a0a0f', padding: 16, borderRadius: 8, border: '1px solid #2a2a3a', fontFamily: 'Courier New, monospace', fontSize: 14, overflowX: 'auto' as const, marginTop: 16, color: '#9CA3AF', whiteSpace: 'pre-wrap' as const },
    footer: { marginTop: 60, paddingTop: 24, borderTop: '1px solid #1f1f23', color: '#6B7280', textAlign: 'center' as const },
    list: { color: '#9CA3AF', lineHeight: 1.8, paddingLeft: 20, marginBottom: 16 },
    small: { color: '#6B7280', fontSize: 14, marginTop: 4 },
    hr: { margin: '40px 0', border: 'none', borderTop: '1px solid #2a2a3a' },
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link href="/" style={styles.backLink}>
          ← Back to Home
        </Link>
      </header>

      <main style={styles.main}>
        <h1 style={styles.title}>🗑️ Data Deletion Request</h1>
        <p style={styles.subtitle}>
          We respect your right to data privacy. Use this form to request deletion of your personal data from EduDash Pro in accordance with GDPR, POPIA, and COPPA regulations.
        </p>

        <div style={styles.infoBox}>
          <h3 style={styles.h3}>Before You Begin</h3>
          <p style={styles.text}>
            Please read our <Link href="/privacy" style={{ color: '#00f5ff' }}>Privacy Policy</Link> to understand what data we collect and how we use it.
          </p>
        </div>

        <div style={styles.warningBox}>
          <h3 style={{ ...styles.h3, color: '#ffaa00', marginTop: 0 }}>⚠️ Important Information</h3>
          <ul style={{ ...styles.list, color: '#ffaa00' }}>
            <li><strong>30-Day Grace Period:</strong> Your data will be marked for deletion but can be recovered within 30 days if you change your mind.</li>
            <li><strong>Permanent Deletion:</strong> After 30 days, your data will be permanently deleted from our active systems.</li>
            <li><strong>Legal Requirements:</strong> Some data (financial records, security logs) must be retained for legal compliance (up to 7 years).</li>
            <li><strong>Account Deletion:</strong> If you request full account deletion, you will lose access to all EduDash Pro services.</li>
          </ul>
        </div>

        <h2 style={styles.h2}>What Happens Next?</h2>
        <div style={styles.timeline}>
          {[
            { num: 1, title: 'Identity Verification', desc: 'We will verify your identity via email (typically within 72 hours)' },
            { num: 2, title: 'Confirmation Email', desc: "You'll receive a confirmation link to authorize the deletion" },
            { num: 3, title: '30-Day Grace Period', desc: 'Data marked for deletion but recoverable if you contact us' },
            { num: 4, title: 'Permanent Deletion', desc: 'After 30 days, data is permanently removed from active systems' },
            { num: 5, title: 'Final Confirmation', desc: "You'll receive an email confirming the deletion is complete" },
          ].map(item => (
            <div key={item.num} style={styles.timelineItem}>
              <div style={styles.timelineNumber}>{item.num}</div>
              <div>
                <strong>{item.title}</strong><br />
                <span style={{ color: '#9CA3AF' }}>{item.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {!submitted ? (
          <>
            <h2 style={styles.h2}>Deletion Request Form</h2>
            <form onSubmit={handleSubmit}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Full Name <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="First and Last Name"
                  value={formData.fullName}
                  onChange={e => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Email Address <span style={styles.required}>*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  style={styles.input}
                />
                <p style={styles.small}>Must match the email associated with your EduDash Pro account</p>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  User Role <span style={styles.required}>*</span>
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  style={styles.select}
                >
                  <option value="">-- Select Your Role --</option>
                  <option value="principal">Principal / School Administrator</option>
                  <option value="teacher">Teacher</option>
                  <option value="parent">Parent / Guardian</option>
                  <option value="student">Student (submitted by parent/guardian)</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Preschool / Organization Name (Optional)</label>
                <input
                  type="text"
                  placeholder="Name of your preschool"
                  value={formData.preschool}
                  onChange={e => setFormData(prev => ({ ...prev, preschool: e.target.value }))}
                  style={styles.input}
                />
                <p style={styles.small}>Helps us locate your account faster</p>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  What data would you like to delete? <span style={styles.required}>*</span>
                </label>
                <div style={styles.checkboxGroup}>
                  {[
                    { value: 'full_account', label: 'Full Account Deletion', desc: 'Delete my entire account and all associated data (you will lose access to EduDash Pro)' },
                    { value: 'voice_recordings', label: 'Voice Recordings', desc: 'Delete my voice recordings and audio cache' },
                    { value: 'ai_conversations', label: 'AI Conversations', desc: 'Delete my conversation history with Dash AI assistant' },
                    { value: 'uploaded_files', label: 'Uploaded Files', desc: "Delete photos, documents, and files I've uploaded" },
                    { value: 'analytics_data', label: 'Analytics Data', desc: 'Delete usage analytics and app activity logs' },
                    { value: 'other', label: 'Other', desc: 'Specify in the reason below' },
                  ].map(item => (
                    <div key={item.value} style={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        id={item.value}
                        checked={deletionTypes.includes(item.value)}
                        onChange={e => handleDeletionTypeChange(item.value, e.target.checked)}
                        style={styles.checkbox}
                      />
                      <label htmlFor={item.value} style={{ cursor: 'pointer', marginBottom: 0 }}>
                        <strong>{item.label}</strong> - {item.desc}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Reason for Deletion (Optional)</label>
                <textarea
                  placeholder="Please tell us why you're requesting data deletion. This helps us improve our service."
                  value={formData.reason}
                  onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  style={styles.textarea}
                />
              </div>

              <div style={styles.formGroup}>
                <div style={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    id="consent"
                    checked={consent}
                    onChange={e => setConsent(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <label htmlFor="consent" style={{ cursor: 'pointer', marginBottom: 0 }}>
                    <strong>I understand and consent <span style={styles.required}>*</span></strong><br />
                    I confirm that I am the account owner or authorized representative, and I understand that:
                    <ul style={{ ...styles.list, marginTop: 8 }}>
                      <li>My data will be marked for deletion immediately</li>
                      <li>I have 30 days to recover my data before permanent deletion</li>
                      <li>Some data may be retained for legal compliance</li>
                      <li>If I delete my full account, I will lose access to all services</li>
                    </ul>
                  </label>
                </div>
              </div>

              {error && <div style={styles.errorMessage}>❌ {error}</div>}

              <div style={styles.buttonGroup}>
                <button type="submit" style={styles.button}>Submit Deletion Request</button>
                <Link href="/privacy" style={{ ...styles.secondaryButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  View Privacy Policy
                </Link>
              </div>
            </form>
          </>
        ) : (
          <div style={styles.successBox}>
            <h3 style={styles.successTitle}>✅ Request Submitted Successfully!</h3>
            <p style={styles.text}>Your data deletion request has been submitted. Here&apos;s what happens next:</p>
            <ul style={styles.list}>
              <li>You will receive a verification email within 72 hours to <strong>{requestData?.email}</strong></li>
              <li>Click the link in the email to confirm your identity and authorize the deletion</li>
              <li>Your data will be marked for deletion with a 30-day grace period</li>
              <li>You&apos;ll receive a final confirmation email when the deletion is complete</li>
            </ul>

            <h3 style={styles.h3}>Your Request Details:</h3>
            <div style={styles.jsonOutput}>{JSON.stringify(requestData, null, 2)}</div>

            <div style={styles.buttonGroup}>
              <button onClick={copyJSON} style={styles.button}>📋 Copy Request Details</button>
              <button onClick={downloadJSON} style={styles.secondaryButton}>💾 Download as JSON</button>
            </div>

            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #2a2a3a' }}>
              <p style={styles.text}>
                <strong>Need help?</strong> Contact us at{' '}
                <a href="mailto:privacy@edudashpro.org.za" style={{ color: '#00f5ff' }}>privacy@edudashpro.org.za</a>
              </p>
            </div>
          </div>
        )}

        <h2 style={styles.h2}>Frequently Asked Questions</h2>

        <h3 style={styles.h3}>Can I recover my data after deletion?</h3>
        <p style={styles.text}>Yes, within the 30-day grace period. After that, data is permanently deleted and cannot be recovered.</p>

        <h3 style={styles.h3}>What data cannot be deleted?</h3>
        <p style={styles.text}>For legal compliance, we must retain:</p>
        <ul style={styles.list}>
          <li>Financial records (invoices, payment transactions) - 7 years (South African law)</li>
          <li>Security logs for fraud investigation - 1 year</li>
          <li>Data required for ongoing legal proceedings</li>
        </ul>

        <h3 style={styles.h3}>How long does the deletion process take?</h3>
        <ul style={styles.list}>
          <li>Identity verification: 1-3 business days</li>
          <li>Grace period: 30 days</li>
          <li>Active system deletion: Immediate after grace period</li>
          <li>Backup removal: Within 90 days</li>
        </ul>

        <h3 style={styles.h3}>Can I request deletion of my child&apos;s data?</h3>
        <p style={styles.text}>
          Yes. Parents/guardians can request deletion of their child&apos;s data. Select &quot;Student&quot; as the role and provide the child&apos;s information. We will verify your parental/guardian status before processing.
        </p>

        <h3 style={styles.h3}>What happens to my preschool&apos;s data if I&apos;m a principal?</h3>
        <p style={styles.text}>
          If you&apos;re the principal/owner, deleting your account may affect your entire preschool&apos;s access. Please contact us at{' '}
          <a href="mailto:privacy@edudashpro.org.za" style={{ color: '#00f5ff' }}>privacy@edudashpro.org.za</a> to discuss a proper handover process.
        </p>

        <hr style={styles.hr} />

        <footer style={styles.footer}>
          <p>
            <strong>Privacy Inquiries:</strong>{' '}
            <a href="mailto:privacy@edudashpro.org.za" style={{ color: '#00f5ff' }}>privacy@edudashpro.org.za</a>
            <br />
            <strong>Privacy Policy:</strong>{' '}
            <Link href="/privacy" style={{ color: '#00f5ff' }}>View Full Policy</Link>
            <br />
            <strong>Website:</strong>{' '}
            <a href="https://www.edudashpro.org.za" style={{ color: '#00f5ff' }}>www.edudashpro.org.za</a>
          </p>
          <p style={{ marginTop: 16 }}>© 2025 EduDash Pro (Pty) Ltd. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
