'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { useChildrenData } from '@/lib/hooks/parent/useChildrenData';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { Users, Plus, UserPlus, Calendar, BookOpen } from 'lucide-react';

export default function ChildrenPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string>();
  const [userId, setUserId] = useState<string>();
  const { slug } = useTenantSlug(userId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/sign-in');
        return;
      }

      setUserEmail(session.user.email);
      setUserId(session.user.id);
      setLoading(false);
    };

    initAuth();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <ParentShell tenantSlug={slug} userEmail={userEmail} hideHeader={true}>
      <div className="section">
        <div style={{ marginBottom: 24 }}>
          <h1 className="h1">My Children</h1>
          <p style={{ color: 'var(--textLight)', marginTop: 8 }}>
            Manage your children's profiles and link them to your account
          </p>
        </div>

        <ChildrenContent userId={userId} />
      </div>
    </ParentShell>
  );
}

function ChildrenContent({ userId }: { userId: string | undefined }) {
  const { childrenCards, loading, error, refetch } = useChildrenData(userId);
  const router = useRouter();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ color: 'var(--textLight)', marginTop: 16 }}>Loading children...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ 
        padding: 16, 
        background: 'var(--danger-subtle)', 
        border: '1px solid var(--danger)',
        color: 'var(--danger)'
      }}>
        {error}
      </div>
    );
  }

  if (!childrenCards || childrenCards.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <Users className="icon64" style={{ margin: '0 auto 16px', color: 'var(--textLight)' }} />
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Children Linked</h3>
        <p style={{ color: 'var(--textMuted)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          Search for your child by name to link them to your account. The school will approve your request.
        </p>
        <button
          onClick={() => router.push('/dashboard/parent/claim-child')}
          className="btn btnPrimary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <UserPlus className="icon16" />
          Search & Claim Child
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ fontSize: 14, color: 'var(--textLight)' }}>
          {childrenCards.length} {childrenCards.length === 1 ? 'child' : 'children'} linked
        </div>
        <button
          onClick={() => router.push('/dashboard/parent/claim-child')}
          className="btn btnSecondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Plus className="icon16" />
          Add Another Child
        </button>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 16
      }}>
        {childrenCards.map((c) => (
          <div key={c.id} className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div className="avatar" style={{ width: 48, height: 48, fontSize: 20 }}>
                {c.firstName[0]}{c.lastName[0]}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  {c.firstName} {c.lastName}
                </h3>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                  background: c.status === 'active' ? 'var(--success-subtle)' : 'var(--warning-subtle)',
                  color: c.status === 'active' ? 'var(--success)' : 'var(--warning)',
                  textTransform: 'capitalize'
                }}>
                  {c.status}
                </span>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 8,
              paddingTop: 16,
              borderTop: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: 13, color: 'var(--textMuted)' }}>
                <strong style={{ color: 'var(--text)' }}>Class:</strong> {c.className || 'Not assigned'}
              </div>
              
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <div style={{ flex: 1, textAlign: 'center', padding: 12, background: 'var(--surface)', borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
                    {c.upcomingEvents}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--textLight)', marginTop: 4 }}>
                    Events
                  </div>
                </div>
                
                <div style={{ flex: 1, textAlign: 'center', padding: 12, background: 'var(--surface)', borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.homeworkPending > 0 ? 'var(--warning)' : 'var(--success)' }}>
                    {c.homeworkPending}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--textLight)', marginTop: 4 }}>
                    Homework
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
