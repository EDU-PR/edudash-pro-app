/**
 * POP History Screen
 *
 * Lists all proof-of-payment and picture-of-progress uploads with
 * filtering by type and status. Inline components extracted to
 * components/pop/POPFilterModal and POPUploadItem.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { useMyPOPUploads, POPUpload, useDeletePOPUpload } from '@/hooks/usePOPUploads';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { POPFilterModal } from '@/components/pop/POPFilterModal';
import { POPUploadItem } from '@/components/pop/POPUploadItem';

export default function POPHistoryScreen() {
  const { type: initialType, status: initialStatus } = useLocalSearchParams<{ type?: string; status?: string }>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { showAlert, alertProps } = useAlertModal();
  const deleteUpload = useDeletePOPUpload();

  const [filterType, setFilterType] = useState(initialType || '');
  const [filterStatus, setFilterStatus] = useState(initialStatus || '');
  const [showFilters, setShowFilters] = useState(false);

  const { data: uploads = [], isLoading } = useMyPOPUploads({ upload_type: filterType as any, status: filterStatus });

  const filteredUploads = useMemo(() => {
    return uploads.filter(u => {
      if (filterType && u.upload_type !== filterType) return false;
      if (filterStatus && u.status !== filterStatus) return false;
      return true;
    });
  }, [uploads, filterType, filterStatus]);

  const handleDeleteUpload = (upload: POPUpload) => {
    showAlert({
      title: 'Delete Upload',
      message: `Are you sure you want to delete "${upload.title}"?`,
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUpload.mutateAsync(upload.id);
            } catch {
              showAlert({ title: t('common.error'), message: 'Failed to delete upload' });
            }
          },
        },
      ],
    });
  };

  const handleViewFile = (upload: POPUpload) => {
    router.push(`/file-viewer?uploadId=${upload.id}`);
  };

  const activeFiltersCount = [filterType, filterStatus].filter(Boolean).length;

  const styles = useMemo(() => createStyles(theme), [theme]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <RoleBasedHeader title={t('pop.popHistory')} showBackButton />
        <View style={styles.loadingContainer}>
          <SkeletonLoader width="100%" height={120} borderRadius={12} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={120} borderRadius={12} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={120} borderRadius={12} style={{ marginBottom: 12 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RoleBasedHeader title={t('pop.popHistory')} showBackButton />

      <View style={styles.headerActions}>
        <TouchableOpacity style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]} onPress={() => setShowFilters(true)}>
          <Ionicons name="filter" size={16} color={activeFiltersCount > 0 ? theme.primary : theme.textSecondary} />
          <Text style={[styles.filterButtonText, activeFiltersCount > 0 && styles.filterButtonTextActive]}>{t('pop.filterBy')}</Text>
          {activeFiltersCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{activeFiltersCount}</Text></View>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {filteredUploads.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color={theme.textSecondary} />
            <Text style={styles.emptyTitle}>{t('pop.noUploads')}</Text>
            <Text style={styles.emptySubtitle}>{t('pop.noUploadsDesc')}</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/screens/parent-proof-of-payment')}>
              <Text style={styles.emptyButtonText}>{t('pop.uploadFirst')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredUploads.map(upload => (
            <POPUploadItem key={upload.id} upload={upload} onPress={() => handleViewFile(upload)} onDelete={() => handleDeleteUpload(upload)} />
          ))
        )}
      </ScrollView>

      {filteredUploads.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/screens/parent-proof-of-payment')}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <POPFilterModal visible={showFilters} onClose={() => setShowFilters(false)} currentType={filterType} currentStatus={filterStatus} onApply={(type, status) => { setFilterType(type); setFilterStatus(status); }} />
      <AlertModal {...alertProps} />
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  filterButtonActive: { backgroundColor: theme.primary + '20', borderColor: theme.primary },
  filterButtonText: { fontSize: 14, fontWeight: '500', color: theme.textSecondary },
  filterButtonTextActive: { color: theme.primary },
  badge: { backgroundColor: theme.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  badgeText: { fontSize: 12, fontWeight: '600', color: theme.onPrimary },
  content: { flex: 1, padding: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.text, marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyButton: { backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  emptyButtonText: { color: theme.onPrimary, fontSize: 14, fontWeight: '600' },
  loadingContainer: { flex: 1, padding: 16 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
