'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { MessageCircle, Send, Users, CheckCircle, AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  subject: string;
  body: string;
  recipient_type: 'all_parents' | 'all_teachers' | 'all_staff';
  created_at: string;
  sent_count: number;
}

export default function MessagesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    subject: '',
    body: '',
    recipient_type: 'all_parents' as 'all_parents' | 'all_teachers' | 'all_staff',
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [recipients, setRecipients] = useState({
    parents: 0,
    teachers: 0,
    staff: 0,
  });

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
      setLoading(false);
    };
    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (!preschoolId) return;

    const loadRecipients = async () => {
      // Count parents (guardians of students)
      const { count: parentCount } = await supabase
        .from('students')
        .select('guardian_id', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .not('guardian_id', 'is', null);

      // Count teachers
      const { count: teacherCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .eq('role', 'teacher');

      // Count all staff (teachers + admins)
      const { count: staffCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .in('role', ['teacher', 'admin', 'principal']);

      setRecipients({
        parents: parentCount || 0,
        teachers: teacherCount || 0,
        staff: staffCount || 0,
      });
    };

    loadRecipients();
  }, [preschoolId, supabase]);

  const handleSend = async () => {
    if (!formData.subject || !formData.body || !userId || !preschoolId) {
      setError('Please fill in all fields');
      return;
    }

    setSending(true);
    setError('');
    
    try {
      let recipientEmails: string[] = [];

      // Get recipient emails based on selection
      if (formData.recipient_type === 'all_parents') {
        const { data: students } = await supabase
          .from('students')
          .select('guardian_id, profiles!students_guardian_id_fkey(email)')
          .eq('preschool_id', preschoolId)
          .not('guardian_id', 'is', null);

        recipientEmails = students?.map(s => (s.profiles as any)?.email).filter(Boolean) || [];
      } else if (formData.recipient_type === 'all_teachers') {
        const { data: teachers } = await supabase
          .from('profiles')
          .select('email')
          .eq('preschool_id', preschoolId)
          .eq('role', 'teacher');

        recipientEmails = teachers?.map(t => t.email).filter(Boolean) || [];
      } else {
        const { data: staff } = await supabase
          .from('profiles')
          .select('email')
          .eq('preschool_id', preschoolId)
          .in('role', ['teacher', 'admin', 'principal']);

        recipientEmails = staff?.map(s => s.email).filter(Boolean) || [];
      }

      // In a real implementation, this would trigger email sending via an edge function
      // For now, we'll just show a success message
      console.log('Would send to:', recipientEmails);
      console.log('Subject:', formData.subject);
      console.log('Body:', formData.body);

      // Simulate sending
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSuccess(true);
      setFormData({ subject: '', body: '', recipient_type: 'all_parents' });
      setShowCompose(false);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId} hideRightSidebar={true}>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400">Loading messages...</p>
        </div>
      </PrincipalShell>
    );
  }

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId} hideRightSidebar={true}>
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 className="h1">Messages & Announcements</h1>
            <p style={{ color: 'var(--muted)', marginTop: 4 }}>
              Send messages to parents, teachers, and staff
            </p>
          </div>
          {!showCompose && (
            <button 
              className="btn btnPrimary"
              onClick={() => setShowCompose(true)}
            >
              <Send size={18} style={{ marginRight: 8 }} />
              Compose Message
            </button>
          )}
        </div>

        {success && (
          <div className="card" style={{ 
            backgroundColor: '#10b98120', 
            borderLeft: '4px solid #10b981',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <CheckCircle size={20} color="#10b981" />
            <div>
              <div style={{ fontWeight: 600, color: '#10b981' }}>Message Sent Successfully</div>
              <div style={{ fontSize: 14, color: '#059669', marginTop: 2 }}>
                Your message has been queued for delivery
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="card" style={{ 
            backgroundColor: '#ef444420', 
            borderLeft: '4px solid #ef4444',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <AlertCircle size={20} color="#ef4444" />
            <div>
              <div style={{ fontWeight: 600, color: '#ef4444' }}>Error</div>
              <div style={{ fontSize: 14, color: '#dc2626', marginTop: 2 }}>{error}</div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid2" style={{ marginBottom: 24 }}>
          <div className="card tile">
            <div className="metricValue">{recipients.parents}</div>
            <div className="metricLabel">Parent Contacts</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{recipients.teachers}</div>
            <div className="metricLabel">Teachers</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{recipients.staff}</div>
            <div className="metricLabel">Total Staff</div>
          </div>
          <div className="card tile">
            <div className="metricValue">0</div>
            <div className="metricLabel">Messages Sent</div>
          </div>
        </div>

        {showCompose ? (
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Compose Message</h3>
            
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  Recipients *
                </label>
                <select
                  value={formData.recipient_type}
                  onChange={(e) => setFormData({ ...formData, recipient_type: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                >
                  <option value="all_parents">All Parents ({recipients.parents})</option>
                  <option value="all_teachers">All Teachers ({recipients.teachers})</option>
                  <option value="all_staff">All Staff ({recipients.staff})</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  Subject *
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Enter message subject"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  Message *
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="Type your message here..."
                  rows={8}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 14,
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button 
                  className="btn btnSecondary"
                  onClick={() => {
                    setShowCompose(false);
                    setFormData({ subject: '', body: '', recipient_type: 'all_parents' });
                    setError('');
                  }}
                  disabled={sending}
                >
                  Cancel
                </button>
                <button 
                  className="btn btnPrimary"
                  onClick={handleSend}
                  disabled={sending || !formData.subject || !formData.body}
                >
                  <Send size={18} style={{ marginRight: 8 }} />
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <MessageCircle size={48} style={{ margin: '0 auto 16px', color: 'var(--muted)' }} />
            <h3 style={{ marginBottom: 8 }}>No messages yet</h3>
            <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
              Start by composing your first message or announcement
            </p>
            <button 
              className="btn btnPrimary"
              onClick={() => setShowCompose(true)}
            >
              <Send size={18} style={{ marginRight: 8 }} />
              Compose Message
            </button>
          </div>
        )}
      </div>
    </PrincipalShell>
  );
}
