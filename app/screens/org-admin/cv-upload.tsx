/**
 * CV Upload Processing Screen
 * 
 * Allows organizations to upload CVs (PDF, DOCX, images) for processing
 * Supports bulk upload and automatic parsing
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';

export default function CVUploadScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const styles = createStyles(theme);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        await processFiles(result.assets);
      }
    } catch (error: any) {
      Alert.alert(
        t('cv_upload.error', { defaultValue: 'Error' }),
        error.message || t('cv_upload.pick_error', { defaultValue: 'Failed to pick documents' })
      );
    }
  };

  const handlePickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.permission_required', { defaultValue: 'Permission Required' }),
          t('cv_upload.photo_permission', { defaultValue: 'Please grant photo library access' })
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        await processFiles(result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
          size: asset.fileSize || 0,
        })));
      }
    } catch (error: any) {
      Alert.alert(
        t('cv_upload.error', { defaultValue: 'Error' }),
        error.message || t('cv_upload.pick_error', { defaultValue: 'Failed to pick images' })
      );
    }
  };

  const processFiles = async (files: any[]) => {
    if (!profile?.organization_id) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('cv_upload.no_organization', { defaultValue: 'No organization found' })
      );
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const processedFiles = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(((i + 1) / files.length) * 100);

        // Upload file to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${profile.organization_id}/cvs/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        // Read file as base64 or blob
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        } as any);

        // TODO: Upload to Supabase Storage bucket
        // const { data, error } = await supabase.storage
        //   .from('cv-uploads')
        //   .upload(fileName, formData, {
        //     contentType: file.mimeType,
        //   });

        // For now, simulate upload
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Call Edge Function to process CV
        const { data: processData, error: processError } = await assertSupabase().functions.invoke(
          'process-cv-upload',
          {
            body: {
              file_url: fileName, // Would be actual storage URL
              organization_id: profile.organization_id,
              file_type: fileExt,
            },
          }
        );

        if (processError) {
          console.error('CV processing error:', processError);
          processedFiles.push({
            ...file,
            status: 'error',
            error: processError.message,
          });
        } else {
          processedFiles.push({
            ...file,
            status: 'success',
            processed_data: processData,
          });
        }
      }

      setUploadedFiles([...uploadedFiles, ...processedFiles]);
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('cv_upload.uploaded', { defaultValue: `${files.length} file(s) uploaded successfully` })
      );
    } catch (error: any) {
      Alert.alert(
        t('cv_upload.error', { defaultValue: 'Error' }),
        error.message || t('cv_upload.upload_failed', { defaultValue: 'Failed to upload files' })
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: t('cv_upload.title', { defaultValue: 'Upload CVs' }),
          headerBackTitle: t('common.back', { defaultValue: 'Back' }),
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Instructions */}
        <Card padding={20} margin={0} elevation="small" style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('cv_upload.instructions', { defaultValue: 'How to Upload CVs' })}
          </Text>
          <Text style={styles.instructionText}>
            {t('cv_upload.instruction_text', {
              defaultValue: 'Upload CV files (PDF, DOCX) or images for automatic processing. The system will extract key information and create learner profiles.',
            })}
          </Text>
          <View style={styles.supportedFormats}>
            <Text style={styles.formatLabel}>
              {t('cv_upload.supported_formats', { defaultValue: 'Supported formats:' })}
            </Text>
            <Text style={styles.formatList}>• PDF (.pdf)</Text>
            <Text style={styles.formatList}>• Word Documents (.docx)</Text>
            <Text style={styles.formatList}>• Images (.jpg, .png)</Text>
          </View>
        </Card>

        {/* Upload Buttons */}
        <View style={styles.uploadSection}>
          <TouchableOpacity
            style={[styles.uploadButton, { backgroundColor: theme.primary }]}
            onPress={handlePickDocument}
            disabled={uploading}
          >
            <Ionicons name="document-text-outline" size={24} color="#fff" />
            <Text style={styles.uploadButtonText}>
              {t('cv_upload.upload_documents', { defaultValue: 'Upload Documents (PDF/DOCX)' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadButton, styles.secondaryButton, { borderColor: theme.border }]}
            onPress={handlePickImages}
            disabled={uploading}
          >
            <Ionicons name="image-outline" size={24} color={theme.text} />
            <Text style={[styles.uploadButtonText, styles.secondaryButtonText, { color: theme.text }]}>
              {t('cv_upload.upload_images', { defaultValue: 'Upload Images' })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Upload Progress */}
        {uploading && (
          <Card padding={20} margin={0} elevation="small" style={styles.section}>
            <View style={styles.progressContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.progressText}>
                {t('cv_upload.uploading', { defaultValue: 'Uploading and processing...' })} {Math.round(uploadProgress)}%
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${uploadProgress}%`, backgroundColor: theme.primary },
                  ]}
                />
              </View>
            </View>
          </Card>
        )}

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('cv_upload.uploaded_files', { defaultValue: 'Uploaded Files' })} ({uploadedFiles.length})
            </Text>
            {uploadedFiles.map((file, index) => (
              <Card key={index} padding={16} margin={0} elevation="small" style={styles.fileCard}>
                <View style={styles.fileHeader}>
                  <Ionicons
                    name={file.status === 'success' ? 'checkmark-circle' : 'close-circle'}
                    size={24}
                    color={file.status === 'success' ? theme.success || '#10B981' : theme.error || '#EF4444'}
                  />
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName}>{file.name}</Text>
                    <Text style={styles.fileStatus}>
                      {file.status === 'success'
                        ? t('cv_upload.processed', { defaultValue: 'Processed' })
                        : t('cv_upload.failed', { defaultValue: 'Failed' })}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Note about Edge Function */}
        <Card padding={16} margin={0} elevation="small" style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
          <Text style={styles.noteText}>
            {t('cv_upload.note', {
              defaultValue: 'CV processing requires an Edge Function. Contact support to enable this feature.',
            })}
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 16 },
  sectionTitle: { color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  instructionText: { color: theme.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  supportedFormats: { marginTop: 8 },
  formatLabel: { color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  formatList: { color: theme.textSecondary, fontSize: 14, marginBottom: 4 },
  uploadSection: { gap: 12, marginBottom: 16 },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  uploadButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 2 },
  secondaryButtonText: { color: theme.text },
  progressContainer: { alignItems: 'center', gap: 12 },
  progressText: { color: theme.text, fontSize: 14, fontWeight: '600' },
  progressBar: { width: '100%', height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  fileCard: { marginBottom: 12 },
  fileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileInfo: { flex: 1 },
  fileName: { color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  fileStatus: { color: theme.textSecondary, fontSize: 12 },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: theme.surface,
  },
  noteText: { flex: 1, color: theme.textSecondary, fontSize: 13, lineHeight: 18 },
});


