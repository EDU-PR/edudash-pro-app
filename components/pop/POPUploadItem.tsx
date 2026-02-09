/**
 * POPUploadItem — extracted from parent-pop-history.tsx
 *
 * Renders a single POP upload card with status, metadata,
 * optional image preview, review notes, and action buttons.
 */
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { POPUpload, usePOPFileUrl } from '@/hooks/usePOPUploads';
import { formatFileSize } from '@/lib/popUpload';

interface Props {
  upload: POPUpload;
  onPress: () => void;
  onDelete: () => void;
}

const getStatusColor = (status: string, theme: any) => {
  switch (status) {
    case 'approved': return theme.success;
    case 'rejected': return theme.error;
    case 'needs_revision': return theme.warning;
    default: return theme.textSecondary;
  }
};

const getStatusIcon = (status: string): any => {
  switch (status) {
    case 'approved': return 'checkmark-circle';
    case 'rejected': return 'close-circle';
    case 'needs_revision': return 'warning';
    default: return 'time';
  }
};

export const POPUploadItem: React.FC<Props> = ({ upload, onPress, onDelete }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { data: fileUrl } = usePOPFileUrl(upload);
  const statusColor = getStatusColor(upload.status, theme);

  const s = StyleSheet.create({
    container: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: theme.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
    typeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    headerContent: { flex: 1 },
    title: { fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 4 },
    typeLabel: { fontSize: 12, color: theme.textSecondary, textTransform: 'capitalize' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
    statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
    description: { fontSize: 14, color: theme.textSecondary, lineHeight: 18, marginBottom: 8 },
    metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 12 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: theme.textSecondary },
    filePreview: { marginBottom: 12, alignItems: 'center' },
    image: { width: 100, height: 100, borderRadius: 8, backgroundColor: theme.textSecondary + '20' },
    reviewSection: { backgroundColor: theme.elevated, borderRadius: 8, padding: 12, marginBottom: 12 },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    reviewTitle: { fontSize: 14, fontWeight: '600', color: theme.text, marginLeft: 8 },
    reviewNotes: { fontSize: 14, color: theme.textSecondary, lineHeight: 18 },
    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    viewBtn: { backgroundColor: theme.primary + '20' },
    deleteBtn: { backgroundColor: theme.error + '20' },
    actionText: { fontSize: 14, fontWeight: '600' },
    viewText: { color: theme.primary },
    deleteText: { color: theme.error },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={[s.typeIcon, { backgroundColor: (upload.upload_type === 'proof_of_payment' ? theme.warning : theme.accent) + '20' }]}>
          <Ionicons name={upload.upload_type === 'proof_of_payment' ? 'receipt' : 'camera'} size={20} color={upload.upload_type === 'proof_of_payment' ? theme.warning : theme.accent} />
        </View>
        <View style={s.headerContent}>
          <Text style={s.title} numberOfLines={2}>{upload.title}</Text>
          <Text style={s.typeLabel}>{upload.upload_type === 'proof_of_payment' ? t('pop.proofOfPayment') : t('pop.pictureOfProgress')}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Ionicons name={getStatusIcon(upload.status)} size={14} color={statusColor} />
          <Text style={[s.statusText, { color: statusColor }]}>{t(`pop.${upload.status}`)}</Text>
        </View>
      </View>

      {upload.description ? <Text style={s.description} numberOfLines={2}>{upload.description}</Text> : null}

      <View style={s.metadata}>
        <View style={s.metaItem}>
          <Ionicons name="calendar" size={12} color={theme.textSecondary} />
          <Text style={s.metaText}>{t('pop.uploadedOn')} {new Date(upload.created_at).toLocaleDateString()}</Text>
        </View>
        {upload.file_size ? <View style={s.metaItem}><Ionicons name="document" size={12} color={theme.textSecondary} /><Text style={s.metaText}>{formatFileSize(upload.file_size)}</Text></View> : null}
        {upload.upload_type === 'proof_of_payment' && upload.payment_amount ? <View style={s.metaItem}><Ionicons name="card" size={12} color={theme.textSecondary} /><Text style={s.metaText}>R{upload.payment_amount.toLocaleString()}</Text></View> : null}
        {upload.upload_type === 'picture_of_progress' && upload.subject ? <View style={s.metaItem}><Ionicons name="book" size={12} color={theme.textSecondary} /><Text style={[s.metaText, { textTransform: 'capitalize' }]}>{upload.subject.replace('_', ' ')}</Text></View> : null}
      </View>

      {upload.file_type?.startsWith('image/') && fileUrl ? <View style={s.filePreview}><Image source={{ uri: fileUrl }} style={s.image} /></View> : null}

      {upload.status !== 'pending' && upload.review_notes ? (
        <View style={s.reviewSection}>
          <View style={s.reviewHeader}>
            <Ionicons name="person" size={16} color={theme.textSecondary} />
            <Text style={s.reviewTitle}>{t('pop.reviewedBy')} {upload.reviewer_name || 'Teacher'}</Text>
          </View>
          <Text style={s.reviewNotes}>{upload.review_notes}</Text>
        </View>
      ) : null}

      <View style={s.actions}>
        <TouchableOpacity style={[s.actionBtn, s.viewBtn]} onPress={onPress}>
          <Ionicons name="eye" size={16} color={theme.primary} />
          <Text style={[s.actionText, s.viewText]}>{t('pop.viewFile')}</Text>
        </TouchableOpacity>
        {upload.status === 'pending' && (
          <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={onDelete}>
            <Ionicons name="trash" size={16} color={theme.error} />
            <Text style={[s.actionText, s.deleteText]}>{t('pop.deleteUpload')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
