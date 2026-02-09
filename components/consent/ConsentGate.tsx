/**
 * ConsentGate — Blocks UI until required consents are obtained
 *
 * Wraps any protected content and shows a consent form
 * if the user hasn't granted all required consents.
 *
 * Usage:
 *   <ConsentGate userId={user.id} dateOfBirth={profile.date_of_birth}>
 *     <TeacherDashboard />
 *   </ConsentGate>
 *
 * @module components/consent/ConsentGate
 */

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native'
import { useConsent } from '@/hooks/useConsent'
import type { ConsentFormItem, ConsentPurpose, ConsentMetadata } from '@/lib/types/consent'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConsentGateProps {
  userId: string
  dateOfBirth?: string | null
  /** Content to render once consents are granted */
  children: React.ReactNode
  /** Optional: override the loading indicator */
  loadingComponent?: React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConsentGate({
  userId,
  dateOfBirth,
  children,
  loadingComponent,
}: ConsentGateProps) {
  const {
    gateResult,
    isGateLoading,
    hasAllConsents,
    formItems,
    grantConsent,
    acceptAllRequired,
    isMutating,
  } = useConsent({ userId, dateOfBirth })

  // Track which optional consents the user has toggled
  const [optionalSelections, setOptionalSelections] = useState<
    Record<ConsentPurpose, boolean>
  >({} as Record<ConsentPurpose, boolean>)

  const handleToggle = useCallback((purpose: ConsentPurpose) => {
    setOptionalSelections((prev) => ({
      ...prev,
      [purpose]: !prev[purpose],
    }))
  }, [])

  const handleAcceptAll = useCallback(async () => {
    // Grant required consents
    await acceptAllRequired()

    // Grant any selected optional consents
    for (const [purpose, selected] of Object.entries(optionalSelections)) {
      if (selected) {
        await grantConsent(purpose as ConsentPurpose)
      }
    }
  }, [acceptAllRequired, grantConsent, optionalSelections])

  // ── Loading ─────────────────────────────────────────────────────────
  if (isGateLoading) {
    return (
      loadingComponent ?? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Checking consent status…</Text>
        </View>
      )
    )
  }

  // ── All consents granted → render children ──────────────────────────
  if (hasAllConsents) {
    return <>{children}</>
  }

  // ── Consent form ────────────────────────────────────────────────────
  const requiredItems = formItems?.filter((i: ConsentFormItem) => i.required) ?? []
  const optionalItems = formItems?.filter((i: ConsentFormItem) => !i.required) ?? []
  const allRequiredGranted = requiredItems.every(
    (i: ConsentFormItem) => i.currentStatus === 'granted',
  )

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to EduDash Pro</Text>
        <Text style={styles.subtitle}>
          Before you continue, please review and accept the following:
        </Text>
      </View>

      {/* Parental consent notice */}
      {gateResult?.pendingParentalConsent && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ This account belongs to a minor. A parent or guardian must
            provide consent before the account can be used.
          </Text>
        </View>
      )}

      {/* Required consents */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Required</Text>
        {requiredItems.map((item: ConsentFormItem) => (
          <ConsentItem
            key={item.purpose}
            item={item}
            checked={item.currentStatus === 'granted'}
            disabled
          />
        ))}
      </View>

      {/* Optional consents */}
      {optionalItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Optional</Text>
          {optionalItems.map((item: ConsentFormItem) => (
            <ConsentItem
              key={item.purpose}
              item={item}
              checked={
                item.currentStatus === 'granted' ||
                optionalSelections[item.purpose] === true
              }
              onToggle={() => handleToggle(item.purpose)}
            />
          ))}
        </View>
      )}

      {/* Policy links */}
      <View style={styles.links}>
        <Pressable
          onPress={() => Linking.openURL('/privacy-policy')}
          style={styles.link}
        >
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Pressable>
        <Text style={styles.linkSeparator}>•</Text>
        <Pressable
          onPress={() => Linking.openURL('/terms-of-service')}
          style={styles.link}
        >
          <Text style={styles.linkText}>Terms of Service</Text>
        </Pressable>
      </View>

      {/* Accept button */}
      <Pressable
        style={[styles.acceptButton, isMutating && styles.acceptButtonDisabled]}
        onPress={handleAcceptAll}
        disabled={isMutating}
      >
        {isMutating ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.acceptButtonText}>
            Accept &amp; Continue
          </Text>
        )}
      </Pressable>

      {/* Compliance footer */}
      <Text style={styles.complianceText}>
        Your data is protected under the Protection of Personal Information Act
        (POPIA) and the Children's Online Privacy Protection Act (COPPA). You
        can withdraw consent at any time from Settings → Privacy.
      </Text>
    </ScrollView>
  )
}

// ---------------------------------------------------------------------------
// ConsentItem sub-component
// ---------------------------------------------------------------------------

function ConsentItem({
  item,
  checked,
  onToggle,
  disabled,
}: {
  item: ConsentFormItem
  checked: boolean
  onToggle?: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      style={[styles.consentItem, disabled && styles.consentItemDisabled]}
      onPress={disabled ? undefined : onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={item.label}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.consentItemText}>
        <Text style={styles.consentLabel}>
          {item.label}
          {item.required && <Text style={styles.required}> *</Text>}
        </Text>
        <Text style={styles.consentDescription}>{item.description}</Text>
      </View>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  warningBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  consentItemDisabled: {
    opacity: 0.7,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  consentItemText: {
    flex: 1,
  },
  consentLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  required: {
    color: '#EF4444',
    fontSize: 14,
  },
  consentDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  link: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
  },
  linkSeparator: {
    fontSize: 14,
    color: '#D1D5DB',
    marginHorizontal: 4,
  },
  acceptButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  complianceText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
})
