/**
 * SubmissionUploadPanel
 *
 * Upload UI with photo capture, gallery pick, document pick, and file preview.
 * Extracted from homework-detail.tsx for reuse and maintainability.
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SubmissionUploadFile } from '@/hooks/homework/useHomeworkDetail';
import { formatDateTime } from '@/hooks/homework/useHomeworkDetail';
import { clampPercent } from '@/lib/progress/clampPercent';

interface SubmissionUploadPanelProps {
  theme: any;
  submission: any;
  submissionText: string;
  setSubmissionText: (text: string) => void;
  submissionFiles: SubmissionUploadFile[];
  submittedFileUrls: string[];
  submittingWork: boolean;
  submitError: string | null;
  uploadProgress: number;
  isUploading: boolean;
  onTakePhoto: () => void;
  onPickFromGallery: () => void;
  onPickDocument: () => void;
  onRemoveSubmissionFile: (index: number) => void;
  onSubmitWork: () => void;
  onOpenAttachment: (url: string) => void;
}

export function SubmissionUploadPanel({
  theme,
  submission,
  submissionText,
  setSubmissionText,
  submissionFiles,
  submittedFileUrls,
  submittingWork,
  submitError,
  uploadProgress,
  isUploading,
  onTakePhoto,
  onPickFromGallery,
  onPickDocument,
  onRemoveSubmissionFile,
  onSubmitWork,
  onOpenAttachment,
}: SubmissionUploadPanelProps) {
  return (
    <>
      <View style={styles.summaryRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Submitted</Text>
          <Text style={[styles.value, { color: theme.text }]}>{formatDateTime(submission?.submitted_at)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Files</Text>
          <Text style={[styles.value, { color: theme.text }]}>{submittedFileUrls.length}</Text>
        </View>
      </View>

      <TextInput
        value={submissionText}
        onChangeText={setSubmissionText}
        placeholder="Add a short note for the teacher (optional)"
        placeholderTextColor={theme.textSecondary}
        multiline
        style={[
          styles.noteInput,
          { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
        ]}
      />

      <View style={styles.uploadActionRow}>
        <TouchableOpacity
          style={[styles.uploadActionButton, { borderColor: theme.border, backgroundColor: theme.background }]}
          onPress={onTakePhoto}
        >
          <Ionicons name="camera-outline" size={16} color={theme.text} />
          <Text style={[styles.uploadActionLabel, { color: theme.text }]}>Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.uploadActionButton, { borderColor: theme.border, backgroundColor: theme.background }]}
          onPress={onPickFromGallery}
        >
          <Ionicons name="images-outline" size={16} color={theme.text} />
          <Text style={[styles.uploadActionLabel, { color: theme.text }]}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.uploadActionButton, { borderColor: theme.border, backgroundColor: theme.background }]}
          onPress={onPickDocument}
        >
          <Ionicons name="document-outline" size={16} color={theme.text} />
          <Text style={[styles.uploadActionLabel, { color: theme.text }]}>PDF/File</Text>
        </TouchableOpacity>
      </View>

      {submissionFiles.length > 0 && (
        <View style={{ gap: 8 }}>
          {submissionFiles.map((file, index) => {
            const isImage = file.mimeType.startsWith('image/');
            return (
              <View
                key={`${file.uri}-${index}`}
                style={[styles.pendingFileRow, { borderColor: theme.border, backgroundColor: theme.background }]}
              >
                <View style={styles.fileMeta}>
                  <Ionicons name={isImage ? 'image-outline' : 'document-text-outline'} size={18} color={theme.primary} />
                  <Text style={[styles.fileLabel, { color: theme.text }]} numberOfLines={1}>
                    {file.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => onRemoveSubmissionFile(index)}>
                  <Ionicons name="close-circle" size={20} color={theme.error} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {submittedFileUrls.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Previous submission files</Text>
          {submittedFileUrls.map((url, index) => (
            <TouchableOpacity
              key={`${url}-${index}`}
              style={[styles.fileRow, { borderColor: theme.border, backgroundColor: theme.background }]}
              onPress={() => onOpenAttachment(url)}
            >
              <View style={styles.fileMeta}>
                <Ionicons name="cloud-done-outline" size={18} color={theme.success} />
                <Text style={[styles.fileLabel, { color: theme.text }]}>Submitted file {index + 1}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isUploading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${clampPercent(uploadProgress, {
                    source: 'SubmissionUploadPanel.uploadProgress',
                  })}%`,
                  backgroundColor: theme.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.textSecondary }]}>
            {uploadProgress < 100 ? `${Math.round(uploadProgress)}% uploading...` : 'Finalising...'}
          </Text>
        </View>
      )}

      {submitError ? (
        <Text style={[styles.submitErrorText, { color: theme.error }]}>{submitError}</Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.submitButton,
          {
            backgroundColor:
              submittingWork || (!submissionText.trim() && submissionFiles.length === 0)
                ? `${theme.primary}66`
                : theme.primary,
          },
        ]}
        onPress={onSubmitWork}
        disabled={submittingWork || (!submissionText.trim() && submissionFiles.length === 0)}
      >
        {submittingWork ? (
          <Text style={[styles.submitButtonText, { color: theme.onPrimary || '#fff' }]}>Submitting...</Text>
        ) : (
          <>
            <Ionicons name="paper-plane-outline" size={16} color={theme.onPrimary || '#fff'} />
            <Text style={[styles.submitButtonText, { color: theme.onPrimary || '#fff' }]}>Submit to Teacher</Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
  },
  noteInput: {
    minHeight: 84,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    fontSize: 14,
    lineHeight: 20,
  },
  uploadActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  uploadActionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadActionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  pendingFileRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fileRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileLabel: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '88%',
  },
  progressContainer: {
    gap: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  submitErrorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
