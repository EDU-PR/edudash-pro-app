/**
 * documentHandlers — teacher document refresh, upload, and action-sheet logic.
 */

import { TeacherDocumentsService } from '@/lib/services/TeacherDocumentsService';
import type { TeacherDocument, TeacherDocType } from '@/lib/services/TeacherDocumentsService';
import type { Teacher } from '@/types/teacher-management';
import type { AlertButton } from '@/components/ui/AlertModal';
import type { SafeAlert } from './types';

interface DocumentContext {
  selectedTeacher: Teacher | null;
  setTeacherDocsMap: React.Dispatch<React.SetStateAction<Record<string, TeacherDocument | undefined>>>;
  safeAlert: SafeAlert;
}

/**
 * Refresh the document map for the currently selected teacher.
 */
export async function refreshSelectedTeacherDocs(ctx: DocumentContext): Promise<void> {
  const { selectedTeacher, setTeacherDocsMap } = ctx;
  if (!selectedTeacher?.id) return;

  const docs = await TeacherDocumentsService.listDocuments(selectedTeacher.id);
  const map: Record<string, TeacherDocument> = {};
  for (const d of docs) {
    if (!map[d.doc_type]) map[d.doc_type] = d;
  }
  setTeacherDocsMap(map);
}

/**
 * Stub — the actual DocumentPicker interaction lives in the consuming component
 * because it requires native module access that can't be shared via a hook factory.
 */
export async function pickAndUploadTeacherDoc(_docType: TeacherDocType): Promise<void> {
  console.warn(
    'pickAndUploadTeacherDoc should be called from the component with DocumentPicker access',
  );
}

/**
 * Show an action-sheet-style alert for choosing which document type to attach.
 */
export function showAttachDocActionSheet(
  safeAlert: SafeAlert,
  pickDoc: (docType: TeacherDocType) => Promise<void>,
): void {
  safeAlert({
    title: 'Attach Document',
    message: 'Select which document to attach',
    type: 'info',
    buttons: [
      { text: 'CV', onPress: () => pickDoc('cv') } as AlertButton,
      { text: 'Qualifications', onPress: () => pickDoc('qualifications') } as AlertButton,
      { text: 'ID Copy', onPress: () => pickDoc('id_copy') } as AlertButton,
      { text: 'Contracts', onPress: () => pickDoc('contracts') } as AlertButton,
      { text: 'Cancel', style: 'cancel' } as AlertButton,
    ],
  });
}
