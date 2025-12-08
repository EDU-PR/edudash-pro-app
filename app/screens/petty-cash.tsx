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
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { navigateBack } from '@/lib/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';

// Modular components
import { PettyCashSummaryCard } from '@/components/petty-cash/PettyCashSummary';
import { PettyCashActions } from '@/components/petty-cash/PettyCashActions';
import { PettyCashTransactionList } from '@/components/petty-cash/PettyCashTransactionList';
import { PettyCashModals } from '@/components/petty-cash/PettyCashModals';

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
    cancelTransaction,
    deleteTransaction,
    reverseTransaction,
    canDelete,
    onRefresh,
  } = usePettyCash();

  // Modal visibility state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showReplenishment, setShowReplenishment] = useState(false);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);

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
          console.warn('File URI detected in web environment');
          return null;
        }
        const response = await fetch(imageUri);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
        blob = await response.blob();
      } catch (fetchError) {
        console.error('Error fetching image:', fetchError);
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
        await assertSupabase()
          .from('petty_cash_receipts')
          .insert({
            school_id: preschoolId,
            transaction_id: transactionId,
            storage_path: data.path,
            file_name: fileName,
            created_by: user?.id,
          });
      } catch (e) {
        console.warn('Failed to record petty cash receipt row:', e);
      }
      
      return data.path;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      return null;
    }
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
        Alert.alert(t('common.info'), t('receipt.no_receipts', { defaultValue: 'No receipts attached for this transaction.' }));
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
      Alert.alert(t('common.error'), t('receipt.error_select_image', { defaultValue: 'Failed to load receipts' }));
    } finally {
      setReceiptsLoading(false);
    }
  };

  // Attach receipt to existing transaction
  const attachReceiptToTransaction = async (transactionId: string) => {
    const ImagePicker = require('expo-image-picker');
    
    Alert.alert(
      t('receipt.attach_receipt', { defaultValue: 'Attach Receipt' }),
      t('receipt.choose_method', { defaultValue: 'Choose how to add your receipt:' }),
      [
        {
          text: t('receipt.take_photo', { defaultValue: 'Take Photo' }),
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert(t('receipt.permission_required'), t('receipt.camera_permission'));
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });
              if (!result.canceled && result.assets[0]) {
                const path = await uploadReceiptImage(result.assets[0].uri, transactionId);
                if (path) Alert.alert(t('common.success'), t('receipt.attached_success', { defaultValue: 'Receipt attached' }));
              }
            } catch {
              Alert.alert(t('common.error'), t('receipt.attached_failed', { defaultValue: 'Failed to attach receipt' }));
            }
          },
        },
        {
          text: t('receipt.choose_from_gallery', { defaultValue: 'Choose from Gallery' }),
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert(t('receipt.permission_required'), t('receipt.gallery_permission'));
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });
              if (!result.canceled && result.assets[0]) {
                const path = await uploadReceiptImage(result.assets[0].uri, transactionId);
                if (path) Alert.alert(t('common.success'), t('receipt.attached_success', { defaultValue: 'Receipt attached' }));
              }
            } catch {
              Alert.alert(t('common.error'), t('receipt.attached_failed', { defaultValue: 'Failed to attach receipt' }));
            }
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
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
        theme={theme}
      />
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
