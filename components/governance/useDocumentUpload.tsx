/**
 * Document Upload Hook & Modal
 * Handles document upload logic and state
 */
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { assertSupabase } from '@/lib/supabase';

interface DocumentUploadModalProps {
  visible: boolean;
  theme: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function DocumentUploadModal({
  visible,
  theme,
  onClose,
  onSuccess,
}: DocumentUploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [newDocument, setNewDocument] = useState({
    name: '',
    description: '',
    category: 'general',
    file: null as DocumentPicker.DocumentPickerAsset | null,
  });

  const categories = ['policy', 'governance', 'financial', 'legal', 'general'];

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setNewDocument(prev => ({ ...prev, file: result.assets[0] }));
      }
    } catch (err) {
      console.error('Error picking document:', err);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const handleUpload = async () => {
    if (!newDocument.name.trim()) {
      Alert.alert('Error', 'Please enter a document name');
      return;
    }
    if (!newDocument.file) {
      Alert.alert('Error', 'Please select a file');
      return;
    }

    setUploading(true);
    try {
      const supabase = assertSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to upload documents');
        return;
      }

      // Get user's organization
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!member?.organization_id) {
        Alert.alert('Error', 'You must be part of an organization to upload documents');
        return;
      }

      // Upload file to storage
      const fileExt = newDocument.file.name.split('.').pop();
      const filePath = `${member.organization_id}/documents/${Date.now()}.${fileExt}`;
      
      const response = await fetch(newDocument.file.uri);
      const blob = await response.blob();
      
      const { error: uploadError } = await supabase.storage
        .from('organization-documents')
        .upload(filePath, blob, {
          contentType: newDocument.file.mimeType || 'application/octet-stream',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('organization-documents')
        .getPublicUrl(filePath);

      // Create document record
      const { error: docError } = await supabase
        .from('organization_documents')
        .insert({
          organization_id: member.organization_id,
          name: newDocument.name,
          description: newDocument.description,
          document_type: newDocument.category,
          file_url: urlData.publicUrl,
          file_name: newDocument.file.name,
          file_size: newDocument.file.size,
          mime_type: newDocument.file.mimeType || 'application/octet-stream',
          storage_path: filePath,
          uploaded_by: user.id,
          access_level: 'members',
        });

      if (docError) throw docError;

      Alert.alert('Success', 'Document uploaded successfully');
      setNewDocument({ name: '', description: '', category: 'general', file: null });
      onSuccess();
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setNewDocument({ name: '', description: '', category: 'general', file: null });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Upload Document</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            placeholder="Document Name"
            placeholderTextColor={theme.textSecondary}
            value={newDocument.name}
            onChangeText={(text) => setNewDocument(prev => ({ ...prev, name: text }))}
          />

          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            placeholder="Description (optional)"
            placeholderTextColor={theme.textSecondary}
            value={newDocument.description}
            onChangeText={(text) => setNewDocument(prev => ({ ...prev, description: text }))}
            multiline
            numberOfLines={3}
          />

          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Category</Text>
          <View style={styles.categoryButtons}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  { borderColor: theme.border },
                  newDocument.category === cat && { backgroundColor: theme.primary + '20', borderColor: theme.primary }
                ]}
                onPress={() => setNewDocument(prev => ({ ...prev, category: cat }))}
              >
                <Text style={[
                  styles.categoryButtonText,
                  { color: newDocument.category === cat ? theme.primary : theme.textSecondary }
                ]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.filePickerButton, { borderColor: theme.border, backgroundColor: theme.background }]}
            onPress={handlePickDocument}
          >
            <Ionicons name="document-attach" size={24} color={theme.primary} />
            <Text style={[styles.filePickerText, { color: theme.text }]}>
              {newDocument.file ? newDocument.file.name : 'Select File (PDF, DOC)'}
            </Text>
          </TouchableOpacity>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={handleClose}
            >
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: theme.primary }]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.uploadButtonText}>Upload</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  filePickerText: {
    fontSize: 14,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
