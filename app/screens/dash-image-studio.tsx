import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import {
  DashImageGenerationError,
  generateDashImage,
  type DashGeneratedImage,
  type ImageCostMode,
} from '@/lib/services/dashImageService';
import { track } from '@/lib/analytics';
import { getFeatureFlagsSync } from '@/lib/featureFlags';

type ImageSize = '1024x1024' | '1536x1024' | '1024x1536';
type ImageStyle = 'natural' | 'vivid';
type ImageQuality = 'low' | 'medium' | 'high';
type CostModeLabel = {
  id: ImageCostMode;
  label: string;
};

const SIZE_OPTIONS: ImageSize[] = ['1024x1024', '1536x1024', '1024x1536'];
const STYLE_OPTIONS: ImageStyle[] = ['vivid', 'natural'];
const QUALITY_OPTIONS: ImageQuality[] = ['medium', 'high', 'low'];
const COST_MODE_OPTIONS: CostModeLabel[] = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'eco', label: 'Eco' },
  { id: 'premium', label: 'Premium' },
];

const getScopeFromRole = (role?: string | null) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'teacher') return 'teacher';
  if (normalized === 'principal' || normalized === 'principal_admin') return 'principal';
  if (normalized === 'student' || normalized === 'learner') return 'student';
  if (normalized === 'admin' || normalized === 'superadmin' || normalized === 'super_admin') return 'admin';
  return 'parent';
};

const formatTimestamp = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
};

