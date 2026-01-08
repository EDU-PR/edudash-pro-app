import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import type { SelectedFile, PaymentChild } from '@/types/payments';
import { uploadPOPFile, formatFileSize } from '@/lib/popUpload';
import { assertSupabase } from '@/lib/supabase';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { ApprovalNotificationService } from '@/services/approvals/ApprovalNotificationService';

interface PaymentUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedChildId: string | null;
  selectedChild: PaymentChild | undefined;
  userId: string;
  preschoolId?: string;
  initialAmount?: string;
  theme: any;
}

export function PaymentUploadModal({
  visible,
  onClose,
  onSuccess,
  selectedChildId,
  selectedChild,
  userId,
  preschoolId,
  initialAmount = '',
  theme,
}: PaymentUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(initialAmount);
  const [uploading, setUploading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const insets = useSafeAreaInsets();

  const styles = createStyles(theme, insets);

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera roll permission is required.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || `payment_proof_${Date.now()}.jpg`,
          size: asset.fileSize,
          type: 'image/jpeg',
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleDocumentPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          size: asset.size,
          type: asset.mimeType,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedChildId || !userId) {
      Alert.alert('Error', 'Please select a file first');
      return;
    }

    setUploading(true);
    try {
      const supabase = assertSupabase();
      const today = new Date();
      const last24Hours = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();

      // Check for existing pending OR recently approved POP uploads for this student
      const { data: existingPOPs, error: checkError } = await supabase
        .from('pop_uploads')
        .select('id, status, created_at, payment_amount')
        .eq('student_id', selectedChildId)
        .eq('upload_type', 'proof_of_payment')
        .or(`status.in.(pending,submitted),and(status.eq.approved,created_at.gte.${last24Hours})`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (checkError) {
        console.error('Error checking existing POPs:', checkError);
      }

      // Check for pending uploads - warn but allow override
      const pendingPOP = existingPOPs?.find(p => ['pending', 'submitted'].includes(p.status));
      if (pendingPOP) {
        const createdDate = new Date(pendingPOP.created_at).toLocaleDateString();
        
        // Show confirmation dialog for pending - can override
        Alert.alert(
          'Pending Upload Found',
          `You already have a pending proof of payment uploaded on ${createdDate}${pendingPOP.payment_amount ? ` for R${pendingPOP.payment_amount}` : ''}.\n\nWait for it to be reviewed before uploading another.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setUploading(false) },
            { 
              text: 'Upload Anyway', 
              style: 'destructive',
              onPress: () => proceedWithUpload(),
            },
          ]
        );
        return;
      }

      // Check for recently approved uploads - block completely
      const recentApproved = existingPOPs?.find(p => p.status === 'approved');
      if (recentApproved) {
        const createdDate = new Date(recentApproved.created_at).toLocaleDateString();
        Alert.alert(
          'Recent Upload Approved',
          `Your proof of payment from ${createdDate}${recentApproved.payment_amount ? ` for R${recentApproved.payment_amount}` : ''} was already approved.\n\nYou don't need to upload again unless you made a new payment.`,
          [{ text: 'OK', onPress: () => setUploading(false) }]
        );
        return;
      }

      await proceedWithUpload();
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Failed to upload proof of payment');
      setUploading(false);
    }
  };

  const proceedWithUpload = async () => {
    if (!selectedFile || !selectedChildId || !userId) return;

    try {
      const supabase = assertSupabase();

      const uploadResult = await uploadPOPFile(
        selectedFile.uri,
        'proof_of_payment',
        userId,
        selectedChildId,
        selectedFile.name
      );

      if (!uploadResult.success || !uploadResult.filePath) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Get user profile for parent name
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .single();
      
      const parentName = userProfile 
        ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() 
        : 'A parent';

      const finalPreschoolId = selectedChild?.preschool_id || preschoolId;
      const paymentAmountNum = paymentAmount ? parseFloat(paymentAmount) : 0;

      // Use student_code (which maps from student_id in database) for payment reference
      const studentCode = selectedChild?.student_code || `STU-${selectedChildId.slice(0, 8).toUpperCase()}`;
      
      const { data: insertedPOP, error: dbError } = await supabase
        .from('pop_uploads')
        .insert({
          student_id: selectedChildId,
          uploaded_by: userId,
          preschool_id: finalPreschoolId,
          upload_type: 'proof_of_payment',
          title: `Payment - ${studentCode}${paymentReference ? ` (${paymentReference})` : ''}`,
          file_path: uploadResult.filePath,
          file_name: uploadResult.fileName || selectedFile.name,
          file_size: uploadResult.fileSize || selectedFile.size || 0,
          file_type: uploadResult.fileType || selectedFile.type || 'unknown',
          payment_amount: paymentAmountNum, // Required by CHECK constraint
          payment_date: new Date().toISOString().split('T')[0], // Required by CHECK constraint (YYYY-MM-DD)
          payment_reference: paymentReference || studentCode,
          status: 'pending',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Notify principal of new POP submission
      if (finalPreschoolId && insertedPOP) {
        try {
          await ApprovalNotificationService.notifyPrincipalOfNewPOP({
            id: insertedPOP.id,
            preschool_id: finalPreschoolId,
            student_id: selectedChildId,
            submitted_by: userId,
            parent_name: parentName,
            payment_amount: paymentAmountNum,
            payment_date: new Date().toISOString(),
            payment_method: 'bank_transfer',
            payment_purpose: 'School Fees',
            status: 'submitted',
            auto_matched: false,
            submitted_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          console.log('✅ Principal notified of new POP');
        } catch (notifError) {
          console.error('Failed to notify principal:', notifError);
          // Don't fail the upload if notification fails
        }
      }

      // Show celebration modal instead of basic Alert
      setShowSuccessModal(true);
      resetForm();
      
      // Add delay to ensure database propagation before calling onSuccess
      // This allows realtime subscriptions to pick up the new record
      // Increased to 1000ms for more reliable propagation
      setTimeout(() => {
        console.log('[PaymentUploadModal] Triggering onSuccess callback after upload');
        onSuccess();
      }, 1000);
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Failed to upload proof of payment');
    } finally {
      setUploading(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    onClose();
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPaymentReference('');
    setPaymentAmount('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Upload Proof of Payment</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalLabel}>Select File *</Text>
          {!selectedFile ? (
            <View style={styles.filePickerRow}>
              <TouchableOpacity style={styles.filePickerButton} onPress={handleImagePicker}>
                <Ionicons name="image" size={24} color={theme.primary} />
                <Text style={styles.filePickerText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filePickerButton} onPress={handleDocumentPicker}>
                <Ionicons name="document" size={24} color={theme.primary} />
                <Text style={styles.filePickerText}>Files</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.selectedFileCard}>
              <Ionicons 
                name={selectedFile.type?.includes('pdf') ? 'document-text' : 'image'} 
                size={32} 
                color={theme.primary} 
              />
              <View style={styles.selectedFileInfo}>
                <Text style={styles.selectedFileName} numberOfLines={1}>{selectedFile.name}</Text>
                {selectedFile.size && (
                  <Text style={styles.selectedFileSize}>{formatFileSize(selectedFile.size)}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setSelectedFile(null)}>
                <Ionicons name="close-circle" size={24} color={theme.error} />
              </TouchableOpacity>
            </View>
          )}

          {/* Child Payment Reference - Non-editable */}
          <Text style={styles.modalLabel}>Payment Reference (Use when paying)</Text>
          <View style={styles.referenceContainer}>
            <Ionicons name="barcode-outline" size={20} color={theme.primary} />
            <Text style={styles.referenceText}>{selectedChild?.student_code || 'N/A'}</Text>
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>Required</Text>
            </View>
          </View>
          <Text style={styles.referenceHint}>
            Always include this reference when making bank payments
          </Text>

          <Text style={styles.modalLabel}>Bank Transaction Reference (Optional)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="document-text-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={styles.textInput}
              value={paymentReference}
              onChangeText={setPaymentReference}
              placeholder="e.g., TXN123456"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <Text style={styles.modalLabel}>Amount Paid (Optional)</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.currencyPrefix}>R</Text>
            <TextInput
              style={styles.textInput}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity 
            style={[styles.submitButton, (!selectedFile || uploading) && styles.submitButtonDisabled]}
            onPress={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Proof of Payment</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Celebration Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title="Payment Submitted! 🎉"
        message="Your proof of payment has been uploaded. The school will verify and confirm your payment within 24-48 hours."
        buttonText="Done"
        onClose={handleSuccessModalClose}
        icon="checkmark-circle"
      />
    </Modal>
  );
}

const createStyles = (theme: any, insets: { top: number; bottom: number }) => StyleSheet.create({
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Math.max(16, insets.top),
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: theme.text },
  modalContent: { flex: 1, padding: 16 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 8, marginTop: 16 },
  referenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary + '15',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.primary + '40',
  },
  referenceText: { flex: 1, marginLeft: 8, fontSize: 18, fontWeight: '700', color: theme.primary },
  requiredBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  requiredText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  referenceHint: { fontSize: 12, color: theme.textSecondary, marginTop: 6, fontStyle: 'italic' },
  filePickerRow: { flexDirection: 'row', gap: 12 },
  filePickerButton: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  filePickerText: { marginTop: 8, fontSize: 14, color: theme.text },
  selectedFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  selectedFileInfo: { flex: 1, marginLeft: 12 },
  selectedFileName: { fontSize: 14, fontWeight: '500', color: theme.text },
  selectedFileSize: { fontSize: 12, color: theme.textSecondary },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  currencyPrefix: { fontSize: 16, color: theme.textSecondary, marginRight: 4 },
  textInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: theme.text },
  modalFooter: { 
    padding: 16, 
    paddingBottom: Math.max(16, insets.bottom),
    borderTopWidth: 1, 
    borderTopColor: theme.border 
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
