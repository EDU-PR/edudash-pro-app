/**
 * VoiceStorageService
 * 
 * Handles voice note uploads to Supabase Storage with signed URL generation
 * for playback. Supports compression and metadata tracking.
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { assertSupabase } from '@/lib/supabase';

const VOICE_BUCKET = 'voice_recordings';
const MAX_VOICE_SIZE_MB = 10; // 10MB max for voice notes

export interface VoiceNoteMetadata {
  id: string;
  uri: string;
  duration: number; // in ms
  storagePath: string;
  publicUrl: string;
  createdAt: Date;
  userId: string;
  conversationId?: string;
  mimeType: string;
  size: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Convert base64 string to Uint8Array for upload
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a unique filename for voice note
 */
function generateVoiceFilename(userId: string, conversationId?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const prefix = conversationId ? `${conversationId}/` : '';
  return `${userId}/${prefix}voice_${timestamp}_${random}.m4a`;
}

/**
 * Get file size from local URI
 */
async function getFileSize(uri: string): Promise<number> {
  try {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size;
    } else {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return fileInfo.exists ? (fileInfo.size || 0) : 0;
    }
  } catch (error) {
    console.error('[VoiceStorage] Failed to get file size:', error);
    return 0;
  }
}

/**
 * Upload voice note to Supabase Storage
 */
export async function uploadVoiceNote(
  localUri: string,
  duration: number,
  conversationId?: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<VoiceNoteMetadata> {
  const supabase = assertSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Validate file size
  const fileSize = await getFileSize(localUri);
  if (fileSize > MAX_VOICE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Voice note exceeds maximum size of ${MAX_VOICE_SIZE_MB}MB`);
  }

  // Generate storage path
  const storagePath = generateVoiceFilename(user.id, conversationId);
  const mimeType = 'audio/mp4'; // m4a files

  console.log('[VoiceStorage] Uploading voice note:', {
    localUri,
    storagePath,
    fileSize,
    duration,
  });

  // Read file content
  let fileData: Uint8Array | Blob;
  
  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    fileData = await response.blob();
  } else {
    // For mobile, read as base64 and convert to Uint8Array
    const base64Data = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    fileData = base64ToUint8Array(base64Data);
  }

  // Report initial progress
  onProgress?.({ loaded: 0, total: fileSize, percentage: 0 });

  // Upload to Supabase Storage
  const { data, error: uploadError } = await supabase.storage
    .from(VOICE_BUCKET)
    .upload(storagePath, fileData, {
      contentType: mimeType,
      upsert: false,
      cacheControl: '3600',
    });

  if (uploadError) {
    console.error('[VoiceStorage] Upload failed:', uploadError);
    throw new Error(`Failed to upload voice note: ${uploadError.message}`);
  }

  // Report complete progress
  onProgress?.({ loaded: fileSize, total: fileSize, percentage: 100 });

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(VOICE_BUCKET)
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  console.log('[VoiceStorage] Upload complete:', {
    storagePath,
    publicUrl,
  });

  // Create metadata object
  const metadata: VoiceNoteMetadata = {
    id: `voice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    uri: localUri,
    duration,
    storagePath,
    publicUrl,
    createdAt: new Date(),
    userId: user.id,
    conversationId,
    mimeType,
    size: fileSize,
  };

  return metadata;
}

/**
 * Create a signed URL for private voice note access
 */
export async function createSignedVoiceUrl(
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const supabase = assertSupabase();

  const { data, error } = await supabase.storage
    .from(VOICE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    console.error('[VoiceStorage] Failed to create signed URL:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Delete voice note from storage
 */
export async function deleteVoiceNote(storagePath: string): Promise<void> {
  const supabase = assertSupabase();

  const { error } = await supabase.storage
    .from(VOICE_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error('[VoiceStorage] Failed to delete voice note:', error);
    throw new Error(`Failed to delete voice note: ${error.message}`);
  }

  console.log('[VoiceStorage] Deleted voice note:', storagePath);
}

/**
 * Get voice note download URL (for saving/sharing)
 */
export async function downloadVoiceNote(
  storagePath: string,
  filename?: string
): Promise<string> {
  const supabase = assertSupabase();

  const { data, error } = await supabase.storage
    .from(VOICE_BUCKET)
    .download(storagePath);

  if (error) {
    console.error('[VoiceStorage] Failed to download voice note:', error);
    throw new Error(`Failed to download voice note: ${error.message}`);
  }

  // Create blob URL for download
  const url = URL.createObjectURL(data);
  return url;
}

export default {
  uploadVoiceNote,
  createSignedVoiceUrl,
  deleteVoiceNote,
  downloadVoiceNote,
};
