/**
 * useConsent — React hook for consent management
 *
 * Provides consent state, gate checks, and mutation methods.
 * Uses React Query for caching and invalidation.
 *
 * @module hooks/useConsent
 */

import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ConsentService, REQUIRED_CONSENTS, CURRENT_POLICY_VERSIONS } from '@/lib/services/consentService'
import { classifyAge } from '@/lib/services/consentService'
import type {
  ConsentPurpose,
  ConsentFormItem,
  ConsentGateResult,
  ConsentMetadata,
  AgeClassification,
} from '@/lib/types/consent'

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const CONSENT_KEY_ROOT = ['consent'] as const

export const consentKeys = {
  all: CONSENT_KEY_ROOT,
  records: (userId: string) => [...CONSENT_KEY_ROOT, 'records', userId] as const,
  gate: (userId: string) => [...CONSENT_KEY_ROOT, 'gate', userId] as const,
  form: (userId: string) => [...CONSENT_KEY_ROOT, 'form', userId] as const,
  retentionPolicies: [...CONSENT_KEY_ROOT, 'retention-policies'] as const,
}

// ---------------------------------------------------------------------------
// Main Hook
// ---------------------------------------------------------------------------

interface UseConsentOptions {
  userId: string | null | undefined
  dateOfBirth?: string | null
  /** Disable all queries (e.g., before auth is ready) */
  enabled?: boolean
}

interface UseConsentReturn {
  /** Full consent gate check result */
  gateResult: ConsentGateResult | undefined
  /** Whether the gate check is loading */
  isGateLoading: boolean
  /** Whether the user has all required consents */
  hasAllConsents: boolean
  /** Consent form items to present */
  formItems: ConsentFormItem[] | undefined
  /** Age classification result */
  ageClassification: AgeClassification | null
  /** Grant consent for a purpose */
  grantConsent: (purpose: ConsentPurpose, metadata?: ConsentMetadata) => Promise<boolean>
  /** Withdraw consent for a purpose */
  withdrawConsent: (purpose: ConsentPurpose, reason?: string) => Promise<boolean>
  /** Grant all required consents at once (onboarding shortcut) */
  acceptAllRequired: (metadata?: ConsentMetadata) => Promise<boolean>
  /** Whether a mutation is in progress */
  isMutating: boolean
}

export function useConsent({
  userId,
  dateOfBirth,
  enabled = true,
}: UseConsentOptions): UseConsentReturn {
  const queryClient = useQueryClient()

  const isEnabled = Boolean(userId) && enabled

  // ── Consent gate check ──────────────────────────────────────────────
  const gateQuery = useQuery({
    queryKey: consentKeys.gate(userId ?? ''),
    queryFn: () => ConsentService.checkConsentGate(userId!, dateOfBirth),
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,
  })

  // ── Consent form items ──────────────────────────────────────────────
  const formQuery = useQuery({
    queryKey: consentKeys.form(userId ?? ''),
    queryFn: () => ConsentService.getConsentForm(userId!, dateOfBirth),
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
  })

  // ── Age classification (pure, no query needed) ──────────────────────
  const ageClassification = useMemo(
    () => classifyAge(dateOfBirth ?? null),
    [dateOfBirth],
  )

  // ── Grant mutation ──────────────────────────────────────────────────
  const grantMutation = useMutation({
    mutationFn: async ({
      purpose,
      metadata,
    }: {
      purpose: ConsentPurpose
      metadata?: ConsentMetadata
    }) => {
      return ConsentService.grantConsent(userId!, purpose, { metadata })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consentKeys.all })
    },
  })

  // ── Withdraw mutation ───────────────────────────────────────────────
  const withdrawMutation = useMutation({
    mutationFn: async ({
      purpose,
      reason,
    }: {
      purpose: ConsentPurpose
      reason?: string
    }) => {
      return ConsentService.withdrawConsent(userId!, purpose, reason)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consentKeys.all })
    },
  })

  // ── Public API ──────────────────────────────────────────────────────
  const grantConsent = useCallback(
    async (purpose: ConsentPurpose, metadata?: ConsentMetadata): Promise<boolean> => {
      if (!userId) return false
      const result = await grantMutation.mutateAsync({ purpose, metadata })
      return result !== null
    },
    [userId, grantMutation],
  )

  const withdrawConsent = useCallback(
    async (purpose: ConsentPurpose, reason?: string): Promise<boolean> => {
      if (!userId) return false
      return withdrawMutation.mutateAsync({ purpose, reason })
    },
    [userId, withdrawMutation],
  )

  const acceptAllRequired = useCallback(
    async (metadata?: ConsentMetadata): Promise<boolean> => {
      if (!userId) return false
      const count = await ConsentService.grantBulkConsent(userId, REQUIRED_CONSENTS, metadata)
      queryClient.invalidateQueries({ queryKey: consentKeys.all })
      return count === REQUIRED_CONSENTS.length
    },
    [userId, queryClient],
  )

  return {
    gateResult: gateQuery.data,
    isGateLoading: gateQuery.isLoading,
    hasAllConsents: gateQuery.data?.hasAllConsents ?? false,
    formItems: formQuery.data,
    ageClassification,
    grantConsent,
    withdrawConsent,
    acceptAllRequired,
    isMutating: grantMutation.isPending || withdrawMutation.isPending,
  }
}
