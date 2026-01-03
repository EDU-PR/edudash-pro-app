/**
 * Student Homework Submit Component
 * 
 * Allows parents to submit homework on behalf of their preschool children.
 * Supports photo capture from camera or gallery upload.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { assertSupabase } from '../../lib/supabase';

// ====================================================================
// TYPES
// ====================================================================

interface HomeworkAssignment {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
}

interface StudentHomeworkSubmitProps {
  /** The homework assignment being submitted */
  assignment: HomeworkAssignment;
  /** Student ID */
  studentId: string;
  /** Student name for display */
  studentName?: string;
  /** Called when submission is successful */
  onSubmitSuccess?: () => void;
  /** Called when user cancels */
  onCancel?: () => void;
}

interface UploadedMedia {
  uri: string;
  type: 'photo' | 'video';
  fileName?: string;
}

// ====================================================================
// COMPONENT
// ====================================================================

export function StudentHomeworkSubmit({
  assignment,
  studentId,
  studentName,
  onSubmitSuccess,
  onCancel,
}: StudentHomeworkSubmitProps) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  
  const [mediaFiles, setMediaFiles] = useState<UploadedMedia[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ====================================================================
  // IMAGE PICKER
  // ====================================================================

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access to take photos of homework.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'Please allow photo library access to select homework photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setMediaFiles(prev => [...prev, {
          uri: asset.uri,
          type: 'photo',
          fileName: asset.fileName || `photo_${Date.now()}.jpg`,
        }]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handlePickFromGallery = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 5,
      });

      if (!result.canceled && result.assets) {
        const newMedia = result.assets.map(asset => ({
          uri: asset.uri,
          type: 'photo' as const,
          fileName: asset.fileName || `photo_${Date.now()}.jpg`,
        }));
        setMediaFiles(prev => [...prev, ...newMedia].slice(0, 5));
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to select photos. Please try again.');
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ====================================================================
  // SUBMISSION
  // ====================================================================

  const uploadMediaToStorage = async (media: UploadedMedia): Promise<string | null> => {
    try {
      const supabase = assertSupabase();
      const fileName = `homework/${studentId}/${assignment.id}/${Date.now()}_${media.fileName}`;
      
      // Fetch the file
      const response = await fetch(media.uri);
      const blob = await response.blob();

      // Convert blob to ArrayBuffer
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });

      const { data, error } = await supabase.storage
        .from('homework-submissions')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        console.error('Storage upload error:', error);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('homework-submissions')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading media:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (mediaFiles.length === 0) {
      Alert.alert('No Photos', 'Please add at least one photo of the homework.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = assertSupabase();

      // Upload all media files
      const uploadPromises = mediaFiles.map(media => uploadMediaToStorage(media));
      const uploadedUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedUrls.filter((url): url is string => url !== null);

      if (validUrls.length === 0) {
        throw new Error('Failed to upload any photos');
      }

      // Create homework submission
      const { error } = await supabase
        .from('homework_submissions')
        .insert({
          homework_id: assignment.id,
          student_id: studentId,
          submission_type: 'photo',
          media_urls: validUrls,
          content: notes || null,
          submitted_by: user?.id,
          submitted_at: new Date().toISOString(),
          status: 'submitted',
        });

      if (error) throw error;

      Alert.alert(
        'Submitted! 🎉',
        'The homework has been submitted successfully.',
        [{ text: 'OK', onPress: onSubmitSuccess }]
      );
    } catch (error) {
      console.error('Error submitting homework:', error);
      Alert.alert('Error', 'Failed to submit homework. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ====================================================================
  // RENDER
  // ====================================================================

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const isOverdue = date < now;
    const formatted = date.toLocaleDateString('en-ZA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return { formatted, isOverdue };
  };

  const dueInfo = formatDueDate(assignment.due_date);

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Assignment Info */}
      <View style={[styles.assignmentCard, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.assignmentHeader}>
          <Text style={styles.assignmentIcon}>📝</Text>
          <View style={styles.assignmentInfo}>
            <Text style={[styles.assignmentTitle, { color: colors.text }]}>
              {assignment.title}
            </Text>
            {studentName && (
              <Text style={[styles.studentName, { color: colors.textSecondary }]}>
                For: {studentName}
              </Text>
            )}
          </View>
        </View>
        {assignment.description && (
          <Text style={[styles.assignmentDesc, { color: colors.textSecondary }]}>
            {assignment.description}
          </Text>
        )}
        {dueInfo && (
          <View style={[
            styles.dueBadge,
            { backgroundColor: dueInfo.isOverdue ? '#FF525220' : '#4CAF5020' }
          ]}>
            <Ionicons 
              name="time-outline" 
              size={14} 
              color={dueInfo.isOverdue ? '#FF5252' : '#4CAF50'} 
            />
            <Text style={[
              styles.dueText,
              { color: dueInfo.isOverdue ? '#FF5252' : '#4CAF50' }
            ]}>
              Due: {dueInfo.formatted} {dueInfo.isOverdue && '(Overdue)'}
            </Text>
          </View>
        )}
      </View>

      {/* Upload Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          📸 Add Photos of Homework
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Take a clear photo or select from your gallery
        </Text>

        {/* Photo Buttons */}
        <View style={styles.uploadButtons}>
          <TouchableOpacity
            onPress={handleTakePhoto}
            style={[styles.uploadButton, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="camera" size={28} color="#fff" />
            <Text style={styles.uploadButtonText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePickFromGallery}
            style={[styles.uploadButton, { backgroundColor: colors.cardBackground, borderColor: colors.primary }]}
          >
            <Ionicons name="images" size={28} color={colors.primary} />
            <Text style={[styles.uploadButtonText, { color: colors.primary }]}>
              From Gallery
            </Text>
          </TouchableOpacity>
        </View>

        {/* Photo Preview Grid */}
        {mediaFiles.length > 0 && (
          <View style={styles.mediaGrid}>
            {mediaFiles.map((media, index) => (
              <View key={index} style={styles.mediaItem}>
                <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
                <TouchableOpacity
                  onPress={() => handleRemoveMedia(index)}
                  style={styles.removeMediaBtn}
                >
                  <Ionicons name="close-circle" size={24} color="#FF5252" />
                </TouchableOpacity>
              </View>
            ))}
            {mediaFiles.length < 5 && (
              <TouchableOpacity
                onPress={handleTakePhoto}
                style={[styles.addMoreBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="add" size={32} color={colors.textSecondary} />
                <Text style={[styles.addMoreText, { color: colors.textSecondary }]}>
                  Add More
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Notes Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          ✏️ Add a Note (Optional)
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Any comments about the homework..."
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={3}
          style={[
            styles.notesInput,
            { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border },
          ]}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting || mediaFiles.length === 0}
        style={[
          styles.submitButton,
          { 
            backgroundColor: '#4CAF50',
            opacity: (submitting || mediaFiles.length === 0) ? 0.6 : 1,
          }
        ]}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="paper-plane" size={24} color="#fff" />
            <Text style={styles.submitButtonText}>Submit Homework</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Cancel Button */}
      <TouchableOpacity
        onPress={onCancel}
        style={[styles.cancelButton, { borderColor: colors.border }]}
      >
        <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
          Cancel
        </Text>
      </TouchableOpacity>

      {/* Help Text */}
      <View style={[styles.helpSection, { backgroundColor: `${colors.primary}10` }]}>
        <Ionicons name="information-circle" size={20} color={colors.primary} />
        <Text style={[styles.helpText, { color: colors.textSecondary }]}>
          Photos should be clear and well-lit. Make sure all parts of the homework are visible.
        </Text>
      </View>
    </ScrollView>
  );
}

// ====================================================================
// STYLES
// ====================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  assignmentCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  assignmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  assignmentIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  studentName: {
    fontSize: 14,
    marginTop: 2,
  },
  assignmentDesc: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
    gap: 6,
  },
  dueText: {
    fontSize: 13,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mediaItem: {
    position: 'relative',
  },
  mediaPreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeMediaBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addMoreBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMoreText: {
    fontSize: 12,
    marginTop: 4,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 10,
    marginBottom: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  cancelButtonText: {
    fontSize: 16,
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default StudentHomeworkSubmit;
