import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StudentFee, FeeStructure } from '@/types/payments';
import { formatCurrency, formatPaymentDate, getFeeStatusColor } from '@/lib/utils/payment-utils';

interface FeeCardProps {
  fee: StudentFee;
  onUploadPress: (fee: StudentFee) => void;
  onPayPress?: (fee: StudentFee) => void;
  theme: any;
}

export function FeeCard({ fee, onUploadPress, onPayPress, theme }: FeeCardProps) {
  const styles = createStyles(theme);
  const statusInfo = getFeeStatusColor(fee.due_date, fee.grace_period_days);
  
  // Handle pending_verification status specially
  const isPendingVerification = fee.status === 'pending_verification';
  const displayStatus = isPendingVerification ? 'Awaiting Verification' : 
    fee.status === 'pending' ? 'Pending' : 
    fee.status === 'paid' ? 'Paid' :
    fee.status === 'overdue' ? 'Overdue' :
    fee.status;
  
  const statusColor = isPendingVerification ? theme.warning : statusInfo.color;
  const statusBgColor = isPendingVerification ? theme.warning + '20' : statusInfo.bgColor;

  return (
    <View style={styles.feeCard}>
      <View style={styles.feeHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.feeTitle}>{fee.description}</Text>
          <View style={styles.feeDateRow}>
            <Ionicons name="calendar" size={14} color={theme.textSecondary} />
            <Text style={styles.feeDueDate}>Due: {formatPaymentDate(fee.due_date)}</Text>
          </View>
        </View>
        <Text style={styles.feeAmount}>{formatCurrency(fee.amount)}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
        <Ionicons 
          name={isPendingVerification ? "hourglass-outline" : "time-outline"} 
          size={12} 
          color={statusColor} 
        />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {displayStatus}
        </Text>
      </View>
      {isPendingVerification && (
        <View style={[styles.verificationNotice, { backgroundColor: theme.warning + '10', borderColor: theme.warning + '30' }]}>
          <Ionicons name="document-text-outline" size={16} color={theme.warning} />
          <Text style={[styles.verificationNoticeText, { color: theme.textSecondary }]}>
            Your proof of payment has been uploaded and is being reviewed by the school.
          </Text>
        </View>
      )}
      {!isPendingVerification && (
        <View style={[styles.dueSoonLabel, { backgroundColor: statusInfo.bgColor }]}>
          <Text style={[styles.dueSoonLabelText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      )}
      <View style={styles.feeActions}>
        {!isPendingVerification && (
          <>
            <TouchableOpacity 
              style={styles.payNowButton}
              onPress={() => onPayPress?.(fee)}
            >
              <Ionicons name="card-outline" size={16} color="#fff" />
              <Text style={styles.payNowText}>Pay Now</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.uploadProofButton}
              onPress={() => onUploadPress(fee)}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={theme.primary} />
              <Text style={[styles.uploadProofText, { color: theme.primary }]}>Upload Proof</Text>
            </TouchableOpacity>
          </>
        )}
        {isPendingVerification && (
          <View style={styles.pendingActionNotice}>
            <Ionicons name="checkmark-circle" size={16} color={theme.success} />
            <Text style={[styles.pendingActionText, { color: theme.success }]}>
              POP Uploaded - Awaiting Review
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

interface UpcomingFeesListProps {
  fees: StudentFee[];
  onUploadPress: (fee: StudentFee) => void;
  onPayPress?: (fee: StudentFee) => void;
  theme: any;
}

export function UpcomingFeesList({ fees, onUploadPress, onPayPress, theme }: UpcomingFeesListProps) {
  const styles = createStyles(theme);

  if (fees.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="checkmark-circle-outline" size={48} color={theme.success} />
        <Text style={styles.emptyTitle}>All Caught Up!</Text>
        <Text style={styles.emptySubtitle}>No outstanding payments at the moment.</Text>
      </View>
    );
  }

  return (
    <>
      {fees.map(fee => (
        <FeeCard key={fee.id} fee={fee} onUploadPress={onUploadPress} onPayPress={onPayPress} theme={theme} />
      ))}
    </>
  );
}

interface FeeStructureListProps {
  feeStructure: FeeStructure[];
  theme: any;
}

export function FeeStructureList({ feeStructure, theme }: FeeStructureListProps) {
  const styles = createStyles(theme);

  if (feeStructure.length === 0) return null;

  return (
    <>
      <Text style={styles.sectionTitle}>School Fee Structure</Text>
      {feeStructure.map(fee => (
        <View key={fee.id} style={styles.feeStructureCard}>
          <View style={styles.feeStructureRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.feeStructureType}>{fee.fee_type}</Text>
              <Text style={styles.feeStructureDesc}>{fee.description}</Text>
              {fee.payment_frequency && (
                <Text style={styles.feeStructureFreq}>• {fee.payment_frequency}</Text>
              )}
            </View>
            <Text style={styles.feeStructureAmount}>{formatCurrency(fee.amount)}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  feeCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  feeTitle: { fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 4 },
  feeDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feeDueDate: { fontSize: 12, color: theme.textSecondary },
  feeAmount: { fontSize: 20, fontWeight: '700', color: theme.primary },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  dueSoonLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  dueSoonLabelText: { fontSize: 11, fontWeight: '500' },
  feeActions: { flexDirection: 'row', gap: 8 },
  payNowButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  payNowText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  uploadProofButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.primary + '15',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.primary + '40',
  },
  uploadProofText: { fontSize: 14, fontWeight: '600' },
  verificationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  verificationNoticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  pendingActionNotice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.success + '15',
  },
  pendingActionText: { fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.text, marginTop: 12, marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 12, marginTop: 24 },
  feeStructureCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  feeStructureRow: { flexDirection: 'row', alignItems: 'center' },
  feeStructureType: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 2 },
  feeStructureDesc: { fontSize: 12, color: theme.textSecondary, marginBottom: 2 },
  feeStructureFreq: { fontSize: 11, color: theme.textSecondary },
  feeStructureAmount: { fontSize: 16, fontWeight: '700', color: theme.text },
});
