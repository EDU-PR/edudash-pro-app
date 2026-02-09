/** Pop (Proof of Payment) upload handlers for aftercare registration */
import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { assertSupabase } from '@/lib/supabase';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import type { ShowAlert } from '../useAftercareRegistration.helpers';

export function usePopUpload(showAlert: ShowAlert) {
  const [proofOfPayment, setProofOfPayment] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [pendingPopUri, setPendingPopUri] = useState<string | null>(null);

  const handlePopUpload = useCallback(async () => {
    try {
      const hasPermission = await ensureImageLibraryPermission();
      if (!hasPermission) {
        showAlert({ title: 'Permission Required', message: 'Please allow access to your photos to upload proof of payment.' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setPendingPopUri(result.assets[0].uri);
    } catch (error: any) {
      showAlert({ title: 'Upload Failed', message: error?.message || 'Failed to upload proof of payment. Please try again.' });
    } finally {
      setUploadingProof(false);
    }
  }, [showAlert]);

  const confirmPopUpload = useCallback(async (uri: string) => {
    setUploadingProof(true);
    try {
      const fileName = `aftercare_pop_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await assertSupabase()
        .storage.from('pop-uploads')
        .upload(`aftercare/${fileName}`, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      const { data: urlData } = assertSupabase()
        .storage.from('pop-uploads')
        .getPublicUrl(`aftercare/${fileName}`);
      setProofOfPayment(urlData.publicUrl);
      showAlert({ title: 'Success', message: 'Proof of payment uploaded successfully!' });
    } catch (error: any) {
      showAlert({ title: 'Upload Failed', message: error?.message || 'Failed to upload proof of payment.' });
    } finally {
      setUploadingProof(false);
    }
    setPendingPopUri(null);
  }, [showAlert]);

  const cancelPopUpload = useCallback(() => setPendingPopUri(null), []);

  return {
    proofOfPayment, setProofOfPayment,
    uploadingProof, pendingPopUri,
    handlePopUpload, confirmPopUpload, cancelPopUpload,
  };
}
