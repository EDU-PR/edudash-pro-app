import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '@/contexts/ThemeContext';
import { compressImageForAI } from '@/lib/dash-ai/imageCompression';
import {
  FREE_AUTO_SCAN_BUDGET_PER_DAY,
  hasAutoScanBudget,
  PAID_AUTO_SCAN_BUDGET_PER_DAY,
} from '@/lib/dash-ai/imageBudget';

export type HomeworkScanResult = {
  uri: string;
  base64: string;
  width: number;
  height: number;
};

interface HomeworkScannerProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (result: HomeworkScanResult) => void;
  title?: string;
  tier?: string | null;
  remainingScans?: number | null;
  userId?: string | null;
}

type HomeworkPreview = {
  uri: string;
  width: number;
  height: number;
};

type CropCandidate = {
  originX: number;
  originY: number;
  width: number;
  height: number;
  score: number;
};

const A4_PORTRAIT_ASPECT = 1 / Math.sqrt(2); // ~0.707

function buildCenteredAspectCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: number,
  coverage: number
): CropCandidate {
  const areaScale = Math.min(1, Math.max(0.7, coverage));
  const targetArea = sourceWidth * sourceHeight * areaScale;
  const cropWidth = Math.min(sourceWidth, Math.max(320, Math.floor(Math.sqrt(targetArea * targetAspect))));
  const cropHeight = Math.min(sourceHeight, Math.max(420, Math.floor(cropWidth / Math.max(0.45, targetAspect))));
  const clampedWidth = Math.min(sourceWidth, cropWidth);
  const clampedHeight = Math.min(sourceHeight, cropHeight);
  const originX = Math.max(0, Math.floor((sourceWidth - clampedWidth) / 2));
  const originY = Math.max(0, Math.floor((sourceHeight - clampedHeight) / 2));
  const resultingAspect = clampedWidth / Math.max(1, clampedHeight);
  const actualCoverage = (clampedWidth * clampedHeight) / Math.max(1, sourceWidth * sourceHeight);
  const aspectDelta = Math.abs(resultingAspect - targetAspect);
  const score = aspectDelta * 2 + (1 - actualCoverage);

  return {
    originX,
    originY,
    width: clampedWidth,
    height: clampedHeight,
    score,
  };
}

function pickDocumentCrop(sourceWidth: number, sourceHeight: number): CropCandidate {
  const sourceAspect = sourceWidth / Math.max(1, sourceHeight);
  const normalizedTarget = sourceAspect > 0.95
    ? 0.78
    : Math.min(0.82, Math.max(0.62, sourceAspect));
  const candidates: CropCandidate[] = [
    buildCenteredAspectCrop(sourceWidth, sourceHeight, A4_PORTRAIT_ASPECT, 0.9),
    buildCenteredAspectCrop(sourceWidth, sourceHeight, A4_PORTRAIT_ASPECT, 0.84),
    buildCenteredAspectCrop(sourceWidth, sourceHeight, normalizedTarget, 0.92),
    buildCenteredAspectCrop(sourceWidth, sourceHeight, normalizedTarget, 0.86),
  ];
  return candidates.sort((left, right) => left.score - right.score)[0];
}

