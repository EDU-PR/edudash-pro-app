import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ChildSelector, SelectedChildCard } from '@/components/payments';
import { useParentPayments } from '@/hooks/useParentPayments';
import { getPOPFileUrl } from '@/lib/popUpload';
import { assertSupabase } from '@/lib/supabase';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import type { POPUpload, StudentFee } from '@/types/payments';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { isUniformLabel } from '@/lib/utils/feeUtils';

const isUniformUpload = (upload: POPUpload) =>
  isUniformLabel(upload.description) ||
  isUniformLabel(upload.title) ||
  isUniformLabel(upload.payment_reference || '');

const isUniformFee = (fee: StudentFee) =>
  isUniformLabel(fee.fee_type) || isUniformLabel(fee.description);

export default function ParentUniformPaymentsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { childId, studentId } = useLocalSearchParams<{ childId?: string; studentId?: string }>();
  const { showAlert, alertProps } = useAlertModal();

  const {
    loading,
    refreshing,
    children,
    selectedChildId,
    setSelectedChildId,
    selectedChild,
    studentFees,
    popUploads,
    onRefresh,
    reloadFees,
  } = useParentPayments();

  const requestedChildId = childId || studentId;

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!requestedChildId || children.length === 0) return;
    const exists = children.some(child => child.id === requestedChildId);
    if (exists) {
      setSelectedChildId(requestedChildId);
    }
  }, [requestedChildId, children, setSelectedChildId]);

  const uniformUploads = useMemo(
    () => popUploads.filter(isUniformUpload),
    [popUploads]
  );
  const pendingUploads = useMemo(
    () => uniformUploads.filter((upload) => upload.status !== 'approved'),
    [uniformUploads]
  );
  const uniformFees = useMemo(
    () => studentFees.filter(isUniformFee),
    [studentFees]
  );
  const paidUniformFees = useMemo(
    () => uniformFees.filter((fee) => fee.status === 'paid'),
    [uniformFees]
  );

  const openUrl = useCallback(async (url: string, title: string) => {
    const isPdf = /\.pdf(\?|$)/i.test(url);
    if (isPdf) {
      router.push({ pathname: '/screens/pdf-viewer', params: { url, title } });
      return;
    }
    await Linking.openURL(url);
  }, [router]);

  const openReceipt = useCallback(async (fee: StudentFee) => {
    try {
      let receiptUrl = fee.receipt_url || null;
      if (!receiptUrl && fee.receipt_storage_path) {
        const { data, error } = await assertSupabase().storage
          .from('generated-pdfs')
          .createSignedUrl(fee.receipt_storage_path, 3600);
        if (error) throw error;
        receiptUrl = data?.signedUrl || null;
      }

      if (!receiptUrl) {
        showAlert({
          title: 'Receipt unavailable',
          message: 'This payment does not have a receipt yet.',
          type: 'info',
          buttons: [{ text: 'OK' }],
        });
        return;
      }

      await openUrl(receiptUrl, 'Receipt');
    } catch (error: any) {
      showAlert({
        title: 'Receipt error',
        message: error?.message || 'Unable to open receipt.',
        type: 'error',
        buttons: [{ text: 'OK' }],
      });
    }
  }, [openUrl, showAlert]);

  const handleViewUpload = useCallback(async (upload: POPUpload) => {
    try {
      const signedUrl = await getPOPFileUrl(upload.upload_type as any, upload.file_path, 3600);
      if (!signedUrl) {
        showAlert({
          title: 'File unavailable',
          message: 'We could not load this proof of payment file.',
          type: 'error',
          buttons: [{ text: 'OK' }],
        });
        return;
      }
      await openUrl(signedUrl, 'Proof of Payment');
    } catch (error: any) {
      showAlert({
        title: 'File error',
        message: error?.message || 'Unable to open the file.',
        type: 'error',
        buttons: [{ text: 'OK' }],
      });
    }
  }, [openUrl, showAlert]);

  const handleRefresh = useCallback(async () => {
    await onRefresh();
    await reloadFees();
  }, [onRefresh, reloadFees]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Uniform Payments" />
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading uniform payments...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Uniform Payments" subtitle={selectedChild?.preschool_name} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        <ChildSelector
          children={children}
          selectedChildId={selectedChildId}
          onSelectChild={setSelectedChildId}
          theme={theme}
        />

        {selectedChild && (
          <SelectedChildCard child={selectedChild} theme={theme} />
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Uniform Uploads</Text>
          {pendingUploads.length === 0 ? (
            <Text style={styles.mutedText}>No pending uniform uploads.</Text>
          ) : (
            pendingUploads.map((upload) => (
              <View key={upload.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{upload.title}</Text>
                    <Text style={styles.cardSubtitle}>
                      {upload.payment_amount ? `R${upload.payment_amount.toFixed(2)} • ` : ''}
                      {new Date(upload.created_at).toLocaleDateString('en-ZA')}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{upload.status}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.linkButton} onPress={() => handleViewUpload(upload)}>
                  <Ionicons name="document-text-outline" size={14} color={theme.primary} />
                  <Text style={[styles.linkButtonText, { color: theme.primary }]}>View Proof</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uniform Payment History</Text>
          {paidUniformFees.length === 0 ? (
            <Text style={styles.mutedText}>No confirmed uniform payments yet.</Text>
          ) : (
            paidUniformFees.map((fee) => (
              <View key={fee.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{fee.description}</Text>
                    <Text style={styles.cardSubtitle}>
                      Paid {fee.paid_date ? new Date(fee.paid_date).toLocaleDateString('en-ZA') : '—'}
                    </Text>
                  </View>
                  <Text style={styles.amountText}>R{fee.amount.toFixed(2)}</Text>
                </View>
                {(fee.receipt_url || fee.receipt_storage_path) && (
                  <TouchableOpacity style={styles.linkButton} onPress={() => openReceipt(fee)}>
                    <Ionicons name="document-text-outline" size={14} color={theme.primary} />
                    <Text style={[styles.linkButtonText, { color: theme.primary }]}>View Receipt</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <AlertModal {...alertProps} />
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: theme.textSecondary, fontSize: 14 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 12 },
  mutedText: { color: theme.textSecondary, fontSize: 13 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardInfo: { flex: 1, marginRight: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: theme.textSecondary },
  amountText: { fontSize: 15, fontWeight: '600', color: theme.text },
  statusBadge: {
    backgroundColor: theme.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: '600', color: theme.primary },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  linkButtonText: { fontSize: 12, fontWeight: '600' },
});
