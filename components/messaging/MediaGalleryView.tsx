/**
 * MediaGalleryView — grid view of shared images, voice messages, and files
 * for a specific thread.
 *
 * Activated via "Media, Links & Docs" in thread options.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { useBottomInset } from '@/hooks/useBottomInset';

type MediaType = 'image' | 'voice' | 'file';

interface MediaItem {
  id: string;
  content: string;
  content_type: MediaType;
  voice_url?: string | null;
  voice_duration?: number | null;
  created_at: string;
  sender?: {
    first_name: string;
    last_name: string;
  };
}

interface MediaGalleryViewProps {
  visible: boolean;
  threadId: string;
  onClose: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = (SCREEN_WIDTH - 48) / 3;

export function MediaGalleryView({
  visible,
  threadId,
  onClose,
}: MediaGalleryViewProps) {
  const bottomInset = useBottomInset();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<MediaType>('image');

  useEffect(() => {
    if (visible) {
      loadMedia();
    }
  }, [visible, threadId]);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const supabase = assertSupabase();

      const { data, error } = await supabase
        .from('messages')
        .select(
          `id, content, content_type, voice_url, voice_duration, created_at,
           sender:users!messages_sender_id_fkey(first_name, last_name)`
        )
        .eq('thread_id', threadId)
        .is('deleted_at', null)
        .in('content_type', ['image', 'voice', 'file'])
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setItems((data as any[]) || []);
    } catch (err) {
      logger.error('MediaGallery', 'Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = items.filter((i) => i.content_type === activeTab);

  const renderImageItem = ({ item }: { item: MediaItem }) => (
    <TouchableOpacity
      style={styles.imageItem}
      onPress={() => {
        // Could open a full-screen image viewer
        if (item.content) {
          Linking.openURL(item.content).catch(() => {});
        }
      }}
    >
      <Image
        source={{ uri: item.content }}
        style={styles.imageThumb}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  const renderVoiceItem = ({ item }: { item: MediaItem }) => (
    <TouchableOpacity style={styles.listItem}>
      <View style={styles.voiceIcon}>
        <Ionicons name="mic" size={20} color="#6366f1" />
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listTitle}>
          {item.sender
            ? `${item.sender.first_name} ${item.sender.last_name}`
            : 'Voice Message'}
        </Text>
        <Text style={styles.listSub}>
          {item.voice_duration
            ? `${Math.ceil(item.voice_duration)}s`
            : 'Audio'}{' '}
          · {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderFileItem = ({ item }: { item: MediaItem }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => {
        if (item.content) Linking.openURL(item.content).catch(() => {});
      }}
    >
      <View style={styles.fileIcon}>
        <Ionicons name="document-text" size={20} color="#f59e0b" />
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listTitle} numberOfLines={1}>
          {item.content?.split('/').pop() || 'File'}
        </Text>
        <Text style={styles.listSub}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Ionicons name="download-outline" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  const renderItem = useCallback(
    (info: { item: MediaItem }) => {
      switch (activeTab) {
        case 'image':
          return renderImageItem(info);
        case 'voice':
          return renderVoiceItem(info);
        case 'file':
          return renderFileItem(info);
      }
    },
    [activeTab]
  );

  const tabs: { key: MediaType; label: string; icon: string }[] = [
    { key: 'image', label: 'Photos', icon: 'images' },
    { key: 'voice', label: 'Audio', icon: 'mic' },
    { key: 'file', label: 'Files', icon: 'document' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Media, Links & Docs</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {tabs.map((tab) => {
              const count = items.filter(
                (i) => i.content_type === tab.key
              ).length;
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={16}
                    color={isActive ? '#6366f1' : '#9ca3af'}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      isActive && styles.tabTextActive,
                    ]}
                  >
                    {tab.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Content */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#6366f1"
              style={{ marginTop: 40 }}
            />
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>
                No {tabs.find((t) => t.key === activeTab)?.label.toLowerCase()} shared yet
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              numColumns={activeTab === 'image' ? 3 : 1}
              key={activeTab} // force re-layout on tab switch
              contentContainerStyle={
                activeTab === 'image'
                  ? [styles.grid, { paddingBottom: bottomInset + 20 }]
                  : [styles.list, { paddingBottom: bottomInset + 20 }]
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  tabActive: {
    backgroundColor: '#eef2ff',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9ca3af',
  },
  tabTextActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 30,
  },
  list: {
    paddingBottom: 30,
  },
  imageItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  imageThumb: {
    width: '100%',
    height: '100%',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  voiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listInfo: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  listSub: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 15,
  },
});

export default MediaGalleryView;
