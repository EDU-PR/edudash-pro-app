/**
 * POP Upload Utilities
 * Handles both Proof of Payment and Picture of Progress uploads
 * with Supabase Storage integration, file validation, and compression
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';

// Upload types
export type POPUploadType = 'proof_of_payment' | 'picture_of_progress';

// File validation constants
export const FILE_VALIDATION = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  maxSizeBytesCompressed: 10 * 1024 * 1024, // 10MB for compressed images
  allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  allowedDocumentTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
  maxImageDimension: 2048, // Max width/height for images
  compressionQuality: 0.8,
};

// Storage buckets - matching existing database buckets
export const STORAGE_BUCKETS = {
  proof_of_payment: 'proof-of-payments', // Existing bucket in database
  picture_of_progress: 'proof-of-payments', // Using same bucket until picture-of-progress is created
} as const;

// File validation result
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  fileSize?: number;
  fileType?: string;
}

// Upload result
export interface UploadResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  error?: string;
}

// Compressed file result
export interface CompressionResult {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
}

/**
 * Validate file for POP upload
 */
export const validatePOPFile = async (
  fileUri: string,
  uploadType: POPUploadType
): Promise<FileValidationResult> => {
  try {
    // Handle Android content:// URIs - they should already be copied to cache
    // when using copyToCacheDirectory: true in DocumentPicker
    const uri = fileUri.startsWith('content://') 
      ? fileUri 
      : fileUri.startsWith('file://') 
        ? fileUri 
        : `file://${fileUri}`;
    
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    
    if (!fileInfo.exists) {
      // For content:// URIs, we may not be able to check existence
      // but the file should be valid if DocumentPicker returned it
      if (fileUri.startsWith('content://')) {
        console.log('Content URI detected, skipping existence check');
      } else {
        return {
          isValid: false,
          errors: ['File does not exist'],
        };
      }
    }
    
    const fileSize = fileInfo.size || 0;
    
    // Get MIME type from file extension or metadata
    let fileType = '';
    const extension = fileUri.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        fileType = 'image/jpeg';
        break;
      case 'png':
        fileType = 'image/png';
        break;
      case 'webp':
        fileType = 'image/webp';
        break;
      case 'pdf':
        fileType = 'application/pdf';
        break;
      default:
        // Try to infer from filename for PDFs (Android sometimes strips extension)
        if (fileUri.toLowerCase().includes('.pdf') || fileUri.toLowerCase().includes('pdf')) {
          fileType = 'application/pdf';
        } else {
          fileType = 'unknown';
        }
    }
    
    const errors: string[] = [];
    
    // Check file size
    if (fileSize > FILE_VALIDATION.maxSizeBytes) {
      errors.push(`File size must be less than ${FILE_VALIDATION.maxSizeBytes / (1024 * 1024)}MB`);
    }
    
    // Check file type based on upload type
    const allowedTypes = uploadType === 'proof_of_payment' 
      ? FILE_VALIDATION.allowedDocumentTypes 
      : FILE_VALIDATION.allowedImageTypes;
    
    if (!allowedTypes.includes(fileType)) {
      if (uploadType === 'proof_of_payment') {
        errors.push('Only PDF and image files (JPG, PNG) are allowed for payment receipts');
      } else {
        errors.push('Only image files (JPG, PNG, WebP) are allowed for progress pictures');
      }
    }
    
    // Note: We skip complex file content validation here.
    // Supabase Storage will reject truly invalid files on upload.
    // This keeps validation fast and avoids ImageManipulator issues with PDFs.
    
    return {
      isValid: errors.length === 0,
      errors,
      fileSize,
      fileType,
    };
  } catch (error) {
    console.error('File validation error:', error);
    // If validation fails but we have a file from DocumentPicker, try to continue
    // The upload will fail at the Supabase level if the file is truly invalid
    const extension = fileUri.split('.').pop()?.toLowerCase();
    const isPdf = extension === 'pdf' || fileUri.toLowerCase().includes('pdf');
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(extension || '');
    
    if (isPdf || isImage) {
      console.log('Validation error but file appears valid by extension, allowing upload attempt');
      return {
        isValid: true,
        errors: [],
        fileSize: 0,
        fileType: isPdf ? 'application/pdf' : `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      };
    }
    
    return {
      isValid: false,
      errors: ['Failed to validate file. Please try a different file or format.'],
    };
  }
};

/**
 * Compress image if needed
 */
export const compressImageIfNeeded = async (
  fileUri: string,
  fileSize: number
): Promise<CompressionResult | null> => {
  try {
    // Only compress if file is too large or dimensions might be too big
    if (fileSize <= FILE_VALIDATION.maxSizeBytesCompressed) {
      return null; // No compression needed
    }
    
    // Compress the image
    const compressedImage = await ImageManipulator.manipulateAsync(
      fileUri,
      [
        {
          resize: {
            width: FILE_VALIDATION.maxImageDimension,
            height: FILE_VALIDATION.maxImageDimension,
          },
        },
      ],
      {
        compress: FILE_VALIDATION.compressionQuality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    );
    
    // Get compressed file info
    const compressedFileInfo = await FileSystem.getInfoAsync(compressedImage.uri);
    const size = (compressedFileInfo && 'size' in compressedFileInfo) ? (compressedFileInfo as any).size || 0 : 0;
    
    return {
      uri: compressedImage.uri,
      width: compressedImage.width,
      height: compressedImage.height,
      fileSize: size,
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    return null;
  }
};

/**
 * Generate unique file path for storage
 */
export const generateStorageFilePath = (
  uploadType: POPUploadType,
  userId: string,
  studentId: string,
  originalFileName: string
): string => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = originalFileName.split('.').pop()?.toLowerCase() || 'jpg';
  
  // Create hierarchical path: userId/studentId/timestamp_random.ext
  return `${userId}/${studentId}/${timestamp}_${randomSuffix}.${extension}`;
};

/**
 * Upload file to Supabase Storage
 */
export const uploadPOPFile = async (
  fileUri: string,
  uploadType: POPUploadType,
  userId: string,
  studentId: string,
  originalFileName: string
): Promise<UploadResult> => {
  try {
    console.log('Starting POP file upload:', { uploadType, fileUri, originalFileName });
    
    // Validate file
    const validation = await validatePOPFile(fileUri, uploadType);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', '),
      };
    }
    
    let uploadUri = fileUri;
    let finalFileSize = validation.fileSize || 0;
    let finalFileType = validation.fileType || 'unknown';
    
    // Compress image if it's an image and too large
    if (FILE_VALIDATION.allowedImageTypes.includes(finalFileType)) {
      const compressed = await compressImageIfNeeded(fileUri, finalFileSize);
      if (compressed) {
        uploadUri = compressed.uri;
        finalFileSize = compressed.fileSize;
        finalFileType = 'image/jpeg'; // Compressed to JPEG
        console.log('Image compressed:', { originalSize: validation.fileSize, newSize: finalFileSize });
      }
    }
    
    // Generate storage path
    const storagePath = generateStorageFilePath(uploadType, userId, studentId, originalFileName);
    const bucket = STORAGE_BUCKETS[uploadType];
    
    // Read file as base64 for upload
    // Note: Using 'base64' string literal instead of FileSystem.EncodingType.Base64
    // to avoid "Cannot read property 'Base64' of undefined" errors in some Expo versions
    const base64 = await FileSystem.readAsStringAsync(uploadUri, {
      encoding: 'base64',
    });
    
    // Convert base64 to ArrayBuffer using base64-arraybuffer
    // Note: React Native doesn't support new Blob([Uint8Array]), so we upload ArrayBuffer directly
    const arrayBuffer = decode(base64);
    
    // Upload to Supabase Storage (Supabase accepts ArrayBuffer directly)
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, arrayBuffer, {
        contentType: finalFileType,
        upsert: false,
      });
    
    if (error) {
      console.error('Supabase storage upload error:', error);
      return {
        success: false,
        error: `Upload failed: ${error.message}`,
      };
    }
    
    console.log('POP file uploaded successfully:', data?.path);
    
    return {
      success: true,
      filePath: data?.path || storagePath,
      fileName: originalFileName,
      fileSize: finalFileSize,
      fileType: finalFileType,
    };
  } catch (error) {
    console.error('POP upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    };
  }
};

/**
 * Get signed URL for viewing uploaded file
 */
export const getPOPFileUrl = async (
  uploadType: POPUploadType,
  filePath: string,
  expiresIn = 3600 // 1 hour
): Promise<string | null> => {
  try {
    const bucket = STORAGE_BUCKETS[uploadType];
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      console.error('Failed to create signed URL:', error);
      return null;
    }
    
    return data?.signedUrl || null;
  } catch (error) {
    console.error('Error getting POP file URL:', error);
    return null;
  }
};

/**
 * Delete POP file from storage
 */
export const deletePOPFile = async (
  uploadType: POPUploadType,
  filePath: string
): Promise<boolean> => {
  try {
    const bucket = STORAGE_BUCKETS[uploadType];
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);
    
    if (error) {
      console.error('Failed to delete POP file:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting POP file:', error);
    return false;
  }
};

/**
 * Get file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Get file type icon name for display
 */
export const getFileTypeIcon = (fileType: string): string => {
  if (fileType.startsWith('image/')) {
    return 'image';
  } else if (fileType === 'application/pdf') {
    return 'document-text';
  } else {
    return 'document';
  }
};