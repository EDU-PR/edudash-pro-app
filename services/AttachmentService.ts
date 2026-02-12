/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Attachment Service
 * 
 * Handles file picking, upload, and basic management for Dash AI attachments.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { Platform, Alert } from 'react-native';
import { assertSupabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';
import { DashAttachment, DashAttachmentKind } from '@/services/dash-ai/types';
import { base64ToUint8Array } from '@/lib/utils/base64';
import {
  consumePendingCameraResult,
  launchCameraWithRecovery,
  normalizeMediaUri,
} from '@/lib/utils/cameraRecovery';

// File size limits (in bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_MOBILE_BASE64_FALLBACK_SIZE = 4 * 1024 * 1024; // 4MB fallback guard
const DASH_ATTACHMENT_CAMERA_CONTEXT = 'dash_attachment_camera';

// Supported file types
const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
];

const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
];

const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
];

function createImageAttachment(
  asset: ImagePicker.ImagePickerAsset,
  fallbackName: string
): DashAttachment {
  return {
    id: `attach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: asset.fileName || fallbackName,
    mimeType: 'image/jpeg',
    size: asset.fileSize || 0,
    bucket: 'attachments',
    storagePath: '',
    kind: 'image',
    status: 'pending',
    uri: normalizeMediaUri(asset.uri),
    previewUri: normalizeMediaUri(asset.uri),
    uploadProgress: 0,
    meta: {
      width: asset.width,
      height: asset.height,
    },
  };
}

function resolveAttachmentUri(attachment: DashAttachment): string {
  return normalizeMediaUri(attachment.uri || attachment.previewUri || '');
}

function getFileExtensionFromName(name?: string): string {
  if (!name) return 'bin';
  const parts = name.split('.');
  const ext = parts.length > 1 ? parts.pop() : null;
  return (ext || 'bin').toLowerCase();
}

async function ensureLocalUploadUri(uri: string, fallbackName?: string): Promise<string> {
  const normalized = normalizeMediaUri(uri);
  if (!normalized.startsWith('content://')) {
    return normalized;
  }

  const ext = getFileExtensionFromName(fallbackName);
  const cacheRoot = LegacyFileSystem.cacheDirectory || LegacyFileSystem.documentDirectory;
  if (!cacheRoot) {
    throw new Error('No writable cache directory available for upload.');
  }
  const targetPath = `${cacheRoot}dash-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await LegacyFileSystem.copyAsync({ from: normalized, to: targetPath });
  return targetPath;
}

/**
 * Pick documents using expo-document-picker
 */
export async function pickDocuments(): Promise<DashAttachment[]> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: SUPPORTED_DOCUMENT_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return [];
    }

    const attachments: DashAttachment[] = [];

    for (const asset of result.assets) {
      // Validate file size
      if (asset.size && asset.size > MAX_FILE_SIZE) {
        Alert.alert(
          'File Too Large',
          `${asset.name} is too large. Maximum file size is ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.`
        );
        continue;
      }

      // Validate file type
      if (asset.mimeType && !SUPPORTED_DOCUMENT_TYPES.includes(asset.mimeType)) {
        Alert.alert(
          'Unsupported File Type',
          `${asset.name} is not a supported file type.`
        );
        continue;
      }

      const attachment: DashAttachment = {
        id: `attach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
        size: asset.size || 0,
        bucket: 'attachments',
        storagePath: '', // Will be set during upload
        kind: determineAttachmentKind(asset.mimeType || ''),
        status: 'pending',
        uri: normalizeMediaUri(asset.uri),
        previewUri: normalizeMediaUri(asset.uri),
        uploadProgress: 0,
      };

      attachments.push(attachment);
    }

    return attachments;
  } catch (error) {
    console.error('Failed to pick documents:', error);
    throw new Error('Failed to select documents. Please try again.');
  }
}

/**
 * Take a photo using the camera
 */
export async function takePhoto(): Promise<DashAttachment[]> {
  try {
    // Check permission first
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.status !== 'granted') {
      // Determine if permission was denied or needs more action
      if (permissionResult.canAskAgain === false) {
        Alert.alert(
          'Camera Permission Denied',
          'Camera access has been permanently denied. Please enable it in your device settings to take photos.',
          [
            { text: 'OK', style: 'default' },
            ...(Platform.OS === 'ios' 
              ? [{ text: 'Open Settings', onPress: () => {
                  // iOS: Link to Settings unavailable in Expo without expo-linking
                  console.log('[Camera] User needs to open Settings manually');
                }}]
              : []
            )
          ]
        );
      } else {
        Alert.alert(
          'Camera Permission Required',
          'EduDash Pro needs camera access to take photos. Please grant permission when prompted.',
          [{ text: 'OK', style: 'default' }]
        );
      }
      return [];
    }

    // Launch camera with Android process-restart recovery
    const result = await launchCameraWithRecovery(DASH_ATTACHMENT_CAMERA_CONTEXT, {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      exif: false,
      base64: false,
    });

    // Handle cancellation gracefully
    if (result.canceled || !result.assets || result.assets.length === 0) {
      if (__DEV__) console.log('[Camera] User cancelled or no photo taken');
      return [];
    }

    const attachments: DashAttachment[] = [];

    for (const asset of result.assets) {
      // Get file info to check size
      let fileInfo = { exists: false, size: 0 } as { exists: boolean; size?: number };
      try {
        fileInfo = await LegacyFileSystem.getInfoAsync(asset.uri);
      } catch (infoError) {
        console.warn('[Camera] Failed to read file info, continuing without size check:', infoError);
      }
      
      if (fileInfo.exists && fileInfo.size && fileInfo.size > MAX_IMAGE_SIZE) {
        Alert.alert(
          'Image Too Large',
          `Photo is too large. Maximum image size is ${Math.round(MAX_IMAGE_SIZE / (1024 * 1024))}MB.`
        );
        continue;
      }

      const attachment = createImageAttachment(asset, `photo_${Date.now()}.jpg`);
      attachment.size = fileInfo.exists ? (fileInfo.size || 0) : attachment.size;

      attachments.push(attachment);
    }

    return attachments;
  } catch (error) {
    console.error('Failed to take photo:', error);
    throw new Error('Failed to take photo. Please try again.');
  }
}

export async function recoverPendingPhoto(): Promise<DashAttachment[]> {
  try {
    const result = await consumePendingCameraResult(DASH_ATTACHMENT_CAMERA_CONTEXT);
    if (!result || result.canceled || !result.assets?.length) return [];
    return result.assets.map((asset) => createImageAttachment(asset, `photo_${Date.now()}.jpg`));
  } catch (error) {
    console.warn('[camera_recovered] Failed to recover pending Dash attachment photo', error);
    return [];
  }
}

/**
 * Pick images using expo-image-picker
 */
export async function pickImages(): Promise<DashAttachment[]> {
  try {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need access to your photo library to upload images.'
      );
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled) {
      return [];
    }

    const attachments: DashAttachment[] = [];

    for (const asset of result.assets) {
      // Get file info to check size
      const fileInfo = await LegacyFileSystem.getInfoAsync(asset.uri);
      
      if (fileInfo.exists && fileInfo.size && fileInfo.size > MAX_IMAGE_SIZE) {
        Alert.alert(
          'Image Too Large',
          `One of the selected images is too large. Maximum image size is ${Math.round(MAX_IMAGE_SIZE / (1024 * 1024))}MB.`
        );
        continue;
      }

      const attachment = createImageAttachment(asset, `image_${Date.now()}.jpg`);
      attachment.size = fileInfo.exists ? (fileInfo.size || 0) : attachment.size;

      attachments.push(attachment);
    }

    return attachments;
  } catch (error) {
    console.error('Failed to pick images:', error);
    throw new Error('Failed to select images. Please try again.');
  }
}

/**
 * Compute SHA256 checksum of a file
 */
export async function computeChecksum(uri: string): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      // For web, we'll use a simpler approach
      return `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uri,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    
    return hash;
  } catch (error) {
    console.error('Failed to compute checksum:', error);
    // Return a fallback unique identifier
    return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Upload attachment to Supabase Storage
 */
export async function uploadAttachment(
  attachment: DashAttachment,
  conversationId: string,
  onProgress?: (progress: number) => void
): Promise<DashAttachment> {
  try {
    const supabase = assertSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Generate storage path
    const timestamp = Date.now();
    const fileName = `${timestamp}_${attachment.name}`;
    const storagePath = `${user.id}/${conversationId}/${fileName}`;
    
    // Update attachment with storage path
    const updatedAttachment: DashAttachment = {
      ...attachment,
      storagePath,
      status: 'uploading',
    };

    if (onProgress) {
      onProgress(10);
    }

    if (Platform.OS === 'web') {
      const response = await fetch(resolveAttachmentUri(attachment));
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(storagePath, blob, {
          contentType: attachment.mimeType,
          upsert: false,
        });
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
    } else {
      const sourceUri = resolveAttachmentUri(attachment);
      if (!sourceUri) {
        throw new Error('Attachment file path is missing.');
      }
      const uploadUri = await ensureLocalUploadUri(sourceUri, attachment.name);
      const fileInfo = await LegacyFileSystem.getInfoAsync(uploadUri);
      const fileSize = fileInfo.exists ? (fileInfo.size || attachment.size || 0) : (attachment.size || 0);
      if (!fileInfo.exists) {
        throw new Error('Attachment file could not be found.');
      }

      let binaryUploaded = false;
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;
          if (accessToken) {
            console.log('[upload_binary_start] Starting binary attachment upload', {
              storagePath,
              size: fileSize,
              mimeType: attachment.mimeType,
            });
            const endpoint = `${supabaseUrl}/storage/v1/object/attachments/${storagePath}`;
            const response = await LegacyFileSystem.uploadAsync(endpoint, uploadUri, {
              httpMethod: 'POST',
              uploadType: LegacyFileSystem.FileSystemUploadType.BINARY_CONTENT,
              headers: {
                Authorization: `Bearer ${accessToken}`,
                apikey: supabaseAnonKey,
                'content-type': attachment.mimeType,
                'x-upsert': 'false',
              },
            });
            if (response.status >= 200 && response.status < 300) {
              binaryUploaded = true;
            } else {
              console.warn('[upload_binary_fail] Binary attachment upload failed', {
                storagePath,
                status: response.status,
                body: response.body?.slice(0, 200),
              });
            }
          }
        } catch (error) {
          console.warn('[upload_binary_fail] Binary attachment upload threw', {
            storagePath,
            error,
          });
        }
      }

      if (!binaryUploaded) {
        if (fileSize > MAX_MOBILE_BASE64_FALLBACK_SIZE) {
          console.warn('[upload_oom_guard] Blocking mobile base64 fallback for large attachment', {
            storagePath,
            size: fileSize,
            max: MAX_MOBILE_BASE64_FALLBACK_SIZE,
          });
          throw new Error('Image too large for analysis/upload, please retake with lower resolution.');
        }

        const base64Data = await LegacyFileSystem.readAsStringAsync(uploadUri, { encoding: LegacyFileSystem.EncodingType.Base64 });
        const fileData = base64ToUint8Array(base64Data);
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(storagePath, fileData, {
            contentType: attachment.mimeType,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }
      }
    }

    // Update status
    updatedAttachment.status = 'uploaded';
    updatedAttachment.uploadProgress = 100;
    
    if (onProgress) {
      onProgress(100);
    }

    return updatedAttachment;
  } catch (error) {
    console.error('Failed to upload attachment:', error);
    throw error;
  }
}

/**
 * Create signed URL for attachment access
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  ttlSeconds: number = 3600
): Promise<string> {
  try {
    const supabase = assertSupabase();
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, ttlSeconds);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Failed to create signed URL:', error);
    throw error;
  }
}

/**
 * Enqueue file for ingestion processing
 */
export async function enqueueIngestion(payload: {
  user_id: string;
  conversation_id: string;
  bucket: string;
  storage_path: string;
  name: string;
  mime_type: string;
  size: number;
}): Promise<{ document_id: string }> {
  try {
    const supabase = assertSupabase();
    
    const { data, error } = await supabase.functions.invoke('ingest-file', {
      body: payload,
    });

    if (error) {
      throw new Error(`Ingestion failed: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Failed to enqueue ingestion:', error);
    throw error;
  }
}

/**
 * Determine attachment kind from MIME type
 */
function determineAttachmentKind(mimeType: string): DashAttachmentKind {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return 'spreadsheet';
  }
  
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return 'presentation';
  }
  
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  
  if (
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType.startsWith('text/')
  ) {
    return 'document';
  }
  
  return 'other';
}

/**
 * Get file icon name based on attachment kind
 */
export function getFileIconName(kind: DashAttachmentKind): any {
  switch (kind) {
    case 'image':
      return 'image-outline';
    case 'pdf':
      return 'document-text-outline';
    case 'document':
      return 'document-outline';
    case 'spreadsheet':
      return 'grid-outline';
    case 'presentation':
      return 'easel-outline';
    case 'audio':
      return 'musical-notes-outline';
    default:
      return 'attach-outline';
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
