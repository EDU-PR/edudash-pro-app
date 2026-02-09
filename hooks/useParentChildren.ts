/**
 * useParentChildren — state + handlers for parent-children screen
 *
 * Extracted from parent-children.tsx.
 * All Alert.alert calls replaced with showAlert callback.
 */
import { useState, useCallback, useEffect } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import StudentAvatarService from '@/services/StudentAvatarService';
import { fetchParentChildren } from '@/lib/parent-children';

type ShowAlert = (cfg: {
  title: string;
  message: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
}) => void;

export function useParentChildren(showAlert: ShowAlert) {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingChildId, setUploadingChildId] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<{ childId: string; uri: string } | null>(null);

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) router.back(); else router.replace('/');
  }, []);

  const loadChildren = useCallback(async () => {
    try {
      setLoading(true);
      if (user?.id) {
        const client = assertSupabase();
        const { data: me } = await client.from('profiles').select('id, preschool_id, organization_id').eq('auth_user_id', user.id).maybeSingle();
        if (me?.id) {
          const studentsData = await fetchParentChildren(me.id, { includeInactive: false });
          const normalized = (studentsData || []).map((child: any) => ({
            ...child,
            classes: Array.isArray(child.classes) ? child.classes[0] ?? null : child.classes ?? null,
          }));
          setChildren(normalized);
        }
      }
    } catch {
      showAlert({ title: 'Error', message: 'Failed to load children' });
    } finally {
      setLoading(false);
    }
  }, [user?.id, showAlert]);

  useEffect(() => { loadChildren(); }, [loadChildren]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChildren();
    setRefreshing(false);
  }, [loadChildren]);

  const getChildAge = useCallback((dateOfBirth: string) => {
    if (!dateOfBirth) return 'Age unknown';
    try {
      const birth = new Date(dateOfBirth);
      const today = new Date();
      const age = Math.floor((today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return age > 0 && age < 10 ? `${age} years old` : 'Age unknown';
    } catch { return 'Age unknown'; }
  }, []);

  const getChildInitials = useCallback((child: any) => {
    return `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`.toUpperCase() || 'ST';
  }, []);

  const handleAvatarUpload = useCallback(async (childId: string, source: 'camera' | 'library') => {
    try {
      const hasPermission = source === 'camera'
        ? (await ImagePicker.requestCameraPermissionsAsync()).status === 'granted'
        : await ensureImageLibraryPermission();
      if (!hasPermission) {
        showAlert({ title: 'Permission required', message: source === 'camera' ? 'Camera permission is required to take a photo.' : 'Photo library permission is required to select a photo.' });
        return;
      }
      const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.8 };
      const pickerResult = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) return;
      setPendingAvatar({ childId, uri: pickerResult.assets[0].uri });
    } catch {
      showAlert({ title: 'Error', message: 'Failed to select photo.' });
    }
  }, [showAlert]);

  const confirmAvatarUpload = useCallback(async (uri: string) => {
    if (!pendingAvatar) return;
    const { childId } = pendingAvatar;
    setPendingAvatar(null);
    try {
      setUploadingChildId(childId);
      const result = await StudentAvatarService.uploadStudentAvatar(childId, uri);
      if (result.success && result.publicUrl) {
        setChildren(prev => prev.map(c => c.id === childId ? { ...c, avatar_url: result.publicUrl } : c));
        showAlert({ title: 'Success', message: 'Child profile photo updated.' });
      } else {
        showAlert({ title: 'Upload Failed', message: result.error || 'Unable to upload profile photo.' });
      }
    } catch {
      showAlert({ title: 'Error', message: 'Failed to upload profile photo.' });
    } finally {
      setUploadingChildId(null);
    }
  }, [pendingAvatar, showAlert]);

  const showAvatarOptions = useCallback((childId: string) => {
    showAlert({
      title: 'Update Profile Photo',
      message: 'Choose an option',
      buttons: [
        { text: 'Take Photo', onPress: () => handleAvatarUpload(childId, 'camera') },
        { text: 'Choose from Library', onPress: () => handleAvatarUpload(childId, 'library') },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  }, [handleAvatarUpload, showAlert]);

  return {
    children, loading, refreshing, uploadingChildId,
    pendingAvatar, setPendingAvatar,
    handleBackPress, onRefresh,
    getChildAge, getChildInitials,
    showAvatarOptions, confirmAvatarUpload,
  };
}
