/**
 * Tests for lib/services/consentService.ts — consent management
 */

import { classifyAge, isUnderAgeOfConsent, REQUIRED_CONSENTS, CURRENT_POLICY_VERSIONS } from '../consentService'

describe('classifyAge', () => {
  // Helper: create a DOB that makes the user N years old today
  function dobYearsAgo(years: number): string {
    const d = new Date()
    d.setFullYear(d.getFullYear() - years)
    d.setDate(d.getDate() - 1) // ensure birthday has passed
    return d.toISOString().split('T')[0]
  }

  it('returns null for null/undefined/invalid input', () => {
    expect(classifyAge(null)).toBeNull()
    expect(classifyAge(undefined)).toBeNull()
    expect(classifyAge('not-a-date')).toBeNull()
    expect(classifyAge('')).toBeNull()
  })

  it('classifies a 10-year-old as COPPA-requiring in ZA jurisdiction', () => {
    const result = classifyAge(dobYearsAgo(10), 'za')
    expect(result).not.toBeNull()
    expect(result!.age).toBe(10)
    expect(result!.requiresCoppaConsent).toBe(true)
    expect(result!.requiresParentalConsent).toBe(true) // ZA minor threshold is 18
    expect(result!.isMinor).toBe(true)
  })

  it('classifies a 15-year-old as minor in ZA but not COPPA-requiring', () => {
    const result = classifyAge(dobYearsAgo(15), 'za')
    expect(result).not.toBeNull()
    expect(result!.age).toBe(15)
    expect(result!.requiresCoppaConsent).toBe(false)
    expect(result!.requiresParentalConsent).toBe(true) // ZA: <18
    expect(result!.isMinor).toBe(true)
  })

  it('classifies a 20-year-old as adult in ZA', () => {
    const result = classifyAge(dobYearsAgo(20), 'za')
    expect(result).not.toBeNull()
    expect(result!.age).toBe(20)
    expect(result!.isMinor).toBe(false)
    expect(result!.requiresCoppaConsent).toBe(false)
    expect(result!.requiresParentalConsent).toBe(false)
  })

  it('uses EU threshold (16) for EU jurisdiction', () => {
    const result = classifyAge(dobYearsAgo(14), 'eu')
    expect(result!.isMinor).toBe(true)
    expect(result!.requiresParentalConsent).toBe(true)

    const adult = classifyAge(dobYearsAgo(17), 'eu')
    expect(adult!.isMinor).toBe(false)
    expect(adult!.requiresParentalConsent).toBe(false)
  })

  it('uses US threshold (13) for US jurisdiction', () => {
    const result = classifyAge(dobYearsAgo(12), 'us')
    expect(result!.isMinor).toBe(true)
    expect(result!.requiresCoppaConsent).toBe(true)

    const teen = classifyAge(dobYearsAgo(14), 'us')
    expect(teen!.isMinor).toBe(false) // US: not minor at 14 (threshold is 13)
    expect(teen!.requiresCoppaConsent).toBe(false)
  })

  it('defaults to ZA jurisdiction when not specified', () => {
    const result = classifyAge(dobYearsAgo(16))
    expect(result!.jurisdiction).toBe('za')
    expect(result!.isMinor).toBe(true) // ZA threshold is 18
  })
})

describe('isUnderAgeOfConsent', () => {
  function dobYearsAgo(years: number): string {
    const d = new Date()
    d.setFullYear(d.getFullYear() - years)
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }

  it('returns false for null/undefined', () => {
    expect(isUnderAgeOfConsent(null)).toBe(false)
    expect(isUnderAgeOfConsent(undefined)).toBe(false)
  })

  it('returns true for a 10-year-old', () => {
    expect(isUnderAgeOfConsent(dobYearsAgo(10))).toBe(true)
  })

  it('returns false for a 15-year-old', () => {
    expect(isUnderAgeOfConsent(dobYearsAgo(15))).toBe(false)
  })
})

describe('REQUIRED_CONSENTS', () => {
  it('includes terms, privacy, and data processing', () => {
    expect(REQUIRED_CONSENTS).toContain('terms_of_service')
    expect(REQUIRED_CONSENTS).toContain('privacy_policy')
    expect(REQUIRED_CONSENTS).toContain('data_processing')
  })

  it('does not include optional purposes', () => {
    expect(REQUIRED_CONSENTS).not.toContain('marketing_communications')
    expect(REQUIRED_CONSENTS).not.toContain('analytics_tracking')
  })
})

describe('CURRENT_POLICY_VERSIONS', () => {
  it('has version strings for mandatory purposes', () => {
    expect(typeof CURRENT_POLICY_VERSIONS.terms_of_service).toBe('string')
    expect(typeof CURRENT_POLICY_VERSIONS.privacy_policy).toBe('string')
    expect(typeof CURRENT_POLICY_VERSIONS.data_processing).toBe('string')
    expect(typeof CURRENT_POLICY_VERSIONS.ai_data_usage).toBe('string')
  })

  it('versions are non-empty', () => {
    expect(CURRENT_POLICY_VERSIONS.terms_of_service.length).toBeGreaterThan(0)
    expect(CURRENT_POLICY_VERSIONS.privacy_policy.length).toBeGreaterThan(0)
  })
})
