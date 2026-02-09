/**
 * Consent Management Service
 *
 * Handles POPIA / COPPA / GDPR consent operations:
 *  - Record, verify, and withdraw consent
 *  - Age classification for COPPA compliance
 *  - Parental consent verification
 *  - Data subject rights requests
 *  - Consent gate checks
 *
 * @module lib/services/consentService
 */

import { assertSupabase } from '@/lib/supabase'
import { track } from '@/lib/analytics'
import type {
  ConsentPurpose,
  ConsentStatus,
  ConsentRecord,
  AgeClassification,
  ConsentGateResult,
  ConsentMetadata,
  DataSubjectRequest,
  DataSubjectRequestType,
  DataRetentionPolicy,
  ConsentFormItem,
} from '@/lib/types/consent'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current policy versions — bump when ToS or Privacy Policy changes */
export const CURRENT_POLICY_VERSIONS = {
  terms_of_service: '2026-02-10-v1',
  privacy_policy: '2026-02-10-v1',
  data_processing: '2026-02-10-v1',
  ai_data_usage: '2026-02-10-v1',
} as const

/** Purposes that are required for all users before they can use the app */
export const REQUIRED_CONSENTS: ConsentPurpose[] = [
  'terms_of_service',
  'privacy_policy',
  'data_processing',
]

/** COPPA age threshold (years) */
const COPPA_AGE_THRESHOLD = 13

/** POPIA/GDPR minor age threshold (years) — South Africa uses 18 */
const POPIA_MINOR_AGE_THRESHOLD = 18

/** GDPR minor age threshold (years) — varies by country, default 16 */
const GDPR_MINOR_AGE_THRESHOLD = 16

/** Maximum response time for data subject requests (days) — GDPR Art 12(3) */
export const DSR_RESPONSE_DEADLINE_DAYS = 30

// ---------------------------------------------------------------------------
// Age Classification
// ---------------------------------------------------------------------------

/**
 * Classify a user's age for COPPA/POPIA compliance.
 *
 * @param dateOfBirth - ISO date string (YYYY-MM-DD)
 * @param jurisdiction - User's jurisdiction ('za', 'eu', 'us', 'other')
 */
