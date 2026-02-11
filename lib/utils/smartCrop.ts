/**
 * Smart crop utility for auto-framing images.
 *
 * Provides aspect-ratio-aware center framing:
 * - 'face' mode: center-weighted crop with slight upward bias (faces are typically in upper portion)
 * - 'document' mode: center crop with full-width preference
 * - 'auto' mode: picks based on aspect ratio — portrait → face, landscape → document
 *
 * No ML dependency — uses geometry heuristics via expo-image-manipulator.
 *
 * @filesize ≤200 lines (utility limit)
 */
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

export type SmartCropMode = 'face' | 'document' | 'auto';

export interface CropRegion {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface SmartCropResult {
  /** URI of the cropped image */
  uri: string;
  /** The crop region applied */
  region: CropRegion;
  /** Whether auto-crop was applied (false if image already fits) */
  wasAutoCropped: boolean;
}

/**
 * Get image dimensions from URI.
 */
function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error || new Error('Failed to get image size')),
    );
  });
}

/**
 * Compute the smart crop region for an image.
 */
function computeCropRegion(
  imgWidth: number,
  imgHeight: number,
  targetAspect: number, // width / height
  mode: SmartCropMode,
): CropRegion {
  const imgAspect = imgWidth / imgHeight;

  // If image already matches target aspect ratio (±5%), no crop needed
  if (Math.abs(imgAspect - targetAspect) / targetAspect < 0.05) {
    return { originX: 0, originY: 0, width: imgWidth, height: imgHeight };
  }

  let cropW: number;
  let cropH: number;

  if (imgAspect > targetAspect) {
    // Image is wider than target — crop horizontally
    cropH = imgHeight;
    cropW = Math.round(imgHeight * targetAspect);
  } else {
    // Image is taller than target — crop vertically
    cropW = imgWidth;
    cropH = Math.round(imgWidth / targetAspect);
  }

  // Clamp to image bounds
  cropW = Math.min(cropW, imgWidth);
  cropH = Math.min(cropH, imgHeight);

  // Compute origin based on mode
  let originX = Math.round((imgWidth - cropW) / 2);
  let originY: number;

  const resolvedMode =
    mode === 'auto'
      ? imgAspect < 1
        ? 'face' // portrait image → face mode
        : 'document' // landscape → document mode
      : mode;

  if (resolvedMode === 'face') {
    // Bias upward — faces are typically in upper 40% of image
    const faceCenter = imgHeight * 0.38;
    originY = Math.round(Math.max(0, faceCenter - cropH / 2));
    originY = Math.min(originY, imgHeight - cropH);
  } else {
    // Document: center crop
    originY = Math.round((imgHeight - cropH) / 2);
  }

  // Final bounds clamp
  originX = Math.max(0, Math.min(originX, imgWidth - cropW));
  originY = Math.max(0, Math.min(originY, imgHeight - cropH));

  return { originX, originY, width: cropW, height: cropH };
}

/**
 * Apply smart auto-crop to an image.
 *
 * @param imageUri   Source image URI
 * @param mode       'face' | 'document' | 'auto'
 * @param aspectRatio  [width, height] target aspect ratio, e.g. [1, 1] for square
 * @returns SmartCropResult with cropped URI and region info
 */
export async function applySmartCrop(
  imageUri: string,
  mode: SmartCropMode = 'auto',
  aspectRatio?: [number, number],
): Promise<SmartCropResult> {
  if (!aspectRatio) {
    // No target aspect — return original unchanged
    return {
      uri: imageUri,
      region: { originX: 0, originY: 0, width: 0, height: 0 },
      wasAutoCropped: false,
    };
  }

  const targetAspect = aspectRatio[0] / aspectRatio[1];
  const { width, height } = await getImageSize(imageUri);
  const region = computeCropRegion(width, height, targetAspect, mode);

  // Check if crop is basically the full image (no meaningful crop)
  const areaRatio = (region.width * region.height) / (width * height);
  if (areaRatio > 0.95) {
    return { uri: imageUri, region, wasAutoCropped: false };
  }

  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ crop: region }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );

  return {
    uri: result.uri,
    region,
    wasAutoCropped: true,
  };
}
