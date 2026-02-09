/**
 * useParentalConsent — COPPA parental consent verification hook
 *
 * Handles the workflow where a parent/guardian grants consent
 * for a child under the COPPA age threshold (13).
 *
 * @module hooks/useParentalConsent
 */

import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConsentService, classifyAge } from '@/lib/services/consentService'
import { consentKeys } from '@/hooks/useConsent'
import type { ConsentMetadata } from '@/lib/types/consent'

interface UseParentalConsentOptions {
  /** The child's user ID */
  childUserId: string | null | undefined
  /** The child's date of birth */
  childDateOfBirth?: string | null
  /** The logged-in guardian's user ID */
  guardianUserId: string | null | undefined
  enabled?: boolean
}

interface UseParentalConsentReturn {
  /** Whether the child requires parental consent */
  requiresParentalConsent: boolean
  /** Whether parental consent has been granted */
  hasParentalConsent: boolean
  /** Whether the check is still loading */
  isLoading: boolean
  /** Grant parental consent for the child */
  grantParentalConsent: (
    verificationMethod?: ConsentMetadata['verification_method'],
  ) => Promise<boolean>
  /** Whether the grant mutation is in progress */
  isGranting: boolean
  /** Child's age classification */
  childAge: number | null
}

export function useParentalConsent({
  childUserId,
  childDateOfBirth,
  guardianUserId,
  enabled = true,
}: UseParentalConsentOptions): UseParentalConsentReturn {
  const queryClient = useQueryClient()
  const isEnabled = Boolean(childUserId) && Boolean(guardianUserId) && enabled

  // Check if child has parental consent
  const consentQuery = useQuery({
    queryKey: [...consentKeys.gate(childUserId ?? ''), 'parental'],
    queryFn: async () => {
      const hasConsent = await ConsentService.hasConsent(childUserId!, 'parental_consent')
      return hasConsent
    },
    enabled: isEnabled,
    staleTime: 10 * 60 * 1000,
  })

  const ageClassification = childDateOfBirth
    ? classifyAge(childDateOfBirth)
    : null

  const grantMutation = useMutation({
    mutationFn: async (verificationMethod: ConsentMetadata['verification_method']) => {
      return ConsentService.grantParentalConsent(
        childUserId!,
        guardianUserId!,
        verificationMethod,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consentKeys.all })
    },
  })

  const grantParentalConsent = useCallback(
    async (
      verificationMethod: ConsentMetadata['verification_method'] = 'in_app',
    ): Promise<boolean> => {
      if (!childUserId || !guardianUserId) return false
      const result = await grantMutation.mutateAsync(verificationMethod)
      return result !== null
    },
    [childUserId, guardianUserId, grantMutation],
  )

  return {
    requiresParentalConsent: ageClassification?.requiresParentalConsent ?? false,
    hasParentalConsent: consentQuery.data === true,
    isLoading: consentQuery.isLoading,
    grantParentalConsent,
    isGranting: grantMutation.isPending,
    childAge: ageClassification?.age ?? null,
  }
}
