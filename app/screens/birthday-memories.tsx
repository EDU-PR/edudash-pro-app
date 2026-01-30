import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, FlatList, Modal } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { BirthdayMemoriesService } from '@/features/birthday-memories/services/BirthdayMemoriesService';
import type { BirthdayMemoryEvent, BirthdayMemoryMedia } from '@/features/birthday-memories/types/birthdayMemories.types';
import { BirthdayMontageService } from '@/features/birthday-memories/services/BirthdayMontageService';

export default function BirthdayMemoriesScreen() {
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const organizationId = typeof params.organizationId === 'string' ? params.organizationId : null;
  const birthdayStudentId = typeof params.birthdayStudentId === 'string' ? params.birthdayStudentId : null;
  const eventDate = typeof params.eventDate === 'string' ? params.eventDate : null;

  const [event, setEvent] = useState<BirthdayMemoryEvent | null>(null);
  const [media, setMedia] = useState<BirthdayMemoryMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const canUpload = ['teacher', 'principal', 'admin', 'super_admin', 'principal_admin'].includes(String(profile?.role || ''));
  const isParent = ['parent', 'guardian', 'sponsor'].includes(String(profile?.role || ''));

  const loadEvent = useCallback(async () => {
    if (!birthdayStudentId || !eventDate) return;
    const created = await BirthdayMemoriesService.getOrCreateEvent({
      birthdayStudentId,
      eventDate,
    });
    setEvent(created);
  }, [birthdayStudentId, eventDate]);

  const loadMedia = useCallback(async () => {
    if (!event?.id) return;
    const items = await BirthdayMemoriesService.listMedia(event.id);
    setMedia(items);
  }, [event?.id]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!birthdayStudentId || !eventDate) {
        setLoading(false);
        return;
      }
      await loadEvent();
      if (mounted) {
        setLoading(false);
      }
    };
    void init();
    return () => {
      mounted = false;
    };
  }, [birthdayStudentId, eventDate, loadEvent]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const handlePick = useCallback(async () => {
    if (!event?.id || !organizationId) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow access to your media library to upload memories.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.9,
    });

    if (result.canceled) return;

    setUploading(true);
    try {
      for (const asset of result.assets) {
        const mediaType = asset.type === 'video' ? 'video' : 'image';
        await BirthdayMemoriesService.uploadMedia({
          eventId: event.id,
          organizationId,
          mediaType,
          fileUri: asset.uri,
          fileName: asset.fileName || undefined,
        });
      }
      await loadMedia();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unable to upload media');
    } finally {
      setUploading(false);
    }
  }, [event?.id, organizationId, loadMedia]);

  const handleView = useCallback(async (item: BirthdayMemoryMedia) => {
    const url = await BirthdayMemoriesService.getViewUrl(item.id);
    if (!url) {
      Alert.alert('Unable to open media');
      return;
    }
    if (item.mediaType === 'image') {
      setPreviewUrl(url);
      setPreviewVisible(true);
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  }, []);

  const handleDownload = useCallback(async (item: BirthdayMemoryMedia) => {
    const url = await BirthdayMemoriesService.getDownloadUrl(item.id);
    if (!url) {
      Alert.alert('Download unavailable', 'Only parents of the birthday child can download.');
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  }, []);

  const handleGenerateMontage = useCallback(async () => {
    if (!event?.id) return;
    const job = await BirthdayMontageService.queue(event.id);
    if (!job) {
      Alert.alert('Unable to queue montage');
      return;
    }
    Alert.alert(
      'Montage queued',
      'We are preparing the highlight video. Parents will be notified when it is ready.'
    );
  }, [event?.id]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Birthday Memories' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.muted}>Loading memories...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Birthday memories</Text>
          <Text style={styles.subtitle}>School-wide memories for this celebration.</Text>

          {canUpload && (
            <TouchableOpacity style={styles.uploadButton} onPress={handlePick} disabled={uploading}>
              <Text style={styles.uploadButtonText}>
                {uploading ? 'Uploading...' : 'Upload photos / videos'}
              </Text>
            </TouchableOpacity>
          )}

          {canUpload && (
            <TouchableOpacity style={styles.secondaryButtonWide} onPress={handleGenerateMontage}>
              <Text style={styles.secondaryButtonWideText}>Generate highlight video (optional)</Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={media}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.muted}>No memories yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.gridCard}>
                {item.mediaType === 'image' && (
                  <Image
                    source={{ uri: item.previewPath || item.storagePath }}
                    style={styles.thumbnail}
                    contentFit="cover"
                  />
                )}
                {item.mediaType === 'video' && (
                  <View style={styles.videoPlaceholder}>
                    <Text style={styles.videoBadge}>Video</Text>
                  </View>
                )}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => handleView(item)}>
                    <Text style={styles.secondaryButtonText}>View</Text>
                  </TouchableOpacity>
                  {isParent && (
                    <TouchableOpacity style={styles.primaryButton} onPress={() => handleDownload(item)}>
                      <Text style={styles.primaryButtonText}>Download</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          />

          <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
            <View style={styles.previewBackdrop}>
              <View style={styles.previewCard}>
                {previewUrl && (
                  <Image source={{ uri: previewUrl }} style={styles.previewImage} contentFit="contain" />
                )}
                <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewVisible(false)}>
                  <Text style={styles.previewCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  subtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  uploadButton: {
    backgroundColor: theme.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  list: {
    gap: 12,
  },
  gridRow: {
    gap: 12,
  },
  gridCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 10,
  },
  thumbnail: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    backgroundColor: theme.background,
    marginBottom: 8,
  },
  videoPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  videoBadge: {
    color: theme.text,
    fontWeight: '700',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
  },
  previewImage: {
    width: '100%',
    height: 320,
    borderRadius: 10,
    backgroundColor: theme.background,
  },
  previewClose: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.primary,
  },
  previewCloseText: {
    color: '#fff',
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonWide: {
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryButtonWideText: {
    color: theme.text,
    fontWeight: '600',
    fontSize: 12,
  },
  primaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.primary,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryButtonText: {
    color: theme.text,
    fontWeight: '600',
    fontSize: 12,
  },
  muted: {
    fontSize: 12,
    color: theme.textSecondary,
  },
});
