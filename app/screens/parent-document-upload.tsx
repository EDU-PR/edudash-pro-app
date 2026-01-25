/**
 * Parent Document Upload Screen
 * 
 * Allows parents to upload required registration documents:
 * - Birth Certificate
 * - Clinic Card  
 * - Guardian ID
 * 
 * These documents are required during registration but can be uploaded later
 * if the parent didn't have them during initial registration.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { useTranslation } from 'react-i18next';

// Document types
type DocumentType = 'birth_certificate' | 'clinic_card' | 'guardian_id';

interface DocumentInfo {
  type: DocumentType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  dbColumn: string;
}

const DOCUMENTS: DocumentInfo[] = [
  {
    type: 'birth_certificate',
    label: 'Birth Certificate',
    description: 'Child\'s official birth certificate',
    icon: 'document-text',
    color: '#3B82F6',
    dbColumn: 'student_birth_certificate_url',
  },
  {
    type: 'clinic_card',
    label: 'Clinic Card',
    description: 'Child\'s clinic/vaccination card',
    icon: 'medical',
    color: '#10B981',
    dbColumn: 'student_clinic_card_url',
  },
  {
    type: 'guardian_id',
    label: 'Guardian ID',
    description: 'Parent/Guardian identity document',
    icon: 'card',
    color: '#8B5CF6',
    dbColumn: 'guardian_id_document_url',
  },
];

interface UploadedDocument {
  type: DocumentType;
  url: string;
  uploadedAt: string;
}

export default function ParentDocumentUploadScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const params = useLocalSearchParams();
  const registrationId = params.registrationId as string | undefined;
  const studentId = params.studentId as string | undefined;

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100 progress percentage
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [studentData, setStudentData] = useState<any>(null);

  const styles = createStyles(theme);

  // Load existing documents
  const loadDocuments = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const supabase = assertSupabase();
      
      // Try to find registration for this parent
      let registration = null;
      let student = null;

      if (registrationId) {
        const { data } = await supabase
          .from('registration_requests')
          .select('*')
          .eq('id', registrationId)
          .single();
        registration = data;
      } else {
        // Find by parent email using auth_user_id (NOT profiles.id!)
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('auth_user_id', user.id)
          .single();

        if (profile?.email) {
          const { data } = await supabase
            .from('registration_requests')
            .select('*')
            .ilike('guardian_email', profile.email)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          registration = data;
        }
      }

      // Also check students table
      if (studentId) {
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('id', studentId)
          .single();
        student = data;
      } else {
        const parentId = profile?.id || user?.id;
        if (parentId) {
          const { data } = await supabase
            .from('students')
            .select('*')
            .or(`parent_id.eq.${parentId},guardian_id.eq.${parentId}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          student = data;
        }
      }

      setRegistrationData(registration);
      setStudentData(student);

      // Build list of uploaded documents
      const uploaded: UploadedDocument[] = [];
      const source = registration || student;
      
      if (source) {
        if (source.student_birth_certificate_url) {
          uploaded.push({
            type: 'birth_certificate',
            url: source.student_birth_certificate_url,
            uploadedAt: source.updated_at || source.created_at,
          });
        }
        if (source.student_clinic_card_url) {
          uploaded.push({
            type: 'clinic_card',
            url: source.student_clinic_card_url,
            uploadedAt: source.updated_at || source.created_at,
          });
        }
        if (source.guardian_id_document_url) {
          uploaded.push({
            type: 'guardian_id',
            url: source.guardian_id_document_url,
            uploadedAt: source.updated_at || source.created_at,
          });
        }
      }

      setUploadedDocs(uploaded);
    } catch (error) {
      console.error('[DocUpload] Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, profile?.id, registrationId, studentId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Pick document
  const handlePickDocument = async (docType: DocumentType) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadDocument(docType, result.assets[0]);
      }
    } catch (error) {
      console.error('[DocUpload] Error picking document:', error);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  // Pick from camera/gallery
  const handlePickImage = async (docType: DocumentType, useCamera: boolean) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          `Please grant ${useCamera ? 'camera' : 'photo library'} access to upload documents.`
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
          });

      if (!result.canceled && result.assets[0]) {
        await uploadDocument(docType, {
          uri: result.assets[0].uri,
          name: `${docType}_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
          size: result.assets[0].fileSize || 0,
        });
      }
    } catch (error) {
      console.error('[DocUpload] Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  // Convert base64 to Uint8Array for upload
  const base64ToUint8Array = (base64: string): Uint8Array => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const str = base64.replace(/\s/g, '');
    const output: number[] = [];

    for (let i = 0; i < str.length; i += 4) {
      const enc1 = chars.indexOf(str.charAt(i));
      const enc2 = chars.indexOf(str.charAt(i + 1));
      const enc3 = chars.indexOf(str.charAt(i + 2));
      const enc4 = chars.indexOf(str.charAt(i + 3));

      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;

      output.push(chr1);
      if (enc3 !== 64 && enc3 !== -1) output.push(chr2);
      if (enc4 !== 64 && enc4 !== -1) output.push(chr3);
    }
    return new Uint8Array(output);
  };

  // Upload document
  const uploadDocument = async (
    docType: DocumentType,
    file: { uri: string; name: string; mimeType?: string; size?: number }
  ) => {
    if (!user?.id || !profile?.preschool_id) {
      Alert.alert('Error', 'You must be logged in to upload documents');
      return;
    }

    setUploading(docType);
    setUploadProgress(0);
    
    try {
      const supabase = assertSupabase();

      // Generate file path
      const ext = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const filePath = `documents/${profile.preschool_id}/${user.id}/${docType}_${timestamp}.${ext}`;

      // Simulate initial progress
      setUploadProgress(10);

      // Read file properly based on platform
      let body: Uint8Array;
      if (Platform.OS === 'web') {
        // Web: use fetch + arrayBuffer
        const response = await fetch(file.uri);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        body = new Uint8Array(buffer);
      } else {
        // Native: read as base64 and convert to Uint8Array
        setUploadProgress(20);
        const base64 = await FileSystem.readAsStringAsync(file.uri, { 
          encoding: FileSystem.EncodingType.Base64 
        });
        setUploadProgress(40);
        body = base64ToUint8Array(base64);
      }

      setUploadProgress(50);

      console.log('[DocUpload] Uploading file:', {
        path: filePath,
        size: body.length,
        mimeType: file.mimeType,
      });

      const { error: uploadError } = await supabase.storage
        .from('registration-documents')
        .upload(filePath, body, {
          contentType: file.mimeType || 'application/octet-stream',
          upsert: true,
        });

      setUploadProgress(70);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('registration-documents')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update registration_requests table
      const docInfo = DOCUMENTS.find(d => d.type === docType);
      if (!docInfo) throw new Error('Invalid document type');

      // Update registration_requests if we have one
      if (registrationData?.id) {
        const { error: updateError } = await supabase
          .from('registration_requests')
          .update({
            [docInfo.dbColumn]: publicUrl,
            documents_uploaded: true,
          })
          .eq('id', registrationData.id);

        if (updateError) {
          console.error('[DocUpload] Registration update error:', updateError);
        }
      }

      // Also update students table if we have one
      if (studentData?.id) {
        // For students table, we might need different column names
        // Map to actual students table columns if they exist
        const studentColumnMap: Record<string, string> = {
          student_birth_certificate_url: 'birth_certificate_url',
          student_clinic_card_url: 'clinic_card_url',
          guardian_id_document_url: 'guardian_id_url',
        };

        const studentColumn = studentColumnMap[docInfo.dbColumn] || docInfo.dbColumn;
        
        try {
          await supabase
            .from('students')
            .update({ [studentColumn]: publicUrl })
            .eq('id', studentData.id);
        } catch (err) {
          // Column might not exist in students table, continue anyway
          console.log('[DocUpload] Students table update skipped:', err);
        }
      }

      setUploadProgress(90);

      // Refresh data
      await loadDocuments();

      setUploadProgress(100);

      Alert.alert(
        '✅ Document Uploaded',
        `Your ${docInfo.label} has been uploaded successfully. The school will review it.`
      );
    } catch (error: any) {
      console.error('[DocUpload] Upload error:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload document. Please try again.');
    } finally {
      setUploading(null);
      setUploadProgress(0);
    }
  };

  // View uploaded document
  const handleViewDocument = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open document URL');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open document');
    }
  };

  // Show upload options
  const showUploadOptions = (docType: DocumentType) => {
    const docInfo = DOCUMENTS.find(d => d.type === docType);
    
    Alert.alert(
      `Upload ${docInfo?.label}`,
      'Choose how to upload your document',
      [
        {
          text: 'Take Photo',
          onPress: () => handlePickImage(docType, true),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => handlePickImage(docType, false),
        },
        {
          text: 'Select PDF/File',
          onPress: () => handlePickDocument(docType),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  // Render document card
  const renderDocumentCard = (doc: DocumentInfo) => {
    const uploaded = uploadedDocs.find(u => u.type === doc.type);
    const isUploading = uploading === doc.type;

    return (
      <Card key={doc.type} margin={8} padding={16}>
        <View style={styles.docCard}>
          <View style={[styles.docIcon, { backgroundColor: doc.color + '20' }]}>
            <Ionicons name={doc.icon} size={28} color={doc.color} />
          </View>

          <View style={styles.docInfo}>
            <Text style={[styles.docLabel, { color: theme.text }]}>
              {doc.label}
            </Text>
            <Text style={[styles.docDescription, { color: theme.textSecondary }]}>
              {doc.description}
            </Text>

            {uploaded && (
              <View style={styles.uploadedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={styles.uploadedText}>Uploaded</Text>
              </View>
            )}
          </View>

          <View style={styles.docActions}>
            {isUploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator color={theme.primary} size="small" />
                <Text style={[styles.uploadProgressText, { color: theme.textSecondary }]}>
                  {uploadProgress}%
                </Text>
                <View style={styles.uploadProgressBarContainer}>
                  <View 
                    style={[
                      styles.uploadProgressBar, 
                      { 
                        width: `${uploadProgress}%`,
                        backgroundColor: theme.primary 
                      }
                    ]} 
                  />
                </View>
              </View>
            ) : uploaded ? (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.primary + '20' }]}
                  onPress={() => handleViewDocument(uploaded.url)}
                >
                  <Ionicons name="eye" size={18} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: doc.color + '20' }]}
                  onPress={() => showUploadOptions(doc.type)}
                >
                  <Ionicons name="refresh" size={18} color={doc.color} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.uploadBtn, { backgroundColor: doc.color }]}
                onPress={() => showUploadOptions(doc.type)}
              >
                <Ionicons name="cloud-upload" size={18} color="#fff" />
                <Text style={styles.uploadBtnText}>Upload</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    );
  };

  // Check completion
  const allDocsUploaded = DOCUMENTS.every(doc =>
    uploadedDocs.some(u => u.type === doc.type)
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Upload Documents',
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header Info */}
        <Card margin={8} padding={20}>
          <View style={styles.headerInfo}>
            <View style={[styles.headerIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="documents" size={32} color={theme.primary} />
            </View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Required Documents
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Please upload the following documents to complete your child's registration.
            </Text>
          </View>

          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(uploadedDocs.length / DOCUMENTS.length) * 100}%`,
                    backgroundColor: allDocsUploaded ? '#10B981' : theme.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              {uploadedDocs.length} of {DOCUMENTS.length} documents uploaded
            </Text>
          </View>
        </Card>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading documents...
            </Text>
          </View>
        )}

        {/* Document Cards */}
        {!loading && DOCUMENTS.map(renderDocumentCard)}

        {/* Completion Message */}
        {allDocsUploaded && (
          <Card margin={8} padding={20}>
            <View style={styles.completionCard}>
              <View style={[styles.completionIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="checkmark-done-circle" size={40} color="#10B981" />
              </View>
              <Text style={[styles.completionTitle, { color: '#10B981' }]}>
                All Documents Uploaded! 🎉
              </Text>
              <Text style={[styles.completionSubtitle, { color: theme.textSecondary }]}>
                Your documents have been submitted for review. The school will verify them shortly.
              </Text>
            </View>
          </Card>
        )}

        {/* Help Text */}
        <View style={styles.helpSection}>
          <Text style={[styles.helpTitle, { color: theme.text }]}>
            <Ionicons name="information-circle" size={16} color={theme.textSecondary} />
            {' '}Tips for uploading
          </Text>
          <Text style={[styles.helpText, { color: theme.textSecondary }]}>
            • Ensure documents are clear and readable{'\n'}
            • Take photos in good lighting{'\n'}
            • Make sure all text is visible{'\n'}
            • PDF or image files accepted (max 10MB)
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      padding: 8,
      paddingBottom: 40,
    },
    headerInfo: {
      alignItems: 'center',
      marginBottom: 16,
    },
    headerIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 8,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    progressContainer: {
      marginTop: 16,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressText: {
      fontSize: 12,
      marginTop: 8,
      textAlign: 'center',
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
    },
    docCard: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    docIcon: {
      width: 56,
      height: 56,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    docInfo: {
      flex: 1,
      marginLeft: 12,
    },
    docLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    docDescription: {
      fontSize: 13,
    },
    uploadedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
    },
    uploadedText: {
      fontSize: 12,
      color: '#10B981',
      marginLeft: 4,
      fontWeight: '500',
    },
    docActions: {
      marginLeft: 12,
    },
    uploadingContainer: {
      alignItems: 'center',
      minWidth: 60,
    },
    uploadProgressText: {
      fontSize: 11,
      marginTop: 4,
      fontWeight: '500',
    },
    uploadProgressBarContainer: {
      width: 50,
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      marginTop: 4,
      overflow: 'hidden',
    },
    uploadProgressBar: {
      height: '100%',
      borderRadius: 2,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    actionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 6,
    },
    uploadBtnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    completionCard: {
      alignItems: 'center',
    },
    completionIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    completionTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
    },
    completionSubtitle: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    helpSection: {
      marginTop: 16,
      padding: 16,
    },
    helpTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    helpText: {
      fontSize: 13,
      lineHeight: 22,
    },
  });
