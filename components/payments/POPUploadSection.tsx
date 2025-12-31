import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { POPUpload } from '@/types/payments';
import { formatCurrency, formatPaymentDate, getUploadStatusColor } from '@/lib/utils/payment-utils';

interface POPUploadSectionProps {
  popUploads: POPUpload[];
  onUploadPress: () => void;
  theme: any;
}

export function POPUploadSection({ popUploads, onUploadPress, theme }: POPUploadSectionProps) {
  const styles = createStyles(theme);

  return (
    <View>
      <TouchableOpacity style={styles.uploadButton} onPress={onUploadPress}>
        <View style={styles.uploadIcon}>
          <Ionicons name="cloud-upload" size={32} color={theme.primary} />
        </View>
        <Text style={styles.uploadButtonTitle}>Upload New Proof</Text>
        <Text style={styles.uploadButtonSubtitle}>PDF, JPG or PNG (max 10MB)</Text>
      </TouchableOpacity>

      {popUploads.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Previous Uploads</Text>
          {popUploads.map(upload => (
            <POPUploadCard key={upload.id} upload={upload} theme={theme} />
          ))}
        </>
      )}
    </View>
  );
}

interface POPUploadCardProps {
  upload: POPUpload;
  theme: any;
}

function POPUploadCard({ upload, theme }: POPUploadCardProps) {
  const styles = createStyles(theme);
  const statusColors = getUploadStatusColor(upload.status);

  return (
    <View style={styles.uploadHistoryCard}>
      <View style={styles.uploadHistoryRow}>
        <Ionicons 
          name={upload.file_name.endsWith('.pdf') ? 'document-text' : 'image'} 
          size={24} 
          color={theme.primary} 
        />
        <View style={styles.uploadHistoryInfo}>
          <Text style={styles.uploadHistoryTitle}>{upload.title}</Text>
          <Text style={styles.uploadHistoryDate}>
            {formatPaymentDate(upload.created_at)}
            {upload.payment_amount && ` • ${formatCurrency(upload.payment_amount)}`}
          </Text>
        </View>
        <View style={[styles.uploadStatusBadge, { backgroundColor: statusColors.bgColor }]}>
          <Text style={[styles.uploadStatusText, { color: statusColors.color }]}>
            {upload.status.charAt(0).toUpperCase() + upload.status.slice(1)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  uploadButton: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.primary + '40',
    borderStyle: 'dashed',
  },
  uploadIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadButtonTitle: { fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 4 },
  uploadButtonSubtitle: { fontSize: 12, color: theme.textSecondary },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 12, marginTop: 24 },
  uploadHistoryCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  uploadHistoryRow: { flexDirection: 'row', alignItems: 'center' },
  uploadHistoryInfo: { flex: 1, marginLeft: 12 },
  uploadHistoryTitle: { fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 2 },
  uploadHistoryDate: { fontSize: 12, color: theme.textSecondary },
  uploadStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  uploadStatusText: { fontSize: 11, fontWeight: '600' },
});
