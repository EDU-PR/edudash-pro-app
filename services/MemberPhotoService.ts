/**
 * Member Photo Service
 * Handles photo uploads for organization members (ID card photos)
 */
import { assertSupabase } from '@/lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export interface MemberPhotoUploadResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
}

export class MemberPhotoService {
  private static readonly BUCKET_NAME = 'avatars';
  private static readonly MAX_SIZE = 800; // Max width/height for ID card photos
  private static readonly QUALITY = 0.9; // Higher quality for ID cards

  /**
   * Upload photo for organization member (ID card photo)
   * Updates organization_members.photo_url
   */
  static async uploadMemberPhoto(
    userId: string,
    memberId: string,
    imageUri: string
  ): Promise<MemberPhotoUploadResult> {
    try {
      const supabase = assertSupabase();
      
      // Step 1: Validate user authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || user.id !== userId) {
        return {
          success: false,
          error: 'Unauthorized: User authentication failed'
        };
      }

      // Step 2: Process and resize image for ID card (square, high quality)
      const processedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          { resize: { width: this.MAX_SIZE, height: this.MAX_SIZE } },
        ],
        {
          compress: this.QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Step 3: Read file as base64
      const base64 = await FileSystem.readAsStringAsync(processedImage.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Step 4: Generate unique filename
      const timestamp = Date.now();
      const filename = `member_${userId}_${timestamp}.jpg`;

      // Step 5: Convert base64 to array buffer for React Native
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Step 6: Upload to Supabase Storage (React Native compatible)
      const { error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filename, byteArray, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return {
          success: false,
          error: `Upload failed: ${uploadError.message}`
        };
      }

      // Step 7: Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filename);

      if (!publicUrl) {
        return {
          success: false,
          error: 'Failed to generate public URL'
        };
      }

      // Step 8: Update organization_members.photo_url
      const { error: memberError } = await supabase
        .from('organization_members')
        .update({ photo_url: publicUrl })
        .eq('id', memberId)
        .eq('user_id', userId); // Security: ensure user can only update their own photo

      if (memberError) {
        console.warn('Member photo update error:', memberError);
        // Still consider successful since image was uploaded
      }

      // Step 9: Also update profiles.avatar_url for consistency
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (profileError) {
        console.warn('Profile avatar update error:', profileError);
        // Not critical
      }

      return {
        success: true,
        publicUrl
      };

    } catch (error) {
      console.error('Member photo upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      };
    }
  }

  /**
   * Validate image before upload
   */
  static async validateImage(uri: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        return { valid: false, error: 'Image file not found' };
      }

      // Check file size (max 5MB)
      if (info.size && info.size > 5 * 1024 * 1024) {
        return { valid: false, error: 'Image must be less than 5MB' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Failed to validate image' };
    }
  }
}
