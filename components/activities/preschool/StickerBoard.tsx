/**
 * Sticker Board Component for Preschoolers
 * 
 * Interactive sticker board where children can place stickers
 * on a scene - great for creativity and fine motor skills.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

// ====================================================================
// TYPES
// ====================================================================

interface Sticker {
  id: string;
  emoji: string;
  name: string;
  category: string;
}

interface PlacedSticker {
  id: string;
  stickerId: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

interface StickerBoardProps {
  /** Title shown at top */
  title?: string;
  /** Background scene */
  backgroundUrl?: string;
  /** Background color if no image */
  backgroundColor?: string;
  /** Available stickers */
  stickers?: Sticker[];
  /** Called when board is saved */
  onSave?: (placedStickers: PlacedSticker[]) => void;
  /** Called when user exits */
  onExit?: () => void;
}

// ====================================================================
// DEFAULT STICKERS
// ====================================================================

const DEFAULT_STICKERS: Sticker[] = [
  // Animals
  { id: 'cat', emoji: '🐱', name: 'Cat', category: 'animals' },
  { id: 'dog', emoji: '🐕', name: 'Dog', category: 'animals' },
  { id: 'bunny', emoji: '🐰', name: 'Bunny', category: 'animals' },
  { id: 'bear', emoji: '🐻', name: 'Bear', category: 'animals' },
  { id: 'bird', emoji: '🐦', name: 'Bird', category: 'animals' },
  { id: 'butterfly', emoji: '🦋', name: 'Butterfly', category: 'animals' },
  // Nature
  { id: 'sun', emoji: '☀️', name: 'Sun', category: 'nature' },
  { id: 'cloud', emoji: '☁️', name: 'Cloud', category: 'nature' },
  { id: 'rainbow', emoji: '🌈', name: 'Rainbow', category: 'nature' },
  { id: 'flower', emoji: '🌸', name: 'Flower', category: 'nature' },
  { id: 'tree', emoji: '🌳', name: 'Tree', category: 'nature' },
  { id: 'star', emoji: '⭐', name: 'Star', category: 'nature' },
  // Objects
  { id: 'heart', emoji: '❤️', name: 'Heart', category: 'objects' },
  { id: 'balloon', emoji: '🎈', name: 'Balloon', category: 'objects' },
  { id: 'house', emoji: '🏠', name: 'House', category: 'objects' },
  { id: 'car', emoji: '🚗', name: 'Car', category: 'objects' },
  // Food
  { id: 'apple', emoji: '🍎', name: 'Apple', category: 'food' },
  { id: 'cookie', emoji: '🍪', name: 'Cookie', category: 'food' },
  { id: 'icecream', emoji: '🍦', name: 'Ice Cream', category: 'food' },
  { id: 'cake', emoji: '🎂', name: 'Cake', category: 'food' },
];

const CATEGORIES = ['animals', 'nature', 'objects', 'food'];

// ====================================================================
// COMPONENT
// ====================================================================

