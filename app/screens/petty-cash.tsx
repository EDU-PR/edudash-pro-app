/**
 * Petty Cash Management Screen
 * 
 * Principal-only screen for managing petty cash:
 * - Track daily expenses (stationery, maintenance, refreshments)
 * - Cash on hand tracking and replenishments
 * - Receipt management and reconciliation
 * 
 * Refactored to use modular components per WARP.md standards
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { navigateBack } from '@/lib/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import { withPettyCashTenant } from '@/lib/utils/pettyCashTenant';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { logger } from '@/lib/logger';

// Modular components
import { PettyCashSummaryCard } from '@/components/petty-cash/PettyCashSummary';
import { PettyCashActions } from '@/components/petty-cash/PettyCashActions';
import { PettyCashTransactionList } from '@/components/petty-cash/PettyCashTransactionList';
import { PettyCashModals } from '@/components/petty-cash/PettyCashModals';
import { ImageConfirmModal } from '@/components/ui/ImageConfirmModal';

// Hook for data management
import { usePettyCash, type ExpenseFormData } from '@/hooks/usePettyCash';

interface ReceiptItem {
  id: string;
  url: string;
  fileName?: string;
}

export default function PettyCashScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const router = useRouter();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { showAlert, alertProps } = useAlertModal();

  // Use the petty cash hook for all data operations
  const {
    transactions,
    summary,
    accountId,
    preschoolId,
    loading,
    refreshing,
    loadPettyCashData,
    addExpense,
    addReplenishment,
    addWithdrawal,
    resetPettyCash,
    cancelTransaction,
    deleteTransaction,
    reverseTransaction,
    canDelete,
    onRefresh,
  } = usePettyCash(showAlert);

  // Modal visibility state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showReplenishment, setShowReplenishment] = useState(false);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);
  const [pendingReceipt, setPendingReceipt] = useState<{ uri: string; transactionId: string } | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Receipts state
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);

  useEffect(() => {
    loadPettyCashData();
  }, [loadPettyCashData]);

  // Receipt upload handler
  const uploadReceiptImage = async (imageUri: string, transactionId: string): Promise<string | null> => {
    try {
      let blob: Blob;
      try {
        if (imageUri.startsWith('file://') && typeof window !== 'undefined') {
          logger.warn('PettyCash', 'File URI detected in web environment');
          return null;
        }
        const response = await fetch(imageUri);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
        blob = await response.blob();
      } catch (fetchError) {
        logger.error('PettyCash', 'Error fetching image:', fetchError);
        return null;
      }

      const fileExt = String(imageUri.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `receipt_${transactionId}_${Date.now()}.${fileExt}`;
      const storagePath = `${preschoolId}/${transactionId}/${fileName}`;

      const { data, error } = await assertSupabase().storage
        .from('petty-cash-receipts')
        .upload(storagePath, blob, {
          contentType: `image/${fileExt}`,
          cacheControl: '3600',
        });
      
      if (error) throw error;

      try {
        const { error: receiptError } = await withPettyCashTenant((column, client) =>
          client
            .from('petty_cash_receipts')
            .insert({
              [column]: preschoolId,
              transaction_id: transactionId,
              storage_path: data.path,
              file_name: fileName,
              created_by: user?.id,
            })
        );
        if (receiptError) {
          throw receiptError;
        }
      } catch (e) {
        logger.warn('PettyCash', 'Failed to record petty cash receipt row:', e);
      }
      
      return data.path;
    } catch (error) {
      logger.error('PettyCash', 'Error uploading receipt:', error);
      return null;
    }
  };

  const handleResetPettyCash = () => {
    showAlert({
      title: t('petty_cash.reset_title', { defaultValue: 'Reset Petty Cash' }),
      message: t('petty_cash.reset_confirm', { defaultValue: 'This will create a reset entry to bring the balance to zero. Continue?' }),
      type: 'warning',
      buttons: [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('petty_cash.reset_cash', { defaultValue: 'Reset Cash to Zero' }),
          style: 'destructive',
          onPress: async () => { await resetPettyCash(); },
        },
      ],
    });
  };

  // Wrapper for addExpense that includes receipt upload
  const handleAddExpense = async (form: ExpenseFormData, receiptImage: string | null): Promise<boolean> => {
    return addExpense(form, receiptImage, uploadReceiptImage);
  };

  // View receipts for a transaction
  const viewReceiptsForTransaction = async (transactionId: string) => {
    try {
      setReceiptsLoading(true);
      setShowReceipts(true);

      const { data: rows, error } = await assertSupabase()
        .from('petty_cash_receipts')
        .select('id, storage_path, file_name')
        .eq('transaction_id', transactionId)
        .limit(10);

      if (error) throw error;

      const list = rows || [];
      if (list.length === 0) {
        setShowReceipts(false);
        showAlert({
          title: t('common.info', { defaultValue: 'Information' }),
          message: t('receipt.no_receipts', { defaultValue: 'No receipts attached for this transaction.' }),
          type: 'info',
          buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
        });
        return;
      }

      const items: ReceiptItem[] = [];
      for (const r of list) {
        try {
          const { data: signed } = await assertSupabase()
            .storage
            .from('petty-cash-receipts')
            .createSignedUrl(r.storage_path, 3600);
          if (signed?.signedUrl) {
            items.push({ id: r.id, url: signed.signedUrl, fileName: r.file_name });
          }
        } catch {
          // skip failed items
        }
      }

      setReceiptItems(items);
    } catch {
      setShowReceipts(false);
      showAlert({
        title: t('common.error'),
        message: t('receipt.error_select_image', { defaultValue: 'Failed to load receipts' }),
        type: 'error',
        buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
      });
    } finally {
      setReceiptsLoading(false);
    }
  };

  // Attach receipt to existing transaction
  const attachReceiptToTransaction = async (transactionId: string) => {
    const ImagePicker = require('expo-image-picker');
    
    showAlert({
      title: t('receipt.attach_receipt', { defaultValue: 'Attach Receipt' }),
      message: t('receipt.choose_method', { defaultValue: 'Choose how to add your receipt:' }),
      type: 'info',
      buttons: [
        {
          text: t('receipt.take_photo', { defaultValue: 'Take Photo' }),
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                showAlert({
                  title: t('receipt.permission_required'),
                  message: t('receipt.camera_permission'),
                  type: 'warning',
                  buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
                });
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
              });
              if (!result.canceled && result.assets[0]) {
                setPendingReceipt({ uri: result.assets[0].uri, transactionId });
              }
            } catch {
              showAlert({
                title: t('common.error'),
                message: t('receipt.attached_failed', { defaultValue: 'Failed to attach receipt' }),
                type: 'error',
                buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
              });
            }
          },
        },
        {
          text: t('receipt.choose_from_gallery', { defaultValue: 'Choose from Gallery' }),
          onPress: async () => {
            try {
              const hasPermission = await ensureImageLibraryPermission();
              if (!hasPermission) {
                showAlert({
                  title: t('receipt.permission_required'),
                  message: t('receipt.gallery_permission'),
                  type: 'warning',
                  buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
                });
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
              });
              if (!result.canceled && result.assets[0]) {
                setPendingReceipt({ uri: result.assets[0].uri, transactionId });
              }
            } catch {
              showAlert({
                title: t('common.error'),
                message: t('receipt.attached_failed', { defaultValue: 'Failed to attach receipt' }),
                type: 'error',
                buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
              });
            }
          },
        },
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
      ],
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="wallet-outline" size={48} color="#6B7280" />
          <Text style={styles.loadingText}>{t('petty_cash.loading_data', 'Loading petty cash data...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateBack('/screens/financial-dashboard')}>
          <Ionicons name="arrow-back" size={24} color={theme?.text || '#333'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('petty_cash.petty_cash')}</Text>
        <TouchableOpacity onPress={() => router.push('/screens/financial-reports')}>
          <Ionicons name="document-text" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Balance Summary */}
        <PettyCashSummaryCard summary={summary} theme={theme} />

        {/* Quick Actions */}
        <PettyCashActions
          onAddExpense={() => setShowAddExpense(true)}
          onReplenish={() => setShowReplenishment(true)}
          onWithdraw={() => setShowWithdrawal(true)}
          onReset={handleResetPettyCash}
          theme={theme}
        />

        {/* Transaction List */}
        <PettyCashTransactionList
          transactions={transactions}
          onViewReceipts={viewReceiptsForTransaction}
          onAttachReceipt={attachReceiptToTransaction}
          onCancelTransaction={cancelTransaction}
          onReverseTransaction={reverseTransaction}
          onDeleteTransaction={deleteTransaction}
          canDelete={canDelete}
          showAlert={showAlert}
          theme={theme}
        />
      </ScrollView>

      {/* All Modals */}
        <PettyCashModals
          showAddExpense={showAddExpense}
          showReplenishment={showReplenishment}
          showWithdrawal={showWithdrawal}
          showReceipts={showReceipts}
        setShowAddExpense={setShowAddExpense}
        setShowReplenishment={setShowReplenishment}
        setShowWithdrawal={setShowWithdrawal}
        setShowReceipts={setShowReceipts}
        summary={summary}
        receiptItems={receiptItems}
        receiptsLoading={receiptsLoading}
          onAddExpense={handleAddExpense}
          onAddReplenishment={addReplenishment}
          onAddWithdrawal={addWithdrawal}
          showAlert={showAlert}
          theme={theme}
        />

      {/* Receipt confirm modal */}
      <ImageConfirmModal
        visible={!!pendingReceipt}
        imageUri={pendingReceipt?.uri ?? null}
        onConfirm={async (uri) => {
          if (pendingReceipt) {
            setUploadingReceipt(true);
            try {
              const path = await uploadReceiptImage(uri, pendingReceipt.transactionId);
              if (path) {
                showAlert({
                  title: t('common.success'),
                  message: t('receipt.attached_success', { defaultValue: 'Receipt attached' }),
                  type: 'success',
                  buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
                });
              }
            } catch {
              showAlert({
                title: t('common.error'),
                message: t('receipt.attached_failed', { defaultValue: 'Failed to attach receipt' }),
                type: 'error',
                buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
              });
            } finally {
              setUploadingReceipt(false);
            }
          }
          setPendingReceipt(null);
        }}
        onCancel={() => setPendingReceipt(null)}
        title="Attach Receipt"
        confirmLabel="Upload"
        confirmIcon="cloud-upload-outline"
        loading={uploadingReceipt}
      />

      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.background || '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme?.surface || '#fff',
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#e1e5e9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  scrollView: {
    flex: 1,
  },
});
