/** useDocumentUpload — state + effects + handlers for parent document upload */
import { useState, useEffect, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { DOCUMENTS, type DocumentType, type UploadedDocument, type ShowAlert } from './useDocumentUpload.types';
export type { DocumentType, DocumentInfo, UploadedDocument, ShowAlert } from './useDocumentUpload.types';
export { DOCUMENTS } from './useDocumentUpload.types';

export function useDocumentUpload(
  showAlert: ShowAlert,
  registrationId?: string,
  studentId?: string,
) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [pendingDocImage, setPendingDocImage] = useState<{ uri: string; docType: DocumentType } | null>(null);
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [studentData, setStudentData] = useState<any>(null);
  // ── Load existing docs ──
  const loadDocuments = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const supabase = assertSupabase();
      let registration = null;
      let student = null;
      if (registrationId) {
        const { data } = await supabase.from('registration_requests').select('*').eq('id', registrationId).single();
        registration = data;
      } else {
        const { data: prof } = await supabase.from('profiles').select('email').eq('auth_user_id', user.id).single();
        if (prof?.email) {
          const { data } = await supabase.from('registration_requests').select('*').ilike('guardian_email', prof.email).order('created_at', { ascending: false }).limit(1).single();
          registration = data;
        }
      }
      if (studentId) {
        const { data } = await supabase.from('students').select('*').eq('id', studentId).single();
        student = data;
      } else {
        const parentId = profile?.id || user?.id;
        if (parentId) {
          const { data } = await supabase.from('students').select('*').or(`parent_id.eq.${parentId},guardian_id.eq.${parentId}`).order('created_at', { ascending: false }).limit(1).single();
          student = data;
        }
      }
      setRegistrationData(registration);
      setStudentData(student);
      const uploaded: UploadedDocument[] = [];
      const src = registration || student;
      if (src) {
        if (src.student_birth_certificate_url) uploaded.push({ type: 'birth_certificate', url: src.student_birth_certificate_url, uploadedAt: src.updated_at || src.created_at });
        if (src.student_clinic_card_url) uploaded.push({ type: 'clinic_card', url: src.student_clinic_card_url, uploadedAt: src.updated_at || src.created_at });
        if (src.guardian_id_document_url) uploaded.push({ type: 'guardian_id', url: src.guardian_id_document_url, uploadedAt: src.updated_at || src.created_at });
      }
      setUploadedDocs(uploaded);
    } catch (error) {
      if (__DEV__) logger.error('[DocUpload] Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, profile?.id, registrationId, studentId]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);
  // ── Base64 → Uint8Array ──
  const base64ToUint8Array = (base64: string): Uint8Array => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const str = base64.replace(/\s/g, '');
    const out: number[] = [];
    for (let i = 0; i < str.length; i += 4) {
      const e1 = chars.indexOf(str.charAt(i)), e2 = chars.indexOf(str.charAt(i + 1));
      const e3 = chars.indexOf(str.charAt(i + 2)), e4 = chars.indexOf(str.charAt(i + 3));
      out.push((e1 << 2) | (e2 >> 4));
      if (e3 !== 64 && e3 !== -1) out.push(((e2 & 15) << 4) | (e3 >> 2));
      if (e4 !== 64 && e4 !== -1) out.push(((e3 & 3) << 6) | e4);
    }
    return new Uint8Array(out);
  };
  // ── Upload ──
  const uploadDocument = useCallback(async (docType: DocumentType, file: { uri: string; name: string; mimeType?: string }) => {
    if (!user?.id || !profile?.preschool_id) { showAlert({ title: 'Error', message: 'You must be logged in to upload documents' }); return; }
    setUploading(docType);
    setUploadProgress(0);
    try {
      const supabase = assertSupabase();
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `documents/${profile.preschool_id}/${user.id}/${docType}_${Date.now()}.${ext}`;
      setUploadProgress(10);
      let body: Uint8Array;
      if (Platform.OS === 'web') {
        const resp = await fetch(file.uri);
        body = new Uint8Array(await resp.arrayBuffer());
      } else {
        setUploadProgress(20);
        const b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        setUploadProgress(40);
        body = base64ToUint8Array(b64);
      }
      setUploadProgress(50);
      const { error: uploadErr } = await supabase.storage.from('registration-documents').upload(filePath, body, { contentType: file.mimeType || 'application/octet-stream', upsert: true });
      setUploadProgress(70);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('registration-documents').getPublicUrl(filePath);
      const docInfo = DOCUMENTS.find(d => d.type === docType)!;
      if (registrationData?.id) {
        await supabase.from('registration_requests').update({ [docInfo.dbColumn]: urlData.publicUrl, documents_uploaded: true }).eq('id', registrationData.id);
      }
      if (studentData?.id) {
        const colMap: Record<string, string> = { student_birth_certificate_url: 'birth_certificate_url', student_clinic_card_url: 'clinic_card_url', guardian_id_document_url: 'guardian_id_url' };
        try { await supabase.from('students').update({ [colMap[docInfo.dbColumn] || docInfo.dbColumn]: urlData.publicUrl }).eq('id', studentData.id); } catch {}
      }
      setUploadProgress(90);
      await loadDocuments();
      setUploadProgress(100);
      showAlert({ title: '✅ Document Uploaded', message: `Your ${docInfo.label} has been uploaded successfully. The school will review it.` });
    } catch (error: any) {
      showAlert({ title: 'Upload Failed', message: error.message || 'Failed to upload document. Please try again.' });
    } finally {
      setUploading(null);
      setUploadProgress(0);
    }
  }, [user?.id, profile?.preschool_id, registrationData?.id, studentData?.id, showAlert, loadDocuments]);
  // ── Pick document ──
  const handlePickDocument = useCallback(async (docType: DocumentType) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets[0]) await uploadDocument(docType, result.assets[0]);
    } catch { showAlert({ title: 'Error', message: 'Failed to select document' }); }
  }, [uploadDocument, showAlert]);
  // ── Pick image ──
  const handlePickImage = useCallback(async (docType: DocumentType, useCamera: boolean) => {
    try {
      const hasPerm = useCamera ? (await ImagePicker.requestCameraPermissionsAsync()).status === 'granted' : await ensureImageLibraryPermission();
      if (!hasPerm) { showAlert({ title: 'Permission Required', message: `Please grant ${useCamera ? 'camera' : 'photo library'} access to upload documents.` }); return; }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false });
      if (!result.canceled && result.assets[0]) setPendingDocImage({ uri: result.assets[0].uri, docType });
    } catch { showAlert({ title: 'Error', message: 'Failed to select image' }); }
  }, [showAlert]);
  // ── View document ──
  const handleViewDocument = useCallback(async (url: string) => {
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else showAlert({ title: 'Error', message: 'Cannot open document URL' });
    } catch { showAlert({ title: 'Error', message: 'Failed to open document' }); }
  }, [showAlert]);
  // ── Upload options ──
  const showUploadOptions = useCallback((docType: DocumentType) => {
    const docInfo = DOCUMENTS.find(d => d.type === docType);
    showAlert({
      title: `Upload ${docInfo?.label}`,
      message: 'Choose how to upload your document',
      buttons: [
        { text: 'Take Photo', onPress: () => handlePickImage(docType, true) },
        { text: 'Choose from Gallery', onPress: () => handlePickImage(docType, false) },
        { text: 'Select PDF/File', onPress: () => handlePickDocument(docType) },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  }, [showAlert, handlePickImage, handlePickDocument]);
  // ── Pending image confirm/cancel ──
  const confirmPendingImage = useCallback(async (uri: string) => {
    if (pendingDocImage) {
      await uploadDocument(pendingDocImage.docType, { uri, name: `${pendingDocImage.docType}_${Date.now()}.jpg`, mimeType: 'image/jpeg' });
    }
    setPendingDocImage(null);
  }, [pendingDocImage, uploadDocument]);
  const cancelPendingImage = useCallback(() => setPendingDocImage(null), []);
  const allDocsUploaded = DOCUMENTS.every(doc => uploadedDocs.some(u => u.type === doc.type));
  return {
    loading, uploading, uploadProgress, uploadedDocs, pendingDocImage,
    allDocsUploaded,
    handleViewDocument, showUploadOptions,
    confirmPendingImage, cancelPendingImage,
  };
}
