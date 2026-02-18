import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CAMERA_RECOVERY_KEY = '@dash:camera_recovery:pending';
const CAMERA_RECOVERY_STALE_MS = 10 * 60 * 1000;

type CameraRecoveryMarker = {
  contextKey: string;
  startedAt: number;
};

export function normalizeMediaUri(uri?: string | null): string {
  if (!uri) return '';
  if (uri.startsWith('content://')) return uri;
  if (uri.startsWith('file://')) return uri;
  if (uri.includes('://')) return uri;
  return `file://${uri}`;
}

async function readMarker(): Promise<CameraRecoveryMarker | null> {
  try {
    const raw = await AsyncStorage.getItem(CAMERA_RECOVERY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CameraRecoveryMarker;
    if (!parsed?.contextKey || typeof parsed.startedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeMarker(contextKey: string): Promise<void> {
  const payload: CameraRecoveryMarker = {
    contextKey,
    startedAt: Date.now(),
  };
  await AsyncStorage.setItem(CAMERA_RECOVERY_KEY, JSON.stringify(payload));
}

async function clearMarker(): Promise<void> {
  await AsyncStorage.removeItem(CAMERA_RECOVERY_KEY);
}

export async function clearPendingCameraResult(contextKey?: string): Promise<void> {
  if (!contextKey) {
    await clearMarker();
    return;
  }
  const marker = await readMarker();
  if (!marker || marker.contextKey === contextKey) {
    await clearMarker();
  }
}

function normalizeResult(
  result: ImagePicker.ImagePickerResult
): ImagePicker.ImagePickerResult {
  if (result.canceled) {
    return { canceled: true, assets: null };
  }
  if (!result.assets?.length) return { canceled: false, assets: [] };
  return {
    canceled: false,
    assets: result.assets.map((asset) => ({
      ...asset,
      uri: normalizeMediaUri(asset.uri),
    })),
  };
}

export async function launchCameraWithRecovery(
  contextKey: string,
  options: ImagePicker.ImagePickerOptions
): Promise<ImagePicker.ImagePickerResult> {
  if (Platform.OS === 'android') {
    console.log('[camera_launch] Starting camera flow', { contextKey });
    await writeMarker(contextKey);
  }

  try {
    const result = await ImagePicker.launchCameraAsync(options);
    if (Platform.OS === 'android') {
      await clearPendingCameraResult(contextKey);
    }
    return normalizeResult(result);
  } catch (error) {
    if (Platform.OS === 'android') {
      await clearPendingCameraResult(contextKey);
    }
    throw error;
  }
}

export async function consumePendingCameraResult(
  contextKey: string
): Promise<ImagePicker.ImagePickerResult | null> {
  if (Platform.OS !== 'android') return null;

  const marker = await readMarker();
  if (!marker) return null;

  const isStale = Date.now() - marker.startedAt > CAMERA_RECOVERY_STALE_MS;
  if (isStale) {
    await clearPendingCameraResult(contextKey);
    return null;
  }

  if (marker.contextKey !== contextKey) return null;

  try {
    const pending = await ImagePicker.getPendingResultAsync();
    if (!pending) return null;
    if ('code' in pending) {
      console.warn('[camera_recovered] Pending camera result contains error', {
        contextKey,
        code: pending.code,
        message: pending.message,
      });
      await clearPendingCameraResult(contextKey);
      return null;
    }
    const normalized = normalizeResult(pending);
    if (normalized.canceled || !normalized.assets?.length) {
      // Clear the marker even when the user cancels camera so we do not
      // keep trying to recover a stale session on future launches.
      await clearPendingCameraResult(contextKey);
      return null;
    }
    if (!normalized.canceled && normalized.assets?.length) {
      console.log('[camera_recovered] Recovered pending camera result', {
        contextKey,
        assetCount: normalized.assets.length,
      });
      await clearPendingCameraResult(contextKey);
      return normalized;
    }
  } catch (error) {
    console.warn('[camera_recovered] Failed to consume pending camera result', {
      contextKey,
      error,
    });
  }

  return null;
}
