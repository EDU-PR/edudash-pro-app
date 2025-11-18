'use client';

import { useRouter } from 'next/navigation';
import { TierBadge } from '@/components/ui/TierBadge';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface OrganizationBannerProps {
  hasOrganization: boolean;
  preschoolName?: string;
  userId?: string;
}

export function OrganizationBanner({
  hasOrganization,
  preschoolName,
  userId
}: OrganizationBannerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isCommunitySchool, setIsCommunitySchool] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const checkCommunitySchool = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', userId)
        .maybeSingle();

      const COMMUNITY_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
      setIsCommunitySchool(profile?.preschool_id === COMMUNITY_SCHOOL_ID);
    };

    checkCommunitySchool();
  }, [userId, supabase]);

  // Don't render if no organization OR no preschool name
  if (!hasOrganization || !preschoolName) {
    return null;
  }

  return (
    <div
      className="card"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        marginBottom: 12,
        cursor: isCommunitySchool ? 'default' : 'pointer',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        flexWrap: 'wrap'
      }}
      onClick={() => {
        if (!isCommunitySchool) {
          router.push('/dashboard/parent/preschool');
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🏫</span>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {preschoolName}
        </span>
      </div>
      {userId && !isCommunitySchool && (
        <div style={{ flexShrink: 0 }}>
          <TierBadge userId={userId} size="sm" showUpgrade />
        </div>
      )}
    </div>
  );
}
