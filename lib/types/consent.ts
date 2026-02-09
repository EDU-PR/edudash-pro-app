/**
 * Consent Management Types
 *
 * POPIA (Protection of Personal Information Act) — South Africa
 * COPPA (Children's Online Privacy Protection Act) — USA / International
 * GDPR (General Data Protection Regulation) — EU/EEA
 *
 * @module lib/types/consent
 */

/** The specific purpose for which consent is being collected */
export type ConsentPurpose =
  | 'terms_of_service'
  | 'privacy_policy'
  | 'data_processing'       // POPIA §11 — lawful processing
  | 'ai_data_usage'          // Consent for AI-assisted grading/lesson gen
  | 'marketing_communications'
  | 'analytics_tracking'
  | 'push_notifications'
  | 'media_upload'           // Photo/video/audio of minors (COPPA)
  | 'parental_consent'       // COPPA — verifiable parental consent for <13

/** Consent status lifecycle */
export type ConsentStatus = 'granted' | 'denied' | 'withdrawn' | 'expired'

/** A single recorded consent action */
export interface ConsentRecord {
  id: string
  user_id: string
  purpose: ConsentPurpose
  status: ConsentStatus
  version: string               // e.g. "2026-01-15-v2" — policy version accepted
  granted_at: string | null      // ISO timestamp
  withdrawn_at: string | null
  expires_at: string | null      // Auto-expire for time-limited consent
  ip_address: string | null      // For audit trail
  user_agent: string | null
  metadata: ConsentMetadata | null
  created_at: string
  updated_at: string
}

/** Metadata attached to a consent record */
export interface ConsentMetadata {
  /** For parental consent — the guardian's user_id who gave consent */
  guardian_user_id?: string
  /** Method of verification (email, sms, in-app) */
  verification_method?: 'email' | 'sms' | 'in_app' | 'document_upload'
  /** Whether identity was verified */
  identity_verified?: boolean
  /** For withdrawal — reason given */
  withdrawal_reason?: string
  /** The specific document/policy URL accepted */
  document_url?: string
  /** Device info for mobile consent */
  device_type?: 'ios' | 'android' | 'web'
}

/** Age classification result for COPPA compliance */
export interface AgeClassification {
  /** User's age in years */
  age: number
  /** Whether user is a minor (<18 in ZA, <16 in EU, <13 in USA) */
  isMinor: boolean
  /** Whether COPPA applies (<13) */
  requiresCoppaConsent: boolean
  /** Whether parental consent is required */
  requiresParentalConsent: boolean
  /** Applicable jurisdiction */
  jurisdiction: 'za' | 'eu' | 'us' | 'other'
}

/** Data subject rights request (POPIA §23-25, GDPR Art 15-22) */
export type DataSubjectRequestType =
  | 'access'        // Right to access personal data
  | 'rectification'  // Right to correct inaccurate data
  | 'erasure'        // Right to be forgotten
  | 'portability'    // Right to data portability
  | 'restriction'    // Right to restrict processing
  | 'objection'      // Right to object to processing

export interface DataSubjectRequest {
  id: string
  user_id: string
  request_type: DataSubjectRequestType
  status: 'pending' | 'processing' | 'completed' | 'denied'
  reason: string | null
  submitted_at: string
  acknowledged_at: string | null
  completed_at: string | null
  response_data: Record<string, unknown> | null
}

/** Consent gate check result */
export interface ConsentGateResult {
  /** Whether the user has all required consents */
  hasAllConsents: boolean
  /** List of missing consent purposes */
  missingConsents: ConsentPurpose[]
  /** Whether any consents have expired and need renewal */
  expiredConsents: ConsentPurpose[]
  /** Whether parental consent is pending */
  pendingParentalConsent: boolean
}

/** Data retention policy per data category */
export interface DataRetentionPolicy {
  category: string
  description: string
  retentionPeriodDays: number
  legalBasis: string
  autoDeleteEnabled: boolean
}

/** Consent form field presented to the user */
export interface ConsentFormItem {
  purpose: ConsentPurpose
  label: string
  description: string
  required: boolean
  currentStatus: ConsentStatus | null
  version: string
}