export function classifyAge(
  dateOfBirth: string | null | undefined,
  jurisdiction: AgeClassification['jurisdiction'] = 'za',
): AgeClassification | null {
  if (!dateOfBirth) return null

  const dob = new Date(dateOfBirth)
  if (isNaN(dob.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }

  const minorThreshold =
    jurisdiction === 'za'
      ? POPIA_MINOR_AGE_THRESHOLD
      : jurisdiction === 'eu'
        ? GDPR_MINOR_AGE_THRESHOLD
        : COPPA_AGE_THRESHOLD

  return {
    age,
    isMinor: age < minorThreshold,
    requiresCoppaConsent: age < COPPA_AGE_THRESHOLD,
    requiresParentalConsent: age < minorThreshold,
    jurisdiction,
  }
}

/**
 * Determine if ad targeting should mark user as under age of consent.
 * Used to set `tagForUnderAgeOfConsent` dynamically instead of hardcoding false.
 */
export function isUnderAgeOfConsent(dateOfBirth: string | null | undefined): boolean {
  const classification = classifyAge(dateOfBirth)
  return classification?.requiresCoppaConsent ?? false
}

// ---------------------------------------------------------------------------
// Consent Recording
// ---------------------------------------------------------------------------

export class ConsentService {
  /**
   * Record a new consent grant.
   * Creates a consent_record and updates profile consent fields.
   */
  static async grantConsent(
    userId: string,
    purpose: ConsentPurpose,
    options?: {
      version?: string
      metadata?: ConsentMetadata
      expiresInDays?: number
    },
  ): Promise<ConsentRecord | null> {
    const supabase = assertSupabase()
    const version =
      options?.version ??
      CURRENT_POLICY_VERSIONS[purpose as keyof typeof CURRENT_POLICY_VERSIONS] ??
      '1.0'

    const expiresAt = options?.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 86_400_000).toISOString()
      : null

    const { data, error } = await supabase
      .from('consent_records')
      .upsert(
        {
          user_id: userId,
          purpose,
          status: 'granted' as ConsentStatus,
          version,
          granted_at: new Date().toISOString(),
          withdrawn_at: null,
          expires_at: expiresAt,
          metadata: options?.metadata ?? {},
        },
        { onConflict: 'user_id,purpose,version' },
      )
      .select()
      .single()

    if (error) {
      if (__DEV__) console.warn('[ConsentService] grantConsent error:', error.message)
      return null
    }

    // Update profile-level consent flags
    await this.syncProfileConsent(userId, purpose, true)

    track('edudash.consent.granted', { purpose, version })

    return data as ConsentRecord
  }

  /**
   * Withdraw a previously granted consent.
   * POPIA §11(2)(a) — consent can be withdrawn at any time.
   */
  static async withdrawConsent(
    userId: string,
    purpose: ConsentPurpose,
    reason?: string,
  ): Promise<boolean> {
    const supabase = assertSupabase()

    const { error } = await supabase
      .from('consent_records')
      .update({
        status: 'withdrawn' as ConsentStatus,
        withdrawn_at: new Date().toISOString(),
        metadata: reason ? { withdrawal_reason: reason } : undefined,
      })
      .eq('user_id', userId)
      .eq('purpose', purpose)
      .eq('status', 'granted')

    if (error) {
      if (__DEV__) console.warn('[ConsentService] withdrawConsent error:', error.message)
      return false
    }

    await this.syncProfileConsent(userId, purpose, false)

    track('edudash.consent.withdrawn', { purpose, reason })

    return true
  }

  /**
   * Get all active consent records for a user.
   */
  static async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    const supabase = assertSupabase()

    const { data, error } = await supabase
      .from('consent_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      if (__DEV__) console.warn('[ConsentService] getUserConsents error:', error.message)
      return []
    }

    return (data ?? []) as ConsentRecord[]
  }

  /**
   * Check if user has active consent for a specific purpose.
   */
  static async hasConsent(userId: string, purpose: ConsentPurpose): Promise<boolean> {
    const supabase = assertSupabase()

    const { data } = await supabase.rpc('has_active_consent', {
      p_user_id: userId,
      p_purpose: purpose,
    })

    return data === true
  }

  /**
   * Run a full consent gate check.
   * Returns which consents are missing, expired, or pending.
   */
  static async checkConsentGate(
    userId: string,
    dateOfBirth?: string | null,
  ): Promise<ConsentGateResult> {
    const consents = await this.getUserConsents(userId)
    const now = new Date()

    const activeConsents = new Map<ConsentPurpose, ConsentRecord>()
    const expiredConsents: ConsentPurpose[] = []

    for (const record of consents) {
      if (record.status !== 'granted') continue
      if (record.expires_at && new Date(record.expires_at) < now) {
        expiredConsents.push(record.purpose)
        continue
      }
      // Keep only the latest per purpose
      if (!activeConsents.has(record.purpose)) {
        activeConsents.set(record.purpose, record)
      }
    }

    const missingConsents = REQUIRED_CONSENTS.filter(
      (p) => !activeConsents.has(p),
    )

    // Check parental consent for minors
    const ageClass = dateOfBirth ? classifyAge(dateOfBirth) : null
    const needsParentalConsent = ageClass?.requiresParentalConsent ?? false
    const hasParentalConsent = activeConsents.has('parental_consent')
    const pendingParentalConsent = needsParentalConsent && !hasParentalConsent

    if (pendingParentalConsent && !missingConsents.includes('parental_consent')) {
      missingConsents.push('parental_consent')
    }

    return {
      hasAllConsents: missingConsents.length === 0 && expiredConsents.length === 0 && !pendingParentalConsent,
      missingConsents,
      expiredConsents,
      pendingParentalConsent,
    }
  }

  /**
   * Grant consent for multiple purposes at once (bulk onboarding).
   */
  static async grantBulkConsent(
    userId: string,
    purposes: ConsentPurpose[],
    metadata?: ConsentMetadata,
  ): Promise<number> {
    let granted = 0
    for (const purpose of purposes) {
      const record = await this.grantConsent(userId, purpose, { metadata })
      if (record) granted++
    }
    return granted
  }

  // ---------------------------------------------------------------------------
  // Parental Consent (COPPA)
  // ---------------------------------------------------------------------------

  /**
   * Record verifiable parental consent for a minor.
   *
   * COPPA requires "verifiable parental consent" before collecting
   * personal information from children under 13.
   *
   * @param childUserId - The child's user ID
   * @param guardianUserId - The parent/guardian's user ID
   * @param verificationMethod - How the parent verified their identity
   */
  static async grantParentalConsent(
    childUserId: string,
    guardianUserId: string,
    verificationMethod: ConsentMetadata['verification_method'] = 'in_app',
  ): Promise<ConsentRecord | null> {
    // Verify guardian relationship
    const supabase = assertSupabase()
    const { data: childProfile } = await supabase
      .from('profiles')
      .select('guardian_profile_id')
      .eq('auth_user_id', childUserId)
      .single()

    const { data: guardianProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', guardianUserId)
      .single()

    if (!childProfile || !guardianProfile) {
      if (__DEV__) console.warn('[ConsentService] Profile not found for guardian verification')
      return null
    }

    // Verify the guardian relationship
    if (childProfile.guardian_profile_id !== guardianProfile.id) {
      if (__DEV__) console.warn('[ConsentService] Guardian relationship not verified')
      return null
    }

    const record = await this.grantConsent(childUserId, 'parental_consent', {
      metadata: {
        guardian_user_id: guardianUserId,
        verification_method: verificationMethod,
        identity_verified: true,
      },
    })

    if (record) {
      // Update profile parental consent fields
      await supabase
        .from('profiles')
        .update({
          parental_consent_given: true,
          parental_consent_given_by: guardianUserId,
          parental_consent_given_at: new Date().toISOString(),
          coppa_verified: true,
        })
        .eq('auth_user_id', childUserId)

      track('edudash.consent.parental_consent_verified', {
        child_user_id: childUserId,
        verification_method: verificationMethod,
      })
    }

    return record
  }

  // ---------------------------------------------------------------------------
  // Data Subject Requests (POPIA §23-25 / GDPR Art 15-22)
  // ---------------------------------------------------------------------------

  /**
   * Submit a data subject rights request.
   */
  static async submitDataSubjectRequest(
    userId: string,
    requestType: DataSubjectRequestType,
    reason?: string,
  ): Promise<DataSubjectRequest | null> {
    const supabase = assertSupabase()

    const { data, error } = await supabase
      .from('data_subject_requests')
      .insert({
        user_id: userId,
        request_type: requestType,
        reason,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      if (__DEV__) console.warn('[ConsentService] submitDataSubjectRequest error:', error.message)
      return null
    }

    track('edudash.privacy.dsr_submitted', { request_type: requestType })

    return data as DataSubjectRequest
  }

  /**
   * Get all data subject requests for a user.
   */
  static async getDataSubjectRequests(userId: string): Promise<DataSubjectRequest[]> {
    const supabase = assertSupabase()

    const { data, error } = await supabase
      .from('data_subject_requests')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })

    if (error) {
      if (__DEV__) console.warn('[ConsentService] getDataSubjectRequests error:', error.message)
      return []
    }

    return (data ?? []) as DataSubjectRequest[]
  }

  // ---------------------------------------------------------------------------
  // Data Retention Policies
  // ---------------------------------------------------------------------------

  /**
   * Get configured data retention policies.
   */
  static async getRetentionPolicies(): Promise<DataRetentionPolicy[]> {
    const supabase = assertSupabase()

    const { data, error } = await supabase
      .from('data_retention_policies')
      .select('*')
      .order('category')

    if (error) {
      if (__DEV__) console.warn('[ConsentService] getRetentionPolicies error:', error.message)
      return []
    }

    return (data ?? []).map((row) => ({
      category: row.category,
      description: row.description,
      retentionPeriodDays: row.retention_period_days,
      legalBasis: row.legal_basis,
      autoDeleteEnabled: row.auto_delete_enabled,
    }))
  }

  // ---------------------------------------------------------------------------
  // Consent Form Generation
  // ---------------------------------------------------------------------------

  /**
   * Get the consent form items to present to a user during onboarding
   * or when re-consent is required (e.g., policy version update).
   */
  static async getConsentForm(
    userId: string,
    dateOfBirth?: string | null,
  ): Promise<ConsentFormItem[]> {
    const consents = await this.getUserConsents(userId)
    const latestByPurpose = new Map<ConsentPurpose, ConsentRecord>()
    for (const r of consents) {
      if (!latestByPurpose.has(r.purpose) || new Date(r.created_at) > new Date(latestByPurpose.get(r.purpose)!.created_at)) {
        latestByPurpose.set(r.purpose, r)
      }
    }

    const ageClass = dateOfBirth ? classifyAge(dateOfBirth) : null

    const items: ConsentFormItem[] = [
      {
        purpose: 'terms_of_service',
        label: 'Terms of Service',
        description: 'I agree to the EduDash Pro Terms of Service.',
        required: true,
        currentStatus: latestByPurpose.get('terms_of_service')?.status ?? null,
        version: CURRENT_POLICY_VERSIONS.terms_of_service,
      },
      {
        purpose: 'privacy_policy',
        label: 'Privacy Policy',
        description: 'I have read and accept the Privacy Policy, including how my data is collected and processed.',
        required: true,
        currentStatus: latestByPurpose.get('privacy_policy')?.status ?? null,
        version: CURRENT_POLICY_VERSIONS.privacy_policy,
      },
      {
        purpose: 'data_processing',
        label: 'Data Processing',
        description: 'I consent to the processing of my personal information as described in the Privacy Policy (POPIA §11).',
        required: true,
        currentStatus: latestByPurpose.get('data_processing')?.status ?? null,
        version: CURRENT_POLICY_VERSIONS.data_processing,
      },
      {
        purpose: 'ai_data_usage',
        label: 'AI-Assisted Features',
        description: 'I consent to my data being processed by AI systems for lesson generation and grading assistance.',
        required: false,
        currentStatus: latestByPurpose.get('ai_data_usage')?.status ?? null,
        version: CURRENT_POLICY_VERSIONS.ai_data_usage,
      },
      {
        purpose: 'marketing_communications',
        label: 'Marketing Communications',
        description: 'I agree to receive educational updates and feature announcements via email.',
        required: false,
        currentStatus: latestByPurpose.get('marketing_communications')?.status ?? null,
        version: '1.0',
      },
      {
        purpose: 'analytics_tracking',
        label: 'Usage Analytics',
        description: 'I consent to anonymized usage data being collected to improve the platform.',
        required: false,
        currentStatus: latestByPurpose.get('analytics_tracking')?.status ?? null,
        version: '1.0',
      },
    ]

    // Add parental consent if user is a minor
    if (ageClass?.requiresParentalConsent) {
      items.push({
        purpose: 'parental_consent',
        label: 'Parental Consent',
        description: ageClass.requiresCoppaConsent
          ? 'A parent or guardian must provide verifiable consent for this account (COPPA requirement).'
          : 'A parent or guardian must consent to data processing for this account.',
        required: true,
        currentStatus: latestByPurpose.get('parental_consent')?.status ?? null,
        version: '1.0',
      })
    }

    return items
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Sync profile-level consent flags when consent is granted/withdrawn.
   */
  private static async syncProfileConsent(
    userId: string,
    purpose: ConsentPurpose,
    granted: boolean,
  ): Promise<void> {
    const supabase = assertSupabase()
    const now = granted ? new Date().toISOString() : null
    const updates: Record<string, unknown> = {}

    switch (purpose) {
      case 'terms_of_service':
        updates.terms_accepted_at = now
        break
      case 'privacy_policy':
        updates.privacy_accepted_at = now
        break
      case 'data_processing':
        updates.data_processing_consent = granted
        break
      default:
        break
    }

    if (purpose === 'terms_of_service' || purpose === 'privacy_policy' || purpose === 'data_processing') {
      updates.consent_given = granted
      updates.consent_given_at = now
      updates.consent_version =
        CURRENT_POLICY_VERSIONS[purpose as keyof typeof CURRENT_POLICY_VERSIONS] ?? null
    }

    if (Object.keys(updates).length > 0) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('auth_user_id', userId)
        if (error && __DEV__) {
          console.warn('[ConsentService] syncProfileConsent error:', error)
        }
      } catch (e) {
        if (__DEV__) console.warn('[ConsentService] syncProfileConsent exception:', e)
      }
    }
  }
}
