import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { getEntityMeta } from '@/lib/screen-styles/super-admin-organizations.styles';
import type { Organization } from '@/lib/screen-styles/super-admin-organizations.styles';
import type { ShowAlertFn } from './types';

/** Deps injected by the orchestrator hook */
export interface OrgActionDeps {
  showAlert: ShowAlertFn;
  loadOrganizations: () => Promise<void>;
  setShowActionsModal: (v: boolean) => void;
  setShowDetailModal: (v: boolean) => void;
  setSelectedOrg: (org: Organization | null) => void;
}

/**
 * Executes a CRUD action on the selected organization.
 * Pure function — all side-effects go through the injected deps.
 */
export function executeOrgAction(
  action: string,
  org: Organization,
  deps: OrgActionDeps
): void {
  const { showAlert, loadOrganizations, setShowActionsModal, setShowDetailModal, setSelectedOrg } = deps;

  switch (action) {
    case 'view':
      setShowActionsModal(false);
      setShowDetailModal(true);
      break;

    case 'edit':
      showAlert({ title: 'Edit Organization', message: 'Organization editing coming soon' });
      break;

    case 'suspend':
      showAlert({
        title: 'Suspend Organization',
        message: `Are you sure you want to suspend ${org.name}?`,
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Suspend',
            style: 'destructive',
            onPress: async () => {
              try {
                const { actualId } = getEntityMeta(org);
                const sourceType = org.id.split('_')[0];
                const table =
                  sourceType === 'preschool' ? 'preschools' :
                  sourceType === 'school' ? 'schools' : 'organizations';
                const { error } = await assertSupabase()
                  .from(table).update({ is_active: false }).eq('id', actualId);
                if (error) throw error;
                track('superadmin_org_suspended', { org_id: actualId });
                showAlert({ title: 'Success', message: 'Organization suspended' });
                setShowActionsModal(false);
                await loadOrganizations();
              } catch (error: any) {
                showAlert({ title: 'Error', message: error?.message || 'Failed to suspend organization' });
              }
            },
          },
        ],
      });
      break;

    case 'verify':
      showAlert({
        title: 'Verify Organization',
        message: `Mark ${org.name} as verified?`,
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Verify',
            onPress: async () => {
              try {
                const { actualId } = getEntityMeta(org);
                const sourceType = org.id.split('_')[0];
                const table =
                  sourceType === 'preschool' ? 'preschools' :
                  sourceType === 'school' ? 'schools' : 'organizations';
                const { error } = await assertSupabase()
                  .from(table).update({ is_verified: true }).eq('id', actualId);
                if (error) throw error;
                track('superadmin_org_verified', { org_id: actualId });
                showAlert({ title: 'Success', message: 'Organization verified' });
                setShowActionsModal(false);
                await loadOrganizations();
              } catch (error: any) {
                showAlert({ title: 'Error', message: error?.message || 'Failed to verify organization' });
              }
            },
          },
        ],
      });
      break;

    case 'delete':
      confirmDelete(org, deps);
      break;
  }
}

// ── Delete (extracted for readability) ──────────────────────
function confirmDelete(org: Organization, deps: OrgActionDeps): void {
  const { showAlert, loadOrganizations, setShowActionsModal, setSelectedOrg } = deps;

  showAlert({
    title: 'Delete Organization',
    message: `⚠️ This action cannot be undone!\n\nThis will permanently delete "${org.name}" and unlink all associated users.\n\nAre you absolutely sure?`,
    buttons: [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Forever',
        style: 'destructive',
        onPress: async () => {
          try {
            const idParts = org.id.split('_');
            const sourceType = idParts[0];
            const actualId = idParts.slice(1).join('_');
            const table =
              sourceType === 'preschool' ? 'preschools' :
              sourceType === 'school' ? 'schools' : 'organizations';
            const profileColumn =
              sourceType === 'preschool' || sourceType === 'school'
                ? 'preschool_id' : 'organization_id';

            logger.debug('[Organizations] Deleting from table:', table, 'id:', actualId);
            const supabase = assertSupabase();

            // Unlink profiles
            const { error: unlinkError } = await supabase
              .from('profiles').update({ [profileColumn]: null }).eq(profileColumn, actualId);
            if (unlinkError) {
              logger.debug('[Organizations] Profile unlink error (non-fatal):', unlinkError.message);
            }

            // Unlink users table (may not have column)
            try {
              await supabase.from('users').update({ [profileColumn]: null }).eq(profileColumn, actualId);
            } catch { /* column may not exist */ }

            // Delete the organization
            const { error } = await supabase.from(table).delete().eq('id', actualId);
            if (error) throw error;

            track('superadmin_org_deleted', { org_id: actualId, org_name: org.name, org_type: org.type });
            showAlert({ title: 'Deleted', message: `${org.name} has been permanently deleted.` });
            setShowActionsModal(false);
            setSelectedOrg(null);
            await loadOrganizations();
          } catch (error: any) {
            logger.error('[Organizations] Delete error:', error);
            let errorMessage = error?.message || 'Failed to delete organization.';
            if (error?.code === '23503') {
              errorMessage = 'Cannot delete: This organization still has linked data. Please remove or reassign that data first.';
            }
            showAlert({ title: 'Error', message: errorMessage });
          }
        },
      },
    ],
  });
}
