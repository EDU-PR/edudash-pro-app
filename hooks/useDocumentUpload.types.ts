/** Shared types and constants for useDocumentUpload */
export type DocumentType = 'birth_certificate' | 'clinic_card' | 'guardian_id';
export interface DocumentInfo {
  type: DocumentType;
  label: string;
  description: string;
  icon: string;
  color: string;
  dbColumn: string;
}
export const DOCUMENTS: DocumentInfo[] = [
  { type: 'birth_certificate', label: 'Birth Certificate', description: "Child's official birth certificate", icon: 'document-text', color: '#3B82F6', dbColumn: 'student_birth_certificate_url' },
  { type: 'clinic_card', label: 'Clinic Card', description: "Child's clinic/vaccination card", icon: 'medical', color: '#10B981', dbColumn: 'student_clinic_card_url' },
  { type: 'guardian_id', label: 'Guardian ID', description: 'Parent/Guardian identity document', icon: 'card', color: '#8B5CF6', dbColumn: 'guardian_id_document_url' },
];
export interface UploadedDocument {
  type: DocumentType;
  url: string;
  uploadedAt: string;
}
export type ShowAlert = (cfg: {
  title: string;
  message: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
}) => void;
