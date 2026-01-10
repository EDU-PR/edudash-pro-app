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

      // Step 3: Generate unique filename
      const timestamp = Date.now();
      const filename = `member_photos/${memberId}_${timestamp}.jpg`;

      // Step 4: Read file and convert to uploadable format using fetch (more reliable)
      const response = await fetch(processedImage.uri);
      if (!response.ok) {
        throw new Error(`Failed to read processed image: ${response.status}`);
      }
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Step 5: Upload to Supabase Storage (React Native compatible)
      const { error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filename, uint8Array, {
          contentType: 'image/jpeg',
          upsert: true, // Allow overwriting if same member uploads again
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
      // Try to get file info - this works for file:// URIs
      // For content:// URIs (Android), we'll skip size check and let ImageManipulator handle it
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          return { valid: false, error: 'Image file not found' };
        }

        // Check file size (max 5MB) - only if size is available
        if (info.size && info.size > 5 * 1024 * 1024) {
          return { valid: false, error: 'Image must be less than 5MB' };
        }
      } catch (fileSystemError) {
        // FileSystem.getInfoAsync might fail for content:// URIs
        // That's okay - we'll let ImageManipulator handle validation
        console.log('[MemberPhotoService] FileSystem check skipped (content URI):', uri);
      }

      // Basic URI validation
      if (!uri || (!uri.startsWith('file://') && !uri.startsWith('content://') && !uri.startsWith('http'))) {
        return { valid: false, error: 'Invalid image URI' };
      }

      return { valid: true };
    } catch (error) {
      console.error('[MemberPhotoService] Validation error:', error);
      return { valid: false, error: 'Failed to validate image' };
    }
  }
}
