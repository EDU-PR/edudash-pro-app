/**
 * Hook for teacher document upload actions.
 * Extracted from teacher-management screen for WARP compliance.
 */

import { useCallback, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { TeacherDocumentsService } from '@/lib/services/TeacherDocumentsService';
import type { TeacherDocType } from '@/lib/services/TeacherDocumentsService';

interface UseTeacherDocUploadParams {
  getPreschoolId: () => string | null;
  userId?: string;
  showAlert: (opts: { title: string; message: string; type?: 'error' | 'warning' | 'info' | 'success'; buttons?: any[] }) => void;
  fetchTeachers: () => Promise<void>;
}

export function useTeacherDocUpload({
  getPreschoolId, userId, showAlert, fetchTeachers,
}: UseTeacherDocUploadParams) {
  const [isUploading, setIsUploading] = useState(false);

  const pickAndUploadTeacherDoc = useCallback(async (
    teacherId: string, docType: TeacherDocType, label: string,
  ) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      setIsUploading(true);
      const schoolId = getPreschoolId();
      if (!schoolId) {
        showAlert({ title: 'Error', message: 'No school associated.', type: 'error' });
        return;
      }

      const uploadResult = await TeacherDocumentsService.uploadDocument({
        teacherUserId: teacherId,
        preschoolId: schoolId,
        uploadedBy: userId || '',
        localUri: file.uri,
        docType,
        originalFileName: file.name || `${docType}.pdf`,
        mimeType: file.mimeType || 'application/pdf',
      });
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Could not upload document.');
      }

      showAlert({ title: 'Uploaded', message: label + ' uploaded successfully.', type: 'success' });
      await fetchTeachers();
    } catch (error: unknown) {
      showAlert({ title: 'Upload Failed', message: error instanceof Error ? error.message : 'Could not upload document.', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  }, [getPreschoolId, showAlert, fetchTeachers, userId]);

  const showAttachDocActionSheet = useCallback((teacherId: string) => {
    const docTypes: { type: TeacherDocType; label: string }[] = [
      { type: 'id_copy', label: 'ID Copy' }, { type: 'qualifications', label: 'Qualifications' },
      { type: 'contracts', label: 'Contracts' }, { type: 'cv', label: 'CV / Resume' },
    ];
    showAlert({
      title: 'Attach Document', message: 'Select the type of document to upload', type: 'info',
      buttons: [
        ...docTypes.map((d) => ({ text: d.label, onPress: () => pickAndUploadTeacherDoc(teacherId, d.type, d.label) })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    });
  }, [showAlert, pickAndUploadTeacherDoc]);

  return { isUploading, pickAndUploadTeacherDoc, showAttachDocActionSheet };
}
