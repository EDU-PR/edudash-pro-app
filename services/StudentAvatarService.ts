import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import ProfileImageService from '@/services/ProfileImageService';

export interface UploadStudentAvatarResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
}

interface ParentProfile {
  id: string;
  organization_id: string | null;
  preschool_id: string | null;
}

interface StudentRow {
  id: string;
  organization_id: string | null;
  preschool_id: string | null;
  parent_id: string | null;
  guardian_id: string | null;
}

const BUCKET_NAME = 'avatars';
const STUDENT_AVATAR_FOLDER = 'student_avatars';

export class StudentAvatarService {
  static async uploadStudentAvatar(studentId: string, imageUri: string): Promise<UploadStudentAvatarResult> {
    try {
      const { data: authData, error: authError } = await assertSupabase().auth.getUser();
      if (authError || !authData?.user) {
        return { success: false, error: 'Unauthorized: user not authenticated' };
      }

      const validation = await ProfileImageService.validateImage(imageUri);
      if (!validation.valid) {
        return { success: false, error: validation.error || 'Invalid image file' };
      }

      const parentProfile = await this.getParentProfile(authData.user.id);
      if (!parentProfile) {
        return { success: false, error: 'Parent profile not found' };
      }

      const student = await this.getAuthorizedStudent(studentId, parentProfile, authData.user.id);
      if (!student) {
        return { success: false, error: 'Child not linked to this parent' };
      }

      const processedUri = await this.processImage(imageUri);
      if (!processedUri) {
        return { success: false, error: 'Unable to process image' };
      }

      const uploadBody = await this.createUploadBody(processedUri);
      if (!uploadBody) {
        return { success: false, error: 'Unable to prepare image for upload' };
      }

      // Storage RLS for the `avatars` bucket allows inserts when the object name starts with auth.uid().
      // Prefixing with the authenticated user's ID keeps student avatar uploads compliant with policies.
      const filename = `${authData.user.id}/${STUDENT_AVATAR_FOLDER}/${studentId}_${Date.now()}.jpg`;
      const { error: uploadError } = await assertSupabase()
        .storage
        .from(BUCKET_NAME)
        .upload(filename, uploadBody as Uint8Array, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        return { success: false, error: uploadError.message || 'Upload failed' };
      }

      const { data: publicUrlData } = assertSupabase()
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(filename);

      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) {
        return { success: false, error: 'Failed to generate public URL' };
      }

      let updateQuery = assertSupabase()
        .from('students')
        .update({ avatar_url: publicUrl })
        .eq('id', studentId);

      const orgId = parentProfile.organization_id || parentProfile.preschool_id;
      if (orgId) {
        updateQuery = updateQuery.or(`organization_id.eq.${orgId},preschool_id.eq.${orgId}`);
      }

      const { error: updateError } = await updateQuery;
      if (updateError) {
        return { success: false, error: updateError.message || 'Failed to update student record' };
      }

      return { success: true, publicUrl };
    } catch (error) {
      logger.error('[StudentAvatarService] Upload error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  private static async getParentProfile(authUserId: string): Promise<ParentProfile | null> {
    const { data, error } = await assertSupabase()
      .from('profiles')
      .select('id, organization_id, preschool_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error || !data?.id) {
      return null;
    }

    return {
      id: data.id,
      organization_id: data.organization_id ?? null,
      preschool_id: data.preschool_id ?? null,
    };
  }

  private static async getAuthorizedStudent(
    studentId: string,
    parentProfile: ParentProfile,
    authUserId: string
  ): Promise<StudentRow | null> {
    const parentFilters = [
      `parent_id.eq.${parentProfile.id}`,
      `guardian_id.eq.${parentProfile.id}`,
      `parent_id.eq.${authUserId}`,
      `guardian_id.eq.${authUserId}`,
    ];

    const { data, error } = await assertSupabase()
      .from('students')
      .select('id, organization_id, preschool_id, parent_id, guardian_id')
      .eq('id', studentId)
      .or(parentFilters.join(','))
      .maybeSingle();

    if (error) {
      return null;
    }

    if (!data?.id) {
      // Fallback: allow junction-table linked parents to upload
      const { data: relationship } = await assertSupabase()
        .from('student_parent_relationships')
        .select('student_id')
        .eq('student_id', studentId)
        .eq('parent_id', parentProfile.id)
        .maybeSingle();

      if (!relationship?.student_id) {
        return null;
      }

      const { data: linkedStudent, error: linkedError } = await assertSupabase()
        .from('students')
        .select('id, organization_id, preschool_id, parent_id, guardian_id')
        .eq('id', studentId)
        .maybeSingle();

      if (linkedError || !linkedStudent?.id) {
        return null;
      }

      const orgId = parentProfile.organization_id || parentProfile.preschool_id;
      if (orgId) {
        if (linkedStudent.organization_id && linkedStudent.organization_id !== orgId) {
          return null;
        }
        if (linkedStudent.preschool_id && linkedStudent.preschool_id !== orgId) {
          return null;
        }
      }

      return linkedStudent as StudentRow;
    }

    const orgId = parentProfile.organization_id || parentProfile.preschool_id;
    if (orgId) {
      if (data.organization_id && data.organization_id !== orgId) {
        return null;
      }
      if (data.preschool_id && data.preschool_id !== orgId) {
        return null;
      }
    }

    return data as StudentRow;
  }

  private static async processImage(uri: string): Promise<string | null> {
    try {
      const result = await manipulateAsync(
        uri,
        [{ resize: { width: 600, height: 600 } }],
        { compress: 0.85, format: SaveFormat.JPEG }
      );
      return result.uri;
    } catch {
      return null;
    }
  }

  private static async createUploadBody(uri: string): Promise<Uint8Array | null> {
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        if (!response.ok) {
          return null;
        }
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
      }

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      return this.base64ToUint8Array(base64);
    } catch {
      return null;
    }
  }

  private static base64ToUint8Array(base64: string): Uint8Array {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const sanitized = base64.replace(/\s/g, '');
    const output: number[] = [];

    for (let i = 0; i < sanitized.length; i += 4) {
      const enc1 = chars.indexOf(sanitized.charAt(i));
      const enc2 = chars.indexOf(sanitized.charAt(i + 1));
      const enc3 = chars.indexOf(sanitized.charAt(i + 2));
      const enc4 = chars.indexOf(sanitized.charAt(i + 3));

      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;

      output.push(chr1);
      if (enc3 !== 64 && enc3 !== -1) output.push(chr2);
      if (enc4 !== 64 && enc4 !== -1) output.push(chr3);
    }

    return new Uint8Array(output);
  }
}

export default StudentAvatarService;
