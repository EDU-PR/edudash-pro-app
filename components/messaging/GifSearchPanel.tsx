/**
 * GifSearchPanel
 *
 * Full-screen modal GIF search panel. When activated (via the GIF tab in the
 * emoji picker) this opens as a page-sheet modal with search, 3-column grid,
 * pagination and GIPHY attribution.
 *
 * Falls back to static category cards when no GIPHY API key is configured.
 *
 * Rating is locked to "g" (general audiences) for school safety.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import { toast } from '@/components/ui/ToastProvider';

const GIPHY_API_KEY =
  (typeof process !== 'undefined' &&
    (process.env as Record<string, string | undefined>)
      .EXPO_PUBLIC_GIPHY_API_KEY) ||
  '';
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';
const GIF_COLUMNS = 3;
const PAGE_SIZE = 30;

interface GiphyGif {
  id: string;
  url: string;
  preview: string;
}

interface GifSearchPanelProps {
  onSelectGif: (url: string) => void;
  visible: boolean;
  onClose: () => void;
  theme: {
    text: string;
    textSecondary: string;
    surface: string;
    elevated: string;
    border: string;
    primary: string;
  };
}

const FALLBACK_CATEGORIES = [
  { label: 'Reactions', emoji: '😂' },
  { label: 'Thank You', emoji: '🙏' },
  { label: 'Congratulations', emoji: '🎉' },
  { label: 'Good Morning', emoji: '☀️' },
  { label: 'Funny', emoji: '🤣' },
  { label: 'Love', emoji: '❤️' },
];

export const GifSearchPanel: React.FC<GifSearchPanelProps> = React.memo(
  ({ onSelectGif, visible, onClose, theme }) => {
    const [query, setQuery] = useState('');
    const [gifs, setGifs] = useState<GiphyGif[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchInputRef = useRef<TextInput>(null);
    const hasApiKey = !!GIPHY_API_KEY;

    const fetchGifs = useCallback(
      async (searchTerm: string, pageOffset = 0) => {
        if (!GIPHY_API_KEY) return;
        if (pageOffset === 0) setLoading(true);
        else setLoadingMore(true);

        try {
          const endpoint = searchTerm.trim()
            ? `${GIPHY_BASE}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=${PAGE_SIZE}&offset=${pageOffset}&rating=g`
            : `${GIPHY_BASE}/trending?api_key=${GIPHY_API_KEY}&limit=${PAGE_SIZE}&offset=${pageOffset}&rating=g`;

          const res = await fetch(endpoint);
          if (!res.ok) throw new Error(`GIPHY ${res.status}`);
          const json = await res.json();

          const mapped: GiphyGif[] = (json.data || []).map(
            (r: any) => ({
              id: r.id,
              url: r.images?.original?.url || '',
              preview: r.images?.fixed_width?.url || r.images?.original?.url || '',
            }),
          );
          const filtered = mapped.filter((g) => g.url);
          setHasMore(filtered.length >= PAGE_SIZE);
          if (pageOffset === 0) {
            setGifs(filtered);
          } else {
            setGifs((prev) => [...prev, ...filtered]);
          }
          setOffset(pageOffset + filtered.length);
        } catch (err) {
          console.warn('[GifSearchPanel] GIPHY fetch error:', err);
          if (pageOffset === 0) setGifs([]);
        } finally {
          setLoading(false);
          setLoadingMore(false);
        }
      },
      [],
    );

    useEffect(() => {
      if (visible && hasApiKey) {
        setQuery('');
        setGifs([]);
        setOffset(0);
        setHasMore(true);
        fetchGifs('', 0);
        setTimeout(() => searchInputRef.current?.focus(), 300);
      }
    }, [visible, hasApiKey, fetchGifs]);

    const handleSearchChange = useCallback(
      (text: string) => {
        setQuery(text);
        if (!hasApiKey) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          setOffset(0);
          setHasMore(true);
          fetchGifs(text, 0);
        }, 400);
      },
      [hasApiKey, fetchGifs],
    );

    const handleEndReached = useCallback(() => {
      if (!loadingMore && hasMore && hasApiKey) {
        fetchGifs(query, offset);
      }
    }, [loadingMore, hasMore, hasApiKey, query, offset, fetchGifs]);

    const openGalleryPicker = useCallback(async () => {
      try {
        const hasPermission = await ensureImageLibraryPermission();
        if (!hasPermission) {
          toast.warn('Please grant gallery access to pick GIFs.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 1,
          allowsEditing: false,
        });
        if (!result.canceled && result.assets.length > 0) {
          onClose();
          onSelectGif(result.assets[0].uri);
        }
      } catch (error) {
        console.error('[GifSearchPanel] Gallery pick error:', error);
        toast.error('Failed to pick image.');
      }
    }, [onSelectGif, onClose]);

    const handleSelectGif = useCallback(
      (url: string) => {
        onClose();
        onSelectGif(url);
      },
      [onClose, onSelectGif],
    );

    const { width: screenWidth } = Dimensions.get('window');
    const cellSize = (screenWidth - 24) / GIF_COLUMNS;

    const renderGifItem = useCallback(
      ({ item }: { item: GiphyGif }) => (
        <TouchableOpacity
          style={[dynamicStyles.gifCell(cellSize), { backgroundColor: theme.elevated }]}
          onPress={() => handleSelectGif(item.url)}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: item.preview }}
            style={styles.gifImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ),
      [handleSelectGif, theme.elevated, cellSize],
    );

    const renderFooter = useCallback(() => {
      if (!loadingMore) return null;
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator color={theme.primary} size="small" />
        </View>
      );
    }, [loadingMore, theme.primary]);

    const renderContent = () => {
      if (!hasApiKey) {
        return (
          <View style={styles.fallbackContainer}>
            <Text style={[styles.fallbackNote, { color: theme.textSecondary }]}>
              Full GIF search coming soon
            </Text>
            <View style={styles.categoryGrid}>
              {FALLBACK_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.label}
                  style={[
                    dynamicStyles.categoryCard(screenWidth),
                    { backgroundColor: theme.elevated },
                  ]}
                  onPress={openGalleryPicker}
                  activeOpacity={0.7}
                >
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <Text
                    style={[styles.categoryLabel, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.galleryBtn, { borderColor: theme.border }]}
              onPress={openGalleryPicker}
              activeOpacity={0.7}
            >
              <Ionicons name="images-outline" size={18} color={theme.primary} />
              <Text style={[styles.galleryBtnText, { color: theme.primary }]}>
                Pick from Gallery
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={styles.apiContent}>
          <View style={[styles.searchBar, { backgroundColor: theme.elevated }]}>
            <Ionicons name="search" size={16} color={theme.textSecondary} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search GIFs..."
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={handleSearchChange}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setQuery('');
                  setOffset(0);
                  setHasMore(true);
                  fetchGifs('', 0);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {loading && gifs.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : gifs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {query ? 'No GIFs found' : 'Loading trending GIFs...'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={gifs}
              renderItem={renderGifItem}
              keyExtractor={(item) => item.id}
              numColumns={GIF_COLUMNS}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.gifGrid}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderFooter}
            />
          )}
        </View>
      );
    };

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={onClose}
        transparent={false}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>GIF</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {renderContent()}

          {/* Attribution */}
          <View style={[styles.attribution, { borderTopColor: theme.border }]}>
            <Text style={[styles.poweredBy, { color: theme.textSecondary }]}>
              Powered by GIPHY
            </Text>
          </View>
        </View>
      </Modal>
    );
  },
);

const dynamicStyles = {
  gifCell: (cellSize: number) => ({
    width: cellSize,
    height: cellSize,
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden' as const,
  }),
  categoryCard: (screenWidth: number) => ({
    width: (screenWidth - 56) / 3,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  }),
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    backgroundColor: '#0f172a',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  apiContent: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 2,
  },
  gifGrid: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  attribution: {
    paddingVertical: 8,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  poweredBy: {
    fontSize: 11,
    fontWeight: '500',
  },
  fallbackContainer: {
    flex: 1,
    padding: 12,
  },
  fallbackNote: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  categoryEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  galleryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