export default function HomeworkScanner({
  visible,
  onClose,
  onScanned,
  title = 'Homework Scanner',
  tier = 'free',
  remainingScans = null,
  userId = null,
}: HomeworkScannerProps) {
  const { theme } = useTheme();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<HomeworkPreview | null>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('back');

  const hasCamera = Platform.OS !== 'web';
  const canCapture = hasCamera && permission?.granted === true;

  const requestCameraAccess = useCallback(async () => {
    if (!hasCamera) return;
    if (permission?.granted) return;
    await requestPermission();
  }, [hasCamera, permission?.granted, requestPermission]);

  const autoCropDocument = useCallback(async (uri: string) => {
    const initial = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 0.94, format: ImageManipulator.SaveFormat.JPEG, base64: false }
    );

    // Step 1: normalize orientation so page-height is dominant.
    const orientationAdjusted = initial.width > initial.height * 1.08
      ? await ImageManipulator.manipulateAsync(
          initial.uri,
          [{ rotate: 90 }],
          { compress: 0.94, format: ImageManipulator.SaveFormat.JPEG, base64: false }
        )
      : initial;

    // Step 2: edge-aware centered crop candidates.
    // NOTE: expo-image-manipulator currently does not provide true perspective
    // correction/deskew APIs, so we optimize for a page-like aspect and coverage.
    const cropCandidate = pickDocumentCrop(orientationAdjusted.width, orientationAdjusted.height);

    const cropped = await ImageManipulator.manipulateAsync(
      orientationAdjusted.uri,
      [{
        crop: {
          originX: cropCandidate.originX,
          originY: cropCandidate.originY,
          width: cropCandidate.width,
          height: cropCandidate.height,
        },
      }],
      { compress: 0.94, format: ImageManipulator.SaveFormat.JPEG, base64: false }
    );

    // Step 3: normalize to OCR-friendly width while preserving detail.
    const targetWidth = Math.min(2000, Math.max(1300, cropped.width));
    const enhanced = await ImageManipulator.manipulateAsync(
      cropped.uri,
      [{ resize: { width: targetWidth } }],
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG, base64: false }
    );

    return {
      uri: enhanced.uri,
      width: enhanced.width,
      height: enhanced.height,
    } as HomeworkPreview;
  }, []);

  const capture = useCallback(async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
      });
      if (!photo?.uri) return;
      const processed = await autoCropDocument(photo.uri);
      setPreview(processed);
    } finally {
      setBusy(false);
    }
  }, [autoCropDocument, busy]);

  const rotatePreview = useCallback(async () => {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const rotated = await ImageManipulator.manipulateAsync(
        preview.uri,
        [{ rotate: 90 }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: false }
      );
      setPreview({
        uri: rotated.uri,
        width: rotated.width,
        height: rotated.height,
      });
    } finally {
      setBusy(false);
    }
  }, [preview, busy]);

  const pickFromLibrary = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        base64: false,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const processed = await autoCropDocument(result.assets[0].uri);
      setPreview(processed);
    } finally {
      setBusy(false);
    }
  }, [autoCropDocument, busy]);

  const submit = useCallback(async () => {
    if (!preview?.uri || busy) return;
    setBusy(true);
    try {
      const budgetAvailable = await hasAutoScanBudget(tier, 1, userId);
      if (!budgetAvailable) {
        const isFreeTier = String(tier || 'free').toLowerCase() === 'free';
        const dailyLimit = isFreeTier ? FREE_AUTO_SCAN_BUDGET_PER_DAY : PAID_AUTO_SCAN_BUDGET_PER_DAY;
        Alert.alert(
          'Daily Scan Limit Reached',
          `You have reached your ${dailyLimit} scans/day limit for Auto-Scanner. Try again tomorrow.`
        );
        return;
      }
      const compressed = await compressImageForAI(preview.uri, 4_000_000);

      onScanned({
        uri: compressed.uri,
        base64: compressed.base64,
        width: compressed.width,
        height: compressed.height,
      });
      setPreview(null);
    } catch (error) {
      console.warn('[upload_oom_guard] Homework scanner compression failed', error);
      Alert.alert('Image Too Large', 'Image too large for analysis/upload, please retake with lower resolution.');
    } finally {
      setBusy(false);
    }
  }, [busy, onScanned, preview, tier, userId]);

  const closeAndReset = useCallback(() => {
    setPreview(null);
    setBusy(false);
    onClose();
  }, [onClose]);

  const overlayHint = useMemo(() => {
    return 'Tip: place worksheet inside the frame. Use good lighting and keep the page flat.';
  }, []);

  const scanLimitHint = useMemo(() => {
    const isFreeTier = String(tier || 'free').toLowerCase() === 'free';
    const dailyLimit = isFreeTier ? FREE_AUTO_SCAN_BUDGET_PER_DAY : PAID_AUTO_SCAN_BUDGET_PER_DAY;
    if (typeof remainingScans === 'number') {
      return `Auto-Scanner: ${remainingScans} of ${dailyLimit} scans left today.`;
    }
    return `Auto-Scanner daily limit: ${dailyLimit} scans.`;
  }, [remainingScans, tier]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={closeAndReset}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={closeAndReset} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <View style={styles.headerBtn} />
        </View>

        {!preview ? (
          <View style={styles.cameraWrap}>
            {canCapture ? (
              <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
                <View style={styles.overlayRoot}>
                  <View style={[styles.scanFrame, { borderColor: theme.primary }]} />
                  <Text style={[styles.overlayText, { color: '#FFFFFF' }]}>{overlayHint}</Text>
                </View>
              </CameraView>
            ) : (
              <View style={[styles.permissionPane, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <Ionicons name="camera-outline" size={30} color={theme.textSecondary} />
                <Text style={[styles.permissionText, { color: theme.textSecondary }]}>
                  Camera permission is required to scan homework.
                </Text>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={requestCameraAccess}>
                  <Text style={styles.primaryBtnText}>Enable Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.previewWrap}>
            <Image source={{ uri: preview.uri }} style={styles.previewImage} resizeMode="contain" />
          </View>
        )}

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Text style={[styles.scanLimitText, { color: theme.textSecondary }]}>{scanLimitHint}</Text>
          {!preview ? (
            <>
              <TouchableOpacity style={[styles.iconBtn, { borderColor: theme.border }]} onPress={pickFromLibrary} disabled={busy}>
                <Ionicons name="images-outline" size={20} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captureBtn, { backgroundColor: theme.primary, opacity: busy ? 0.7 : 1 }]}
                onPress={capture}
                disabled={busy || !canCapture}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="scan" size={24} color="#fff" />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, { borderColor: theme.border }]}
                onPress={() => setFacing((prev) => prev === 'back' ? 'front' : 'back')}
                disabled={busy}
              >
                <Ionicons name="camera-reverse-outline" size={20} color={theme.text} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={[styles.iconBtn, { borderColor: theme.border }]} onPress={() => setPreview(null)} disabled={busy}>
                <Ionicons name="refresh-outline" size={20} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.captureBtn, { backgroundColor: theme.primary }]} onPress={submit} disabled={busy}>
                <Ionicons name="checkmark" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { borderColor: theme.border }]} onPress={rotatePreview} disabled={busy}>
                <Ionicons name="reload-outline" size={20} color={theme.text} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  cameraWrap: {
    flex: 1,
    padding: 12,
  },
  camera: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  overlayRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.16)',
    paddingHorizontal: 14,
  },
  scanFrame: {
    width: '88%',
    height: '68%',
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  overlayText: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  permissionPane: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 12,
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 8,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  previewWrap: {
    flex: 1,
    padding: 12,
  },
  previewImage: {
    flex: 1,
    borderRadius: 14,
  },
  footer: {
    minHeight: 82,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scanLimitText: {
    position: 'absolute',
    top: -20,
    left: 24,
    fontSize: 11,
    fontWeight: '600',
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
