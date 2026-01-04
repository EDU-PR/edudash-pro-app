/**
 * Badge Display Component
 * 
 * Shows earned badges with beautiful animations and details.
 * Supports grid view for badge collections.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

// ====================================================================
// TYPES
// ====================================================================

export interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  earnedAt?: string;
  category?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

interface BadgeDisplayProps {
  /** List of badges to display */
  badges: Badge[];
  /** Layout variant */
  layout?: 'grid' | 'row' | 'single';
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Max badges to show (rest as "+N") */
  maxVisible?: number;
  /** Show badge names */
  showNames?: boolean;
  /** Called when badge is tapped */
  onBadgePress?: (badge: Badge) => void;
  /** Custom empty state text */
  emptyText?: string;
}

// ====================================================================
// RARITY COLORS
// ====================================================================

const RARITY_COLORS = {
  common: '#9E9E9E',
  rare: '#2196F3',
  epic: '#9C27B0',
  legendary: '#FFD700',
};

const RARITY_LABELS = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

// ====================================================================
// COMPONENT
// ====================================================================

export function BadgeDisplay({
  badges,
  layout = 'row',
  size = 'medium',
  maxVisible = 5,
  showNames = false,
  onBadgePress,
  emptyText = 'No badges earned yet!',
}: BadgeDisplayProps) {
  const { colors, isDark } = useTheme();
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [scaleAnim] = useState(new Animated.Value(0));

  const sizeConfig = {
    small: { badgeSize: 40, fontSize: 24, nameSize: 10, gap: 8 },
    medium: { badgeSize: 56, fontSize: 32, nameSize: 12, gap: 12 },
    large: { badgeSize: 80, fontSize: 48, nameSize: 14, gap: 16 },
  };

  const config = sizeConfig[size];

  const visibleBadges = badges.slice(0, maxVisible);
  const overflowCount = badges.length - maxVisible;

  const handleBadgePress = (badge: Badge) => {
    setSelectedBadge(badge);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
    onBadgePress?.(badge);
  };

  const handleCloseModal = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSelectedBadge(null));
  };

  const renderBadge = (badge: Badge, index: number) => {
    const rarityColor = RARITY_COLORS[badge.rarity || 'common'];

    return (
      <TouchableOpacity
        key={badge.id}
        onPress={() => handleBadgePress(badge)}
        style={[
          styles.badgeItem,
          layout === 'grid' && styles.badgeItemGrid,
        ]}
      >
        <View
          style={[
            styles.badgeCircle,
            {
              width: config.badgeSize,
              height: config.badgeSize,
              borderRadius: config.badgeSize / 2,
              backgroundColor: badge.color || colors.cardBackground,
              borderColor: rarityColor,
              borderWidth: badge.rarity === 'legendary' ? 3 : 2,
            },
          ]}
        >
          <Text style={{ fontSize: config.fontSize }}>{badge.icon}</Text>
        </View>
        {showNames && (
          <Text
            style={[
              styles.badgeName,
              { color: colors.text, fontSize: config.nameSize },
            ]}
            numberOfLines={1}
          >
            {badge.name}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (badges.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.cardBackground }]}>
        <Text style={styles.emptyEmoji}>🏅</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {emptyText}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Badge List */}
      {layout === 'row' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.rowContainer, { gap: config.gap }]}
        >
          {visibleBadges.map(renderBadge)}
          {overflowCount > 0 && (
            <View
              style={[
                styles.overflowBadge,
                {
                  width: config.badgeSize,
                  height: config.badgeSize,
                  borderRadius: config.badgeSize / 2,
                  backgroundColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.overflowText, { color: colors.text }]}>
                +{overflowCount}
              </Text>
            </View>
          )}
        </ScrollView>
      ) : layout === 'grid' ? (
        <View style={[styles.gridContainer, { gap: config.gap }]}>
          {visibleBadges.map(renderBadge)}
          {overflowCount > 0 && (
            <View
              style={[
                styles.overflowBadge,
                {
                  width: config.badgeSize,
                  height: config.badgeSize,
                  borderRadius: config.badgeSize / 2,
                  backgroundColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.overflowText, { color: colors.text }]}>
                +{overflowCount}
              </Text>
            </View>
          )}
        </View>
      ) : (
        // Single badge display
        badges[0] && renderBadge(badges[0], 0)
      )}

      {/* Badge Detail Modal */}
      <Modal
        visible={!!selectedBadge}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseModal}
        >
          {selectedBadge && (
            <Animated.View
              style={[
                styles.modalContent,
                { 
                  backgroundColor: colors.cardBackground,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <View
                style={[
                  styles.modalBadge,
                  {
                    backgroundColor: selectedBadge.color || colors.background,
                    borderColor: RARITY_COLORS[selectedBadge.rarity || 'common'],
                  },
                ]}
              >
                <Text style={styles.modalBadgeIcon}>{selectedBadge.icon}</Text>
              </View>

              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedBadge.name}
              </Text>

              {selectedBadge.rarity && (
                <View
                  style={[
                    styles.rarityBadge,
                    { backgroundColor: RARITY_COLORS[selectedBadge.rarity] },
                  ]}
                >
                  <Text style={styles.rarityText}>
                    {RARITY_LABELS[selectedBadge.rarity]}
                  </Text>
                </View>
              )}

              {selectedBadge.description && (
                <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                  {selectedBadge.description}
                </Text>
              )}

              {selectedBadge.earnedAt && (
                <Text style={[styles.earnedDate, { color: colors.textSecondary }]}>
                  Earned: {new Date(selectedBadge.earnedAt).toLocaleDateString()}
                </Text>
              )}

              <TouchableOpacity
                onPress={handleCloseModal}
                style={[styles.closeButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.closeButtonText}>Awesome!</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ====================================================================
// STYLES
// ====================================================================

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badgeItem: {
    alignItems: 'center',
  },
  badgeItemGrid: {
    marginBottom: 8,
  },
  badgeCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  badgeName: {
    marginTop: 4,
    maxWidth: 60,
    textAlign: 'center',
  },
  overflowBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflowText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.8,
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  modalBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalBadgeIcon: {
    fontSize: 56,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  rarityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  rarityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  earnedDate: {
    fontSize: 12,
    marginBottom: 16,
  },
  closeButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BadgeDisplay;
