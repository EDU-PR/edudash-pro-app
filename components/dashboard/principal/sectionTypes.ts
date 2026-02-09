import type { AttentionPriority } from '@/components/dashboard/shared/SectionAttentionDot';

export type PrincipalSectionId =
  | 'start-here'
  | 'urgent-queue'
  | 'daily-ops'
  | 'admissions-cashflow'
  | 'learners-families'
  | 'quick-actions';

export interface PrincipalSectionConfig {
  id: PrincipalSectionId;
  title: string;
  hint: string;
  icon: string;
  defaultCollapsed: boolean;
  attentionPriority: AttentionPriority;
  attentionCount: number;
  actionLabel?: string;
  onActionPress?: () => void;
}

export interface PrincipalSectionResolverInput {
  pendingRegistrations: number;
  pendingPayments: number;
  pendingPOPs: number;
  pendingApprovals: number;
}

export const ALL_PRINCIPAL_SECTION_IDS: PrincipalSectionId[] = [
  'start-here',
  'urgent-queue',
  'daily-ops',
  'admissions-cashflow',
  'learners-families',
  'quick-actions',
];

export const DEFAULT_OPEN_SECTION_IDS: PrincipalSectionId[] = [
  'urgent-queue',
  'quick-actions',
];

export const isPrincipalSectionId = (value: string): value is PrincipalSectionId =>
  (ALL_PRINCIPAL_SECTION_IDS as string[]).includes(value);

export const getUrgentExpandedSectionIds = (
  input: PrincipalSectionResolverInput
): Set<PrincipalSectionId> => {
  const expanded = new Set<PrincipalSectionId>(DEFAULT_OPEN_SECTION_IDS);
  const hasAdmissionsPressure =
    input.pendingRegistrations > 0 ||
    input.pendingPayments > 0 ||
    input.pendingPOPs > 0;

  if (hasAdmissionsPressure) {
    expanded.add('admissions-cashflow');
  }

  return expanded;
};

export const getDefaultCollapsedSections = (
  input: PrincipalSectionResolverInput
): Set<PrincipalSectionId> => {
  const urgentExpanded = getUrgentExpandedSectionIds(input);
  const collapsed = new Set<PrincipalSectionId>();

  for (const id of ALL_PRINCIPAL_SECTION_IDS) {
    if (!urgentExpanded.has(id)) {
      collapsed.add(id);
    }
  }

  return collapsed;
};