export default function DashImageStudioScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { showAlert, alertProps } = useAlertModal();
  const flags = getFeatureFlagsSync();

  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<ImageSize>('1024x1024');
  const [style, setStyle] = useState<ImageStyle>('vivid');
  const [quality, setQuality] = useState<ImageQuality>('medium');
  const [costMode, setCostMode] = useState<ImageCostMode>('balanced');
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<DashGeneratedImage[]>([]);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const [sharingImageId, setSharingImageId] = useState<string | null>(null);
  const [savingImageId, setSavingImageId] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(theme, insets.bottom), [theme, insets.bottom]);
  const role = String(profile?.role || 'parent').toLowerCase();

  const getImageFileName = (image: DashGeneratedImage) => {
    const mime = String(image.mime_type || '').toLowerCase();
    const extension = mime.includes('png') ? 'png' : 'jpg';
    return `dash-image-${image.id}.${extension}`;
  };

  const handleUseInDashChat = (image: DashGeneratedImage) => {
    const promptForDash = [
      'Use this generated image in my next activity/worksheet.',
      `Image URL: ${image.signed_url}`,
      `Original prompt: ${image.prompt}`,
    ].join('\n');

    router.push({
      pathname: '/screens/dash-assistant',
      params: {
        initialMessage: promptForDash,
        source: 'dash_image_studio',
      },
    } as any);
  };

  const handleShareImage = async (image: DashGeneratedImage) => {
    try {
      setSharingImageId(image.id);
      await Share.share({
        message: `Dash generated image: ${image.prompt}\n${image.signed_url}`,
        url: image.signed_url,
      });
      track('dash.image_generation.share', {
        role,
        image_id: image.id,
      });
    } catch (error) {
      showAlert({
        title: 'Share failed',
        message: 'Could not open sharing options for this image.',
        type: 'error',
      });
    } finally {
      setSharingImageId(null);
    }
  };

  const handleSaveImage = async (image: DashGeneratedImage) => {
    try {
      setSavingImageId(image.id);
      const canShareFile = await Sharing.isAvailableAsync();
      if (!canShareFile) {
        showAlert({
          title: 'Save not available',
          message: 'Saving/sharing files is not available on this device.',
          type: 'warning',
        });
        return;
      }

      const fileName = getImageFileName(image);
      const localUri = `${FileSystem.cacheDirectory}${fileName}`;
      const downloadResult = await FileSystem.downloadAsync(image.signed_url, localUri);

      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: image.mime_type || 'image/jpeg',
        dialogTitle: 'Save or share image',
      });

      track('dash.image_generation.save', {
        role,
        image_id: image.id,
      });
    } catch (error) {
      showAlert({
        title: 'Save failed',
        message: 'Could not save this image. Try again before the signed link expires.',
        type: 'error',
      });
    } finally {
      setSavingImageId(null);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showAlert({
        title: 'Prompt required',
        message: 'Describe the image you want Dash to generate.',
        type: 'warning',
      });
      return;
    }

    setGenerating(true);
    setQuotaMessage(null);
    try {
      const result = await generateDashImage({
        prompt,
        size,
        style,
        quality,
        costMode,
        providerPreference: 'auto',
        scope: getScopeFromRole(role),
      });
      setImages((prev) => [...result.generatedImages, ...prev]);
      track('dash.image_generation.success', {
        role,
        size,
        style,
        quality,
        cost_mode: costMode,
        provider: result.provider || 'unknown',
        fallback_used: Boolean(result.fallbackUsed),
        count: result.generatedImages.length,
      });
    } catch (error) {
      const typed = error as DashImageGenerationError;
      const message = typed?.message || 'Dash could not generate an image right now.';
      if (typed?.code === 'quota_exceeded') {
        setQuotaMessage(message);
      }
      showAlert({
        title: typed?.code === 'quota_exceeded' ? 'Image limit reached' : 'Image generation failed',
        message,
        type: typed?.code === 'quota_exceeded' ? 'warning' : 'error',
      });
      track('dash.image_generation.failed', {
        role,
        code: typed?.code || 'unknown',
        cost_mode: costMode,
      });
    } finally {
      setGenerating(false);
    }
  };

  if (!flags.ENABLE_DASH_IMAGE_GEN) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <Ionicons name="image-outline" size={36} color={theme.textSecondary} />
          <Text style={styles.lockedTitle}>Image Studio is disabled</Text>
          <Text style={styles.lockedText}>
            This feature is currently turned off for your environment.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Dash Image Studio</Text>
            <Text style={styles.subtitle}>Create lesson visuals and parent-ready learning cards.</Text>
          </View>
        </View>

        {quotaMessage && (
          <View style={styles.quotaBanner}>
            <Ionicons name="lock-closed-outline" size={16} color="#F59E0B" />
            <Text style={styles.quotaBannerText}>{quotaMessage}</Text>
          </View>
        )}

        <View style={styles.editorCard}>
          <Text style={styles.label}>Prompt</Text>
          <TextInput
            style={styles.promptInput}
            multiline
            placeholder="Example: A friendly classroom poster showing farm animals for counting practice."
            placeholderTextColor={theme.textSecondary}
            value={prompt}
            onChangeText={setPrompt}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Size</Text>
          <View style={styles.chipRow}>
            {SIZE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setSize(option)}
                style={[styles.chip, size === option && styles.chipActive]}
              >
                <Text style={[styles.chipText, size === option && styles.chipTextActive]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Style</Text>
          <View style={styles.chipRow}>
            {STYLE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setStyle(option)}
                style={[styles.chip, style === option && styles.chipActive]}
              >
                <Text style={[styles.chipText, style === option && styles.chipTextActive]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Quality</Text>
          <View style={styles.chipRow}>
            {QUALITY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setQuality(option)}
                style={[styles.chip, quality === option && styles.chipActive]}
              >
                <Text style={[styles.chipText, quality === option && styles.chipTextActive]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Cost Mode</Text>
          <View style={styles.chipRow}>
            {COST_MODE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => setCostMode(option.id)}
                style={[styles.chip, costMode === option.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, costMode === option.id && styles.chipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.generateButton, generating && styles.generateButtonDisabled]}
            onPress={handleGenerate}
            disabled={generating}
          >
            <Ionicons name={generating ? 'hourglass-outline' : 'sparkles'} size={18} color="#fff" />
            <Text style={styles.generateText}>{generating ? 'Generating...' : 'Generate Image'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultsSection}>
          <Text style={styles.resultsTitle}>Generated Images</Text>
          {images.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={20} color={theme.textSecondary} />
              <Text style={styles.emptyText}>No images yet. Start with a prompt above.</Text>
            </View>
          ) : (
            images.map((image) => (
              <View key={image.id} style={styles.imageCard}>
                <Image source={{ uri: image.signed_url }} style={styles.imagePreview} />
                <Text style={styles.imageMeta}>
                  {image.width}x{image.height} · {String(image.provider || 'openai').toUpperCase()} · {image.model}
                </Text>
                <Text style={styles.imageTime}>Expires: {formatTimestamp(image.expires_at)}</Text>
                <Text style={styles.imageHint}>Signed link expires. Save or share to keep a copy.</Text>
                <View style={styles.imageActionRow}>
                  <TouchableOpacity
                    style={styles.imageActionButton}
                    onPress={() => handleUseInDashChat(image)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={theme.primary} />
                    <Text style={styles.imageActionText}>Use in Dash</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.imageActionButton}
                    onPress={() => handleShareImage(image)}
                    activeOpacity={0.75}
                    disabled={sharingImageId === image.id || savingImageId === image.id}
                  >
                    <Ionicons name="share-social-outline" size={15} color={theme.primary} />
                    <Text style={styles.imageActionText}>
                      {sharingImageId === image.id ? 'Sharing...' : 'Share'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.imageActionButton}
                    onPress={() => handleSaveImage(image)}
                    activeOpacity={0.75}
                    disabled={sharingImageId === image.id || savingImageId === image.id}
                  >
                    <Ionicons name="download-outline" size={15} color={theme.primary} />
                    <Text style={styles.imageActionText}>
                      {savingImageId === image.id ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}

const createStyles = (theme: any, bottomInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: bottomInset + 24,
      gap: 16,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      gap: 10,
    },
    lockedTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    lockedText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      color: theme.textSecondary,
    },
    backButton: {
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.primary,
    },
    backButtonText: {
      color: '#fff',
      fontWeight: '700',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerCopy: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.text,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    quotaBanner: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#F59E0B66',
      backgroundColor: '#F59E0B18',
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    quotaBannerText: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
    },
    editorCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 10,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    promptInput: {
      minHeight: 110,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      backgroundColor: theme.background,
      fontSize: 15,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.background,
    },
    chipActive: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}20`,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    chipTextActive: {
      color: theme.primary,
    },
    generateButton: {
      marginTop: 4,
      borderRadius: 14,
      backgroundColor: theme.primary,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    generateButtonDisabled: {
      opacity: 0.55,
    },
    generateText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    resultsSection: {
      gap: 10,
    },
    resultsTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    emptyState: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingVertical: 18,
      paddingHorizontal: 14,
      alignItems: 'center',
      gap: 6,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 13,
    },
    imageCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      overflow: 'hidden',
    },
    imagePreview: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: theme.background,
    },
    imageMeta: {
      fontSize: 12,
      color: theme.text,
      fontWeight: '700',
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    imageTime: {
      fontSize: 12,
      color: theme.textSecondary,
      paddingHorizontal: 12,
      paddingBottom: 4,
      paddingTop: 2,
    },
    imageHint: {
      fontSize: 11,
      color: theme.textSecondary,
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    imageActionRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 10,
    },
    imageActionButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      backgroundColor: theme.background,
    },
    imageActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
    },
  });
