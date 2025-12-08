/**
 * PettyCashModals Component
 * 
 * All modal dialogs for petty cash operations:
 * - Add Expense
 * - Replenishment
 * - Withdrawal
 * - Category Picker
 * - Receipts Viewer
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { 
  EXPENSE_CATEGORIES,
  formatCurrency, 
  type ExpenseFormData, 
  type PettyCashSummary 
} from '@/hooks/usePettyCash';

interface ReceiptItem {
  id: string;
  url: string;
  fileName?: string;
}

interface Props {
  // Modal visibility
  showAddExpense: boolean;
  showReplenishment: boolean;
  showWithdrawal: boolean;
  showReceipts: boolean;
  // Modal setters
  setShowAddExpense: (show: boolean) => void;
  setShowReplenishment: (show: boolean) => void;
  setShowWithdrawal: (show: boolean) => void;
  setShowReceipts: (show: boolean) => void;
  // Data
  summary: PettyCashSummary;
  receiptItems: ReceiptItem[];
  receiptsLoading: boolean;
  // Handlers
  onAddExpense: (form: ExpenseFormData, receiptImage: string | null) => Promise<boolean>;
  onAddReplenishment: (amount: string) => Promise<boolean>;
  onAddWithdrawal: (form: ExpenseFormData) => Promise<boolean>;
  // Theme
  theme?: any;
}

export function PettyCashModals({
  showAddExpense,
  showReplenishment,
  showWithdrawal,
  showReceipts,
  setShowAddExpense,
  setShowReplenishment,
  setShowWithdrawal,
  setShowReceipts,
  summary,
  receiptItems,
  receiptsLoading,
  onAddExpense,
  onAddReplenishment,
  onAddWithdrawal,
  theme,
}: Props) {
  const { t } = useTranslation('common');
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Form state
  const [expenseForm, setExpenseForm] = useState<ExpenseFormData>({
    amount: '',
    description: '',
    category: '',
    receipt_number: '',
  });
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  
  // Category picker
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return EXPENSE_CATEGORIES;
    return EXPENSE_CATEGORIES.filter(c => c.toLowerCase().includes(q));
  }, [categorySearch]);

  const resetForm = () => {
    setExpenseForm({
      amount: '',
      description: '',
      category: '',
      receipt_number: '',
    });
    setReceiptImage(null);
  };

  const handleAddExpense = async () => {
    setUploadingReceipt(true);
    const success = await onAddExpense(expenseForm, receiptImage);
    setUploadingReceipt(false);
    if (success) {
      resetForm();
      setShowAddExpense(false);
    }
  };

  const handleReplenishment = async () => {
    const success = await onAddReplenishment(expenseForm.amount);
    if (success) {
      resetForm();
      setShowReplenishment(false);
    }
  };

  const handleWithdrawal = async () => {
    // Show confirmation
    Alert.alert(
      t('petty_cash.confirm_withdrawal'),
      t('petty_cash.confirm_withdrawal_message', { amount: formatCurrency(parseFloat(expenseForm.amount) || 0) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('petty_cash.withdraw'), 
          style: 'destructive', 
          onPress: async () => {
            const success = await onAddWithdrawal(expenseForm);
            if (success) {
              resetForm();
              setShowWithdrawal(false);
            }
          }
        }
      ]
    );
  };

  const takeReceiptPhoto = async () => {
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
        setReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('receipt.error_take_photo'));
    }
  };

  const pickReceiptFromGallery = async () => {
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
        setReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('receipt.error_select_image'));
    }
  };

  const selectReceiptImage = () => {
    Alert.alert(
      t('petty_cash.attach_receipt'),
      t('receipt.choose_method'),
      [
        { text: t('receipt.take_photo'), onPress: takeReceiptPhoto },
        { text: t('receipt.choose_from_gallery'), onPress: pickReceiptFromGallery },
        { text: t('common.cancel'), style: 'cancel' }
      ]
    );
  };

  return (
    <>
      {/* Add Expense Modal */}
      <Modal
        visible={showAddExpense}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddExpense(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddExpense(false)}>
              <Text style={styles.modalCancel}>{t('petty_cash.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('petty_cash.add_expense')}</Text>
            <TouchableOpacity onPress={handleAddExpense} disabled={uploadingReceipt}>
              <Text style={[styles.modalSave, uploadingReceipt && { opacity: 0.5 }]}>
                {uploadingReceipt ? t('common.uploading', 'Uploading...') : t('common.add', 'Add')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.amount')} (ZAR) *</Text>
              <TextInput
                style={styles.formInput}
                value={expenseForm.amount}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, amount: text }))}
                placeholder={t('petty_cash.enter_amount')}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.description')} *</Text>
              <TextInput
                style={[styles.formInput, { height: 80 }]}
                value={expenseForm.description}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, description: text }))}
                placeholder={t('petty_cash.enter_description')}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.category')} *</Text>
              <TouchableOpacity 
                style={styles.categorySelector}
                onPress={() => {
                  setCategorySearch('');
                  setShowCategoryPicker(true);
                }}
              >
                <Text style={[styles.categoryText, !expenseForm.category && styles.placeholder]}>
                  {expenseForm.category || t('petty_cash.select_category')}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.receipt_number')} ({t('common.optional', 'Optional')})</Text>
              <TextInput
                style={styles.formInput}
                value={expenseForm.receipt_number}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, receipt_number: text }))}
                placeholder={t('petty_cash.enter_receipt_number')}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('receipt.receipt_image', 'Receipt Image')} ({t('common.optional', 'Optional')})</Text>
              
              {receiptImage ? (
                <View style={styles.receiptPreviewContainer}>
                  <Image source={{ uri: receiptImage }} style={styles.receiptPreview} />
                  <TouchableOpacity 
                    style={styles.removeReceiptButton}
                    onPress={() => setReceiptImage(null)}
                  >
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadReceiptButton} onPress={selectReceiptImage}>
                  <Ionicons name="camera" size={24} color="#6B7280" />
                  <Text style={styles.uploadReceiptText}>{t('receipt.add_receipt_photo', 'Add Receipt Photo')}</Text>
                  <Text style={styles.uploadReceiptSubtext}>{t('receipt.tap_to_photo_gallery', 'Tap to take photo or select from gallery')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>{t('petty_cash.available_balance', 'Available Balance')}:</Text>
              <Text style={styles.balanceAmount}>{formatCurrency(summary.current_balance)}</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
              <Text style={styles.modalCancel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('petty_cash.select_category')}</Text>
            <View style={{ width: 48 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formGroup}>
              <TextInput
                style={styles.formInput}
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder={t('category.search_categories', { defaultValue: 'Search categories' })}
              />
            </View>

            <ScrollView style={styles.categoryList} keyboardShouldPersistTaps="handled">
              {filteredCategories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryItem}
                  onPress={() => {
                    setExpenseForm(prev => ({ ...prev, category }));
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.categoryItemText}>{category}</Text>
                  {expenseForm.category === category && (
                    <Ionicons name="checkmark-circle" size={20} color={theme?.primary || '#007AFF'} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Replenishment Modal */}
      <Modal
        visible={showReplenishment}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReplenishment(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReplenishment(false)}>
              <Text style={styles.modalCancel}>{t('petty_cash.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('petty_cash.replenish_cash')}</Text>
            <TouchableOpacity onPress={handleReplenishment}>
              <Text style={styles.modalSave}>{t('common.record', 'Record')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.replenishment_amount', 'Replenishment Amount')} (ZAR) *</Text>
              <TextInput
                style={styles.formInput}
                value={expenseForm.amount}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, amount: text }))}
                placeholder={t('petty_cash.enter_amount')}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>{t('petty_cash.current_status', 'Current Status')}</Text>
              <Text style={styles.infoText}>
                {t('petty_cash.current_balance')}: {formatCurrency(summary.current_balance)}
              </Text>
              <Text style={styles.infoText}>
                {t('petty_cash.replenishment_recommendation', 'Recommended replenishment when balance falls below R1,000')}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Withdrawal Modal */}
      <Modal
        visible={showWithdrawal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWithdrawal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowWithdrawal(false)}>
              <Text style={styles.modalCancel}>{t('petty_cash.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('petty_cash.withdraw_cash')}</Text>
            <TouchableOpacity onPress={handleWithdrawal}>
              <Text style={styles.modalSave}>{t('petty_cash.withdraw')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.withdrawal_amount', 'Withdrawal Amount')} (ZAR) *</Text>
              <TextInput
                style={styles.formInput}
                value={expenseForm.amount}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, amount: text }))}
                placeholder={t('petty_cash.enter_amount')}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.withdrawal_reason', 'Reason for Withdrawal')} *</Text>
              <TextInput
                style={[styles.formInput, { height: 80 }]}
                value={expenseForm.description}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, description: text }))}
                placeholder={t('petty_cash.withdrawal_reason_placeholder', 'Why are you withdrawing this cash?')}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.reference_number', 'Reference Number')} ({t('common.optional', 'Optional')})</Text>
              <TextInput
                style={styles.formInput}
                value={expenseForm.receipt_number}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, receipt_number: text }))}
                placeholder={t('petty_cash.reference_placeholder', 'Bank deposit slip, reference number, etc.')}
              />
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>⚠️ {t('common.important', 'Important')}</Text>
              <Text style={styles.infoText}>
                {t('petty_cash.current_balance')}: {formatCurrency(summary.current_balance)}
              </Text>
              <Text style={styles.infoText}>
                {t('petty_cash.withdrawal_notice', 'This withdrawal will reduce your petty cash balance.')}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Receipts Viewer Modal */}
      <Modal
        visible={showReceipts}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReceipts(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReceipts(false)}>
              <Text style={styles.modalCancel}>{t('common.close', { defaultValue: 'Close' })}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('receipt.receipt_image', { defaultValue: 'Receipt Image' })}</Text>
            <View style={{ width: 48 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {receiptsLoading ? (
              <View style={styles.loadingContainer}>
                <Ionicons name="time-outline" size={24} color={theme?.textSecondary || '#6B7280'} />
                <Text style={styles.loadingText}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
              </View>
            ) : (
              receiptItems.map(item => (
                <View key={item.id} style={styles.receiptItemContainer}>
                  <Image source={{ uri: item.url }} style={styles.receiptPreview} />
                  {!!item.fileName && (
                    <Text style={styles.receiptFileName}>{item.fileName}</Text>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: theme?.modalBackground || '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme?.surface || '#fff',
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#e1e5e9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  modalCancel: {
    fontSize: 16,
    color: theme?.textSecondary || '#6B7280',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.primary || '#007AFF',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme?.text || '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: theme?.inputBorder || '#e1e5e9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: theme?.inputBackground || '#fff',
    color: theme?.inputText || '#111827',
  },
  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme?.inputBorder || '#e1e5e9',
    borderRadius: 8,
    padding: 12,
    backgroundColor: theme?.inputBackground || '#fff',
  },
  categoryText: {
    fontSize: 16,
    color: theme?.inputText || '#333',
  },
  placeholder: {
    color: '#9CA3AF',
  },
  categoryList: {
    flex: 1,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme?.surface || '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme?.border || '#e1e5e9',
    marginBottom: 8,
  },
  categoryItemText: {
    fontSize: 16,
    color: theme?.text || '#333',
  },
  uploadReceiptButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme?.border || '#e1e5e9',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    backgroundColor: theme?.surfaceVariant || '#f8f9fa',
  },
  uploadReceiptText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme?.text || '#333',
    marginTop: 8,
  },
  uploadReceiptSubtext: {
    fontSize: 12,
    color: theme?.textSecondary || '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  receiptPreviewContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  receiptPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeReceiptButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 2,
  },
  balanceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme?.surfaceVariant || '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: theme?.textSecondary || '#6B7280',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  infoBox: {
    backgroundColor: theme?.surfaceVariant || '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: theme?.textSecondary || '#6B7280',
    marginBottom: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 8,
    color: theme?.textSecondary || '#6B7280',
  },
  receiptItemContainer: {
    marginBottom: 16,
  },
  receiptFileName: {
    marginTop: 6,
    textAlign: 'center',
    color: theme?.textSecondary || '#6B7280',
  },
});

export default PettyCashModals;
