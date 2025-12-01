'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { ArrowLeft, UserPlus, Mail, User, Phone, BookOpen, Send } from 'lucide-react';

export default function InviteTeacherPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    subject_specialization: '',
    send_email: true,
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
    };
    initAuth();
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.first_name || !formData.last_name || !formData.email) {
        throw new Error('Please fill in all required fields');
      }

      if (!preschoolId) {
        throw new Error('No preschool ID found');
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Check if teacher already exists
      const { data: existingTeacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('email', formData.email)
        .eq('preschool_id', preschoolId)
        .maybeSingle();

      if (existingTeacher) {
        throw new Error('A teacher with this email already exists in your school');
      }

      // Create teacher invite/record
      const { data: teacher, error: insertError } = await supabase
        .from('teachers')
        .insert({
          preschool_id: preschoolId,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone || null,
          subject_specialization: formData.subject_specialization || null,
          is_active: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // TODO: Send invitation email if formData.send_email is true
      // This would typically call an Edge Function to send the email
      if (formData.send_email) {
        console.log('TODO: Send invitation email to', formData.email);
        // await supabase.functions.invoke('send-teacher-invitation', {
        //   body: { teacher_id: teacher.id, email: formData.email }
        // });
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/principal/teachers');
      }, 2000);

    } catch (err: any) {
      console.error('Invitation error:', err);
      setError(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <PrincipalShell 
      tenantSlug={tenantSlug} 
      preschoolName={preschoolName} 
      preschoolId={preschoolId}
      hideRightSidebar={true}
    >
      <div className="section">
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <button
              onClick={() => router.back()}
              className="btn btnSecondary"
              style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <ArrowLeft size={16} />
              Back to Teachers
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div 
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <UserPlus size={24} color="white" />
              </div>
              <div>
                <h1 className="h1" style={{ marginBottom: 4 }}>Invite Teacher</h1>
                <p className="subtitle">Send an invitation to join {preschoolName}</p>
              </div>
            </div>
          </div>

          {success && (
            <div 
              className="card" 
              style={{ 
                marginBottom: 24, 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Send size={24} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Invitation Sent!</div>
                  <div style={{ opacity: 0.9 }}>
                    The teacher has been added to your school. 
                    {formData.send_email && ' An invitation email has been sent.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div 
              className="card" 
              style={{ 
                marginBottom: 24, 
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white'
              }}
            >
              <div style={{ fontWeight: 600 }}>{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="card">
              <h2 className="h2" style={{ marginBottom: 16 }}>Teacher Information</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="label" htmlFor="first_name">
                    <User size={16} style={{ marginRight: 6 }} />
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    className="input"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    placeholder="John"
                    style={{ 
                      backgroundColor: 'var(--input-bg)', 
                      color: 'var(--foreground)',
                      width: '100%'
                    }}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="last_name">
                    <User size={16} style={{ marginRight: 6 }} />
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    className="input"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                    placeholder="Smith"
                    style={{ 
                      backgroundColor: 'var(--input-bg)', 
                      color: 'var(--foreground)',
                      width: '100%'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label" htmlFor="email">
                  <Mail size={16} style={{ marginRight: 6 }} />
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="input"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="teacher@example.com"
                  style={{ 
                    backgroundColor: 'var(--input-bg)', 
                    color: 'var(--foreground)',
                    width: '100%'
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label" htmlFor="phone">
                  <Phone size={16} style={{ marginRight: 6 }} />
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className="input"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+27 12 345 6789"
                  style={{ 
                    backgroundColor: 'var(--input-bg)', 
                    color: 'var(--foreground)',
                    width: '100%'
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label className="label" htmlFor="subject_specialization">
                  <BookOpen size={16} style={{ marginRight: 6 }} />
                  Subject Specialization (Optional)
                </label>
                <input
                  type="text"
                  id="subject_specialization"
                  name="subject_specialization"
                  className="input"
                  value={formData.subject_specialization}
                  onChange={handleChange}
                  placeholder="e.g., Early Childhood Development, Mathematics, Arts"
                  style={{ 
                    backgroundColor: 'var(--input-bg)', 
                    color: 'var(--foreground)',
                    width: '100%'
                  }}
                />
              </div>

              <div style={{ 
                padding: 16, 
                borderRadius: 8, 
                background: 'var(--muted)',
                marginBottom: 16
              }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="send_email"
                    checked={formData.send_email}
                    onChange={handleChange}
                    style={{ marginRight: 12, width: 18, height: 18 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Send invitation email</div>
                    <div style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                      The teacher will receive an email with setup instructions and login details
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                type="button"
                onClick={() => router.back()}
                className="btn btnSecondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btnPrimary"
                disabled={loading || success}
                style={{ flex: 1 }}
              >
                <UserPlus size={18} style={{ marginRight: 8 }} />
                {loading ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PrincipalShell>
  );
}
