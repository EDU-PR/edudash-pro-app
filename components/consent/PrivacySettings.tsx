/**
 * PrivacySettings — User privacy & consent management screen
 *
 * Allows users to:
 *  - View and manage their consent preferences
 *  - Submit data subject rights requests (access, erasure, portability)
 *  - View data retention policies
 *
 * @module components/consent/PrivacySettings
 */

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native'
import { useConsent } from '@/hooks/useConsent'
import { ConsentService } from '@/lib/services/consentService'
import { useQuery } from '@tanstack/react-query'
import { consentKeys } from '@/hooks/useConsent'
import type { ConsentPurpose, ConsentFormItem, DataSubjectRequestType, DataRetentionPolicy, DataSubjectRequest } from '@/lib/types/consent'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PrivacySettingsProps {
  userId: string
  dateOfBirth?: string | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PrivacySettings({ userId, dateOfBirth }: PrivacySettingsProps) {
  const {
    formItems,
    grantConsent,
    withdrawConsent,
    isMutating,
    ageClassification,
  } = useConsent({ userId, dateOfBirth })

  const [submittingRequest, setSubmittingRequest] = useState(false)

  // ── Retention policies ──────────────────────────────────────────────
  const retentionQuery = useQuery({
    queryKey: consentKeys.retentionPolicies,
    queryFn: () => ConsentService.getRetentionPolicies(),
    staleTime: 30 * 60 * 1000,
  })

  // ── Data subject requests ───────────────────────────────────────────
  const dsrQuery = useQuery({
    queryKey: [...consentKeys.all, 'dsr', userId],
    queryFn: () => ConsentService.getDataSubjectRequests(userId),
    staleTime: 5 * 60 * 1000,
  })

  const handleToggleConsent = useCallback(
    async (purpose: ConsentPurpose, currentlyGranted: boolean) => {
      if (currentlyGranted) {
        Alert.alert(
          'Withdraw Consent',
          'Are you sure you want to withdraw this consent? Some features may become unavailable.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Withdraw',
              style: 'destructive',
              onPress: () => withdrawConsent(purpose, 'User-initiated withdrawal'),
            },
          ],
        )
      } else {
        await grantConsent(purpose)
      }
    },
    [grantConsent, withdrawConsent],
  )

  const handleSubmitDSR = useCallback(
    async (requestType: DataSubjectRequestType) => {
      const labels: Record<DataSubjectRequestType, string> = {
        access: 'Request My Data',
        rectification: 'Correct My Data',
        erasure: 'Delete My Data',
        portability: 'Export My Data',
        restriction: 'Restrict Processing',
        objection: 'Object to Processing',
      }

      Alert.alert(
        labels[requestType],
        `This will submit a formal data subject request. We will respond within 30 days as required by POPIA/GDPR.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Submit',
            onPress: async () => {
              setSubmittingRequest(true)
              try {
                await ConsentService.submitDataSubjectRequest(userId, requestType)
                Alert.alert('Request Submitted', 'We will process your request within 30 days.')
                dsrQuery.refetch()
              } catch {
                Alert.alert('Error', 'Failed to submit request. Please try again.')
              } finally {
                setSubmittingRequest(false)
              }
            },
          },
        ],
      )
    },
    [userId, dsrQuery],
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Privacy & Consent</Text>
        <Text style={styles.subtitle}>
          Manage your privacy preferences and exercise your data rights under
          POPIA and GDPR.
        </Text>
      </View>

      {/* Age badge */}
      {ageClassification && (
        <View style={styles.ageBadge}>
          <Text style={styles.ageBadgeText}>
            {ageClassification.isMinor ? '👧 Minor Account' : '👤 Adult Account'}
            {' — Age: '}
            {ageClassification.age}
          </Text>
        </View>
      )}

      {/* ── Consent Preferences ───────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Consent Preferences</Text>
        {formItems?.map((item: ConsentFormItem) => {
          const isGranted = item.currentStatus === 'granted'
          return (
            <Pressable
              key={item.purpose}
              style={styles.settingRow}
              onPress={() =>
                item.required && isGranted
                  ? null
                  : handleToggleConsent(item.purpose, isGranted)
              }
              disabled={isMutating || (item.required && isGranted)}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>
                  {item.label}
                  {item.required && <Text style={styles.required}> (Required)</Text>}
                </Text>
                <Text style={styles.settingDescription}>{item.description}</Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  isGranted ? styles.toggleOn : styles.toggleOff,
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    isGranted ? styles.toggleKnobOn : styles.toggleKnobOff,
                  ]}
                />
              </View>
            </Pressable>
          )
        })}
      </View>

      {/* ── Data Subject Rights ───────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Data Rights</Text>
        <Text style={styles.sectionSubtitle}>
          Under POPIA and GDPR, you have the following rights:
        </Text>

        {(
          [
            { type: 'access' as const, icon: '📋', label: 'Access My Data', desc: 'Request a copy of all personal data we hold about you.' },
            { type: 'portability' as const, icon: '📦', label: 'Export My Data', desc: 'Receive your data in a portable, machine-readable format.' },
            { type: 'rectification' as const, icon: '✏️', label: 'Correct My Data', desc: 'Request correction of inaccurate personal data.' },
            { type: 'erasure' as const, icon: '🗑️', label: 'Delete My Data', desc: 'Request deletion of your personal data (Right to be Forgotten).' },
            { type: 'restriction' as const, icon: '⏸️', label: 'Restrict Processing', desc: 'Request that we limit how we process your data.' },
            { type: 'objection' as const, icon: '🚫', label: 'Object to Processing', desc: 'Object to specific types of data processing.' },
          ] as const
        ).map(({ type, icon, label, desc }) => (
          <Pressable
            key={type}
            style={styles.dsrButton}
            onPress={() => handleSubmitDSR(type)}
            disabled={submittingRequest}
          >
            <Text style={styles.dsrIcon}>{icon}</Text>
            <View style={styles.dsrInfo}>
              <Text style={styles.dsrLabel}>{label}</Text>
              <Text style={styles.dsrDesc}>{desc}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* ── Pending Requests ──────────────────────────────── */}
      {(dsrQuery.data?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Requests</Text>
          {dsrQuery.data?.map((req: DataSubjectRequest) => (
            <View key={req.id} style={styles.requestRow}>
              <View style={styles.requestInfo}>
                <Text style={styles.requestType}>{req.request_type}</Text>
                <Text style={styles.requestDate}>
                  Submitted: {new Date(req.submitted_at).toLocaleDateString()}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  req.status === 'completed' && styles.statusCompleted,
                  req.status === 'processing' && styles.statusProcessing,
                  req.status === 'pending' && styles.statusPending,
                ]}
              >
                <Text style={styles.statusText}>{req.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Data Retention Policies ───────────────────────── */}
      {retentionQuery.data && retentionQuery.data.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Retention Policies</Text>
          <Text style={styles.sectionSubtitle}>
            How long we keep different types of data:
          </Text>
          {retentionQuery.data.map((policy: DataRetentionPolicy) => (
            <View key={policy.category} style={styles.retentionRow}>
              <Text style={styles.retentionCategory}>
                {policy.category.replace(/_/g, ' ')}
              </Text>
              <View style={styles.retentionDetails}>
                <Text style={styles.retentionPeriod}>
                  {policy.retentionPeriodDays} days
                  {policy.autoDeleteEnabled && ' (auto-delete)'}
                </Text>
                <Text style={styles.retentionBasis}>
                  Legal basis: {policy.legalBasis.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Compliance footer */}
      <Text style={styles.footer}>
        For questions about your privacy, contact privacy@edudashpro.org.za.
        Response time: within 30 days as required by POPIA §18 and GDPR Art 12.
      </Text>
    </ScrollView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 20, paddingBottom: 48 },
  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  ageBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  ageBadgeText: { fontSize: 13, color: '#4338CA', fontWeight: '600' },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  required: { color: '#EF4444', fontSize: 12 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 3 },
  settingDescription: { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: '#4F46E5' },
  toggleOff: { backgroundColor: '#D1D5DB' },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  toggleKnobOff: { alignSelf: 'flex-start' },
  dsrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  dsrIcon: { fontSize: 20, marginRight: 12 },
  dsrInfo: { flex: 1 },
  dsrLabel: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  dsrDesc: { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginBottom: 6,
  },
  requestInfo: { flex: 1 },
  requestType: { fontSize: 14, fontWeight: '600', color: '#111827', textTransform: 'capitalize' },
  requestDate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusProcessing: { backgroundColor: '#DBEAFE' },
  statusCompleted: { backgroundColor: '#D1FAE5' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#374151', textTransform: 'capitalize' },
  retentionRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    marginBottom: 6,
  },
  retentionCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  retentionDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  retentionPeriod: { fontSize: 12, color: '#6B7280' },
  retentionBasis: { fontSize: 12, color: '#9CA3AF' },
  footer: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 16,
    paddingHorizontal: 12,
  },
})
