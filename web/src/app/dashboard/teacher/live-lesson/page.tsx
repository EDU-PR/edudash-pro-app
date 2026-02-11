'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Video } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { StartLiveLessonWithToggle } from '@/components/calls';

export default function TeacherLiveLessonPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/sign-in');
        return;
      }

      setUserId(user.id);
      setAuthLoading(false);
    };

    void initAuth();
  }, [router, supabase]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <TeacherShell
      tenantSlug={tenantSlug}
      userEmail={profile?.email}
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName}
      userId={userId}
      hideHeader={true}
    >
      <div className="container">
        <div className="section">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #2563eb, #0ea5e9)' }}>
              <Video className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="h1">Live Lesson</h1>
              <p className="muted">Start or stop your live lesson room for today.</p>
            </div>
          </div>
        </div>

        {!profile?.preschoolId || !userId ? (
          <div className="section">
            <div className="card p-md text-gray-300">
              Live lesson controls require a linked school profile.
            </div>
          </div>
        ) : (
          <div className="section">
            <div className="card p-md">
              <StartLiveLessonWithToggle
                preschoolId={profile.preschoolId}
                teacherId={userId}
                teacherName={profile?.firstName || 'Teacher'}
                subscriptionTier={profile?.subscription_tier || 'starter'}
              />
            </div>
          </div>
        )}
      </div>
    </TeacherShell>
  );
}
