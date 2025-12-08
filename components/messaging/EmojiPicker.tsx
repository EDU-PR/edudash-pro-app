/**
 * EmojiPicker Component
 * WhatsApp-style emoji picker for message composer
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Emoji categories with emojis
const EMOJI_CATEGORIES = [
  {
    id: 'recent',
    icon: 'time-outline' as keyof typeof Ionicons.glyphMap,
    emojis: ['👍', '❤️', '😂', '😊', '🙏', '😢', '🎉', '🔥'],
  },
  {
    id: 'smileys',
    icon: 'happy-outline' as keyof typeof Ionicons.glyphMap,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜',
      '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
      '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
      '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒',
      '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵',
      '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕',
    ],
  },
  {
    id: 'gestures',
    icon: 'hand-left-outline' as keyof typeof Ionicons.glyphMap,
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏',
      '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
      '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛',
      '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️',
      '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃',
    ],
  },
  {
    id: 'hearts',
    icon: 'heart-outline' as keyof typeof Ionicons.glyphMap,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '♥️', '💌', '💋', '👄', '👅',
    ],
  },
  {
    id: 'objects',
    icon: 'cube-outline' as keyof typeof Ionicons.glyphMap,
    emojis: [
      '📚', '📖', '📝', '✏️', '📎', '📌', '📍', '🔍',
      '🔎', '🔐', '🔑', '🔒', '🔓', '💡', '🔦', '🕯️',
      '📱', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '💾', '💿',
      '📷', '📸', '📹', '🎥', '📞', '☎️', '📺', '📻',
      '⏰', '⌚', '⏱️', '⏲️', '🕰️', '💰', '💵', '💴',
    ],
  },
  {
    id: 'nature',
    icon: 'leaf-outline' as keyof typeof Ionicons.glyphMap,
    emojis: [
      '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼',
      '🌷', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵', '🌾',
      '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🌍', '🌎',
      '🌏', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗',
      '🌘', '🌙', '🌚', '🌛', '🌜', '☀️', '🌝', '🌞',
      '⭐', '🌟', '🌠', '☁️', '⛅', '⛈️', '🌤️', '🌥️',
    ],
  },
  {
    id: 'food',
    icon: 'fast-food-outline' as keyof typeof Ionicons.glyphMap,
    emojis: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓',
      '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝',
      '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑',
      '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐',
      '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙',
    ],
  },
  {
    id: 'activities',
    icon: 'football-outline' as keyof typeof Ionicons.glyphMap,
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
      '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
      '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
      '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌',
      '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️',
      '🎮', '🕹️', '🎲', '🧩', '♟️', '🎭', '🎨', '🎬',
    ],
  },
  {
    id: 'symbols',
    icon: 'heart' as keyof typeof Ionicons.glyphMap,
    emojis: [
      '✅', '❌', '❓', '❗', '💯', '🔴', '🟠', '🟡',
      '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷',
      '🔸', '🔹', '▪️', '▫️', '◾', '◽', '◼️', '◻️',
      '🔲', '🔳', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕',
      '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️',
      '♦️', '🃏', '🎴', '🀄', '🔃', '🔄', '➕', '➖',
    ],
  },
];

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  height?: number;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  visible,
  onClose,
  onEmojiSelect,
  height = 280,
}) => {
  const { theme } = useTheme();
  const [activeCategory, setActiveCategory] = useState('smileys');
  const scrollViewRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(height)).current;
  
  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, height]);
  
  const handleEmojiPress = useCallback((emoji: string) => {
    onEmojiSelect(emoji);
  }, [onEmojiSelect]);
  
  const currentCategory = EMOJI_CATEGORIES.find(c => c.id === activeCategory) || EMOJI_CATEGORIES[1];
  
  const styles = StyleSheet.create({
    container: {
      height,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    categoryTabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.elevated,
    },
    categoryTab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryTabActive: {
      borderBottomWidth: 2,
      borderBottomColor: theme.primary,
    },
    emojiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 8,
    },
    emojiButton: {
      width: (SCREEN_WIDTH - 16) / 8,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: {
      fontSize: 26,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.elevated,
      margin: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
    },
    searchInput: {
      flex: 1,
      marginLeft: 8,
      fontSize: 14,
      color: theme.text,
    },
  });

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Category Tabs */}
      <View style={styles.categoryTabs}>
        {EMOJI_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryTab,
              activeCategory === category.id && styles.categoryTabActive,
            ]}
            onPress={() => setActiveCategory(category.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={category.icon}
              size={22}
              color={activeCategory === category.id ? theme.primary : theme.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Emoji Grid */}
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.emojiGrid}
      >
        {currentCategory.emojis.map((emoji, index) => (
          <TouchableOpacity
            key={`${emoji}-${index}`}
            style={styles.emojiButton}
            onPress={() => handleEmojiPress(emoji)}
            activeOpacity={0.6}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

export default EmojiPicker;
