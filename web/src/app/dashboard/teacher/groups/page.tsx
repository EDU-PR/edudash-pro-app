'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Plus, RefreshCcw, Trash2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { CreateGroupModal } from '@/components/dashboard/teacher/groups/CreateGroupModal';
import type { GroupType } from '@/components/dashboard/teacher/groups/CreateGroupModal';

interface PrincipalGroupRow {
  id: string;
  name: string;
  description: string | null;
  group_type: GroupType | null;
  icon: string | null;
  color: string | null;
  preschool_id: string;
  created_by: string;
  created_at: string | null;
  is_active: boolean | null;
}

interface GroupTypeConfig {
  value: GroupType;
  label: string;
  color: string;
}

const GROUP_TYPES: GroupTypeConfig[] = [
  { value: 'teacher_team', label: 'Teacher Team', color: '#6366F1' },
  { value: 'grade_group', label: 'Grade Group', color: '#10B981' },
  { value: 'subject_group', label: 'Subject Group', color: '#F59E0B' },
  { value: 'study_group', label: 'Study Group', color: '#8B5CF6' },
  { value: 'parent_group', label: 'Parent Group', color: '#06B6D4' },
  { value: 'custom', label: 'Custom', color: '#64748B' },
];

const STAFF_ROLES = ['teacher', 'principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];

const resolveGroupType = (groupType: string | null | undefined): GroupTypeConfig => (
  GROUP_TYPES.find((type) => type.value === groupType) || GROUP_TYPES[GROUP_TYPES.length - 1]
);

const getBadgeBackground = (hex: string): string => `${hex}33`;

export default function TeacherGroupsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [groups, setGroups] = useState<PrincipalGroupRow[]>([]);
  const [memberCountByGroupId, setMemberCountByGroupId] = useState<Record<string, number>>({});

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  useEffect(() => {
    const init = async () => {
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
    void init();
  }, [router, supabase]);

  const role = String(profile?.role || '').toLowerCase();
  const canManageGroups = STAFF_ROLES.includes(role);
  const organizationId = profile?.organizationId || profile?.preschoolId;

  const loadGroups = useCallback(async () => {
    if (!organizationId) {
      setGroups([]);
      setMemberCountByGroupId({});
      setErrorMessage('School context is missing for your account.');
      setLoading(false);
      return;
    }

    if (!canManageGroups) {
      setGroups([]);
      setMemberCountByGroupId({});
      setErrorMessage('Only teachers and school admins can manage groups.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('principal_groups')
        .select('id, name, description, group_type, icon, color, preschool_id, created_by, created_at, is_active')
        .eq('preschool_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const groupRows = (data || []) as PrincipalGroupRow[];
      setGroups(groupRows);

      if (groupRows.length === 0) {
        setMemberCountByGroupId({});
        return;
      }

      const groupIds = groupRows.map((group) => group.id);
      const { data: memberRows, error: memberError } = await supabase
        .from('group_members')
        .select('group_id, status')
        .in('group_id', groupIds);
      if (memberError) throw memberError;

      const counts: Record<string, number> = {};
      groupIds.forEach((groupId) => {
        counts[groupId] = 0;
      });

      (memberRows || []).forEach((row: { group_id: string; status: string | null }) => {
        if (!row.group_id) return;
        if (row.status && row.status !== 'active') return;
        counts[row.group_id] = (counts[row.group_id] || 0) + 1;
      });

      setMemberCountByGroupId(counts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load groups.';
      setErrorMessage(message);
      setGroups([]);
      setMemberCountByGroupId({});
    } finally {
      setLoading(false);
    }
  }, [canManageGroups, organizationId, supabase]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const handleCreateGroup = useCallback(async (name: string, description: string, groupType: GroupType) => {
    if (!userId || !organizationId) return;
    if (!name.trim()) {
      setErrorMessage('Please enter a group name.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const typeConfig = resolveGroupType(groupType);

      const { error } = await supabase
        .from('principal_groups')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          group_type: groupType,
          icon: 'people',
          color: typeConfig.color,
          preschool_id: organizationId,
          created_by: userId,
          is_active: true,
        });

      if (error) throw error;

      setShowCreateModal(false);
      await loadGroups();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create group.';
      if (message.toLowerCase().includes('principal_groups_preschool_id_name_key')) {
        setErrorMessage('A group with this name already exists in your school.');
      } else {
        setErrorMessage(message);
      }
    } finally {
      setSaving(false);
    }
  }, [loadGroups, organizationId, supabase, userId]);

  const handleArchiveGroup = useCallback(async (group: PrincipalGroupRow) => {
    const confirmed = confirm(`Archive "${group.name}"?`);
    if (!confirmed) return;

    setDeletingGroupId(group.id);
    setErrorMessage(null);
    try {
      const { error } = await supabase
        .from('principal_groups')
        .update({ is_active: false })
        .eq('id', group.id);
      if (error) throw error;
      await loadGroups();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to archive group.';
      setErrorMessage(message);
    } finally {
      setDeletingGroupId(null);
    }
  }, [loadGroups, supabase]);

  const emptyStateMessage = useMemo(() => {
    if (!canManageGroups) return 'Only teachers and school admins can manage groups.';
    return 'No groups yet. Create your first group to organize teachers, grades, or parent communication.';
  }, [canManageGroups]);

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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)' }}>
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="h1">Groups</h1>
                <p className="muted">Create and manage school groups for teachers, grades, and parent coordination.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void loadGroups()}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600 text-slate-200 hover:bg-slate-800/60 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" />
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              {canManageGroups && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                >
                  <Plus className="w-4 h-4" />
                  New Group
                </button>
              )}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="section">
            <div className="card p-md border border-red-500/40 bg-red-950/20 text-red-200 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        <div className="section">
          <div className="card p-md">
            {loading ? (
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading groups...
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-8 text-center">
                <div className="text-sm text-slate-300">{emptyStateMessage}</div>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => {
                  const typeConfig = resolveGroupType(group.group_type);
                  const memberCount = memberCountByGroupId[group.id] || 0;

                  return (
                    <div key={group.id} className="rounded-lg border border-slate-700 bg-slate-900/35 p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-white font-semibold">{group.name}</div>
                          {group.description && (
                            <div className="text-sm text-slate-300 mt-1">{group.description}</div>
                          )}
                          <div className="text-xs text-slate-400 mt-2">
                            Created {group.created_at ? new Date(group.created_at).toLocaleDateString('en-ZA') : 'recently'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ color: typeConfig.color, background: getBadgeBackground(typeConfig.color) }}
                          >
                            {typeConfig.label}
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-700/70 text-slate-200">
                            {memberCount} member{memberCount === 1 ? '' : 's'}
                          </span>
                          {canManageGroups && (
                            <button
                              onClick={() => void handleArchiveGroup(group)}
                              disabled={deletingGroupId === group.id}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-red-500/40 text-red-300 hover:bg-red-900/20 disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {deletingGroupId === group.id ? 'Archiving...' : 'Archive'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateGroupModal
          saving={saving}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateGroup}
        />
      )}
    </TeacherShell>
  );
}
