/** Logo picking, uploading, clearing — extracted from job-posting-create */
import { useCallback, useState } from 'react';
import { assertSupabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { base64ToUint8Array } from '@/lib/utils/base64';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import type { ShowAlert } from './types';

interface Params {
  preschoolId: string | null | undefined;
  showAlert: ShowAlert;
}

export function useJobPostingLogo({ preschoolId, showAlert }: Params) {
  const [jobLogoUrl, setJobLogoUrl] = useState<string | null>(null);
  const [jobLogoUploading, setJobLogoUploading] = useState(false);
  const [pendingLogoUri, setPendingLogoUri] = useState<string | null>(null);

  const handlePickJobLogo = useCallback(async () => {
    if (!preschoolId) {
      showAlert({ title: 'Error', message: 'Missing school information', type: 'error' });
      return;
    }
    const hasPermission = await ensureImageLibraryPermission();
    if (!hasPermission) {
      showAlert({ title: 'Permission Required', message: 'Please grant photo library access to upload a logo', type: 'warning' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setPendingLogoUri(result.assets[0].uri);
  }, [preschoolId, showAlert]);

  const confirmLogoUpload = useCallback(async (uri: string) => {
    setJobLogoUploading(true);
    try {
      const processed = await manipulateAsync(
        uri,
        [{ resize: { width: 512, height: 512 } }],
        { compress: 0.85, format: SaveFormat.PNG },
      );
      const base64Data = await FileSystem.readAsStringAsync(processed.uri, { encoding: 'base64' });
      const body = base64ToUint8Array(base64Data);
      if (body.byteLength === 0) throw new Error('Failed to prepare logo for upload');

      const bucket = 'school-assets';
      const path = `${preschoolId}/job-postings/logo_${Date.now()}.png`;
      const { error: uploadError } = await assertSupabase().storage
        .from(bucket)
        .upload(path, body as any, { contentType: 'image/png', upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { data: publicData } = assertSupabase().storage.from(bucket).getPublicUrl(path);
      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) throw new Error('Failed to generate logo URL');

      setJobLogoUrl(publicUrl);

      // Sync logo to branding tables (best-effort)
      try { await assertSupabase().from('school_branding').upsert({ preschool_id: preschoolId, logo_url: publicUrl }, { onConflict: 'preschool_id' }).select('id').single(); } catch { /* skip */ }
      try { await assertSupabase().from('organizations').update({ logo_url: publicUrl }).eq('id', preschoolId); } catch { /* skip */ }
      try { await assertSupabase().from('preschools').update({ logo_url: publicUrl }).eq('id', preschoolId); } catch { /* skip */ }
    } catch (error: any) {
      showAlert({ title: 'Logo Upload Failed', message: error.message || 'Failed to upload logo', type: 'error' });
    } finally {
      setJobLogoUploading(false);
      setPendingLogoUri(null);
    }
  }, [preschoolId, showAlert]);

  const handleClearJobLogo = useCallback(() => {
    setJobLogoUrl(null);
  }, []);

  return {
    jobLogoUrl, setJobLogoUrl,
    jobLogoUploading,
    pendingLogoUri, setPendingLogoUri,
    handlePickJobLogo, confirmLogoUpload, handleClearJobLogo,
  };
}