export function StickerBoard({
  title = 'Sticker Fun!',
  backgroundUrl,
  backgroundColor = '#E8F5E9',
  stickers = DEFAULT_STICKERS,
  onSave,
  onExit,
}: StickerBoardProps) {
  const { colors, isDark } = useTheme();
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [editingSticker, setEditingSticker] = useState<string | null>(null);
  const placedIdRef = React.useRef(0);

  const handleBoardPress = useCallback((event: GestureResponderEvent) => {
    if (!selectedSticker) return;
    
    const { locationX, locationY } = event.nativeEvent;
    
    const newPlaced: PlacedSticker = {
      id: `placed-${placedIdRef.current++}`,
      stickerId: selectedSticker.id,
      emoji: selectedSticker.emoji,
      x: locationX,
      y: locationY,
      scale: 1,
      rotation: 0,
    };

    setPlacedStickers(prev => [...prev, newPlaced]);
  }, [selectedSticker]);

  const handleStickerSelect = useCallback((sticker: Sticker) => {
    setSelectedSticker(sticker);
    setEditingSticker(null);
  }, []);

  const handlePlacedStickerPress = useCallback((stickerId: string) => {
    setEditingSticker(stickerId);
    setSelectedSticker(null);
  }, []);

  const handleDeleteSticker = useCallback(() => {
    if (!editingSticker) return;
    setPlacedStickers(prev => prev.filter(s => s.id !== editingSticker));
    setEditingSticker(null);
  }, [editingSticker]);

  const handleScaleSticker = useCallback((direction: 'up' | 'down') => {
    if (!editingSticker) return;
    setPlacedStickers(prev => prev.map(s => {
      if (s.id === editingSticker) {
        const newScale = direction === 'up' 
          ? Math.min(s.scale + 0.3, 2.5) 
          : Math.max(s.scale - 0.3, 0.5);
        return { ...s, scale: newScale };
      }
      return s;
    }));
  }, [editingSticker]);

  const handleUndo = useCallback(() => {
    setPlacedStickers(prev => prev.slice(0, -1));
  }, []);

  const handleSave = useCallback(() => {
    onSave?.(placedStickers);
  }, [placedStickers, onSave]);

  const filteredStickers = stickers.filter(s => s.category === selectedCategory);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
        <TouchableOpacity onPress={onExit} style={styles.headerButton}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <Ionicons name="checkmark" size={28} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* Board */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleBoardPress}
        style={[
          styles.board,
          { backgroundColor },
          selectedSticker && styles.boardActive,
        ]}
      >
        {backgroundUrl && (
          <Image source={{ uri: backgroundUrl }} style={styles.backgroundImage} />
        )}
        
        {placedStickers.map(placed => (
          <TouchableOpacity
            key={placed.id}
            onPress={() => handlePlacedStickerPress(placed.id)}
            style={[
              styles.placedSticker,
              {
                left: placed.x - 25 * placed.scale,
                top: placed.y - 25 * placed.scale,
                transform: [
                  { scale: placed.scale },
                  { rotate: `${placed.rotation}deg` },
                ],
              },
              editingSticker === placed.id && styles.editingSticker,
            ]}
          >
            <Text style={styles.placedStickerEmoji}>{placed.emoji}</Text>
          </TouchableOpacity>
        ))}

        {selectedSticker && (
          <View style={styles.placementHint}>
            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
              Tap anywhere to place {selectedSticker.emoji}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Edit Controls (when editing) */}
      {editingSticker && (
        <View style={[styles.editControls, { backgroundColor: colors.cardBackground }]}>
          <TouchableOpacity 
            onPress={() => handleScaleSticker('down')}
            style={[styles.editButton, { backgroundColor: colors.border }]}
          >
            <Ionicons name="remove" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => handleScaleSticker('up')}
            style={[styles.editButton, { backgroundColor: colors.border }]}
          >
            <Ionicons name="add" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleDeleteSticker}
            style={[styles.editButton, { backgroundColor: '#FF5252' }]}
          >
            <Ionicons name="trash" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setEditingSticker(null)}
            style={[styles.editButton, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="checkmark" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Sticker Tray */}
      <View style={[styles.trayContainer, { backgroundColor: colors.cardBackground }]}>
        {/* Category Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoryTabs}
          contentContainerStyle={styles.categoryTabsContent}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.categoryTab,
                { borderColor: colors.border },
                selectedCategory === cat && { 
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text style={[
                styles.categoryTabText,
                { color: selectedCategory === cat ? '#fff' : colors.text },
              ]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stickers */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.stickerScroll}
          contentContainerStyle={styles.stickerScrollContent}
        >
          {filteredStickers.map(sticker => (
            <TouchableOpacity
              key={sticker.id}
              onPress={() => handleStickerSelect(sticker)}
              style={[
                styles.stickerItem,
                { borderColor: colors.border },
                selectedSticker?.id === sticker.id && {
                  borderColor: colors.primary,
                  backgroundColor: `${colors.primary}20`,
                },
              ]}
            >
              <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Undo Button */}
        <TouchableOpacity
          onPress={handleUndo}
          disabled={placedStickers.length === 0}
          style={[
            styles.undoButton,
            { backgroundColor: colors.border },
            placedStickers.length === 0 && { opacity: 0.5 },
          ]}
        >
          <Ionicons name="arrow-undo" size={20} color={colors.text} />
          <Text style={[styles.undoText, { color: colors.text }]}>Undo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ====================================================================
// STYLES
// ====================================================================

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  board: {
    flex: 1,
    margin: 8,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  boardActive: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  placedSticker: {
    position: 'absolute',
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placedStickerEmoji: {
    fontSize: 40,
  },
  editingSticker: {
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 25,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  placementHint: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  editControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trayContainer: {
    paddingVertical: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  categoryTabs: {
    maxHeight: 40,
    marginBottom: 8,
  },
  categoryTabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  stickerScroll: {
    maxHeight: 70,
  },
  stickerScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  stickerItem: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerEmoji: {
    fontSize: 36,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  undoText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default StickerBoard;
