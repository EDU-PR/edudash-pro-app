/**
 * SpotlightTooltip
 *
 * Floating tooltip that accompanies the spotlight cutout.
 * Positions itself above or below the target with a small arrow,
 * animated in with react-native-reanimated.
 *
 * @module components/ui/SpotlightTour/SpotlightTooltip
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { SpotlightTooltipProps, TargetMeasurement } from './types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const TOOLTIP_MAX_WIDTH = Math.min(SCREEN_W - 48, 340);
const TOOLTIP_MARGIN = 16;
const ARROW_SIZE = 8;

type ResolvedPosition = 'above' | 'below';

function resolvePosition(
  preference: 'above' | 'below' | 'auto',
  target: TargetMeasurement | null,
): ResolvedPosition {
  if (!target) return 'below';
  if (preference !== 'auto') return preference;
  // Place above if the target is in the bottom half
  const targetCenter = target.y + target.height / 2;
  return targetCenter > SCREEN_H / 2 ? 'above' : 'below';
}

export const SpotlightTooltip: React.FC<SpotlightTooltipProps> = ({
  step,
  target,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
  onDone,
}) => {
  const position = resolvePosition(step.tooltipPosition ?? 'auto', target);
  const isLast = stepIndex === totalSteps - 1;

  const tooltipStyle = useMemo(() => {
    if (!target) return { top: SCREEN_H / 2 - 60, left: 24 };

    const left = Math.max(
      TOOLTIP_MARGIN,
      Math.min(
        target.x + target.width / 2 - TOOLTIP_MAX_WIDTH / 2,
        SCREEN_W - TOOLTIP_MAX_WIDTH - TOOLTIP_MARGIN,
      ),
    );

    if (position === 'above') {
      return { bottom: SCREEN_H - target.y + ARROW_SIZE + 8, left };
    }
    return { top: target.y + target.height + ARROW_SIZE + 8, left };
  }, [target, position]);

  const entering = position === 'above' ? FadeInUp.duration(300) : FadeInDown.duration(300);

  return (
    <Animated.View
      style={[styles.container, tooltipStyle, { maxWidth: TOOLTIP_MAX_WIDTH }]}
      entering={entering}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        {/* Title row */}
        <View style={styles.titleRow}>
          {step.icon && (
            <Ionicons
              name={step.icon as keyof typeof Ionicons.glyphMap}
              size={20}
              color="#3b82f6"
              style={styles.icon}
            />
          )}
          <Text style={styles.title} numberOfLines={2}>
            {step.title}
          </Text>
        </View>

        {/* Description */}
        <Text style={styles.description}>{step.description}</Text>

        {/* Footer: dots + buttons */}
        <View style={styles.footer}>
          {/* Step dots */}
          <View style={styles.dots}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <View
                key={i}
                style={[styles.dot, i === stepIndex && styles.dotActive]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity
              onPress={onSkip}
              style={styles.skipBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={isLast ? onDone : onNext}
              style={styles.nextBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.nextText}>
                {isLast ? 'Got it!' : 'Next'}
              </Text>
              {!isLast && (
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1001,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94a3b8',
    marginBottom: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
  },
  dotActive: {
    backgroundColor: '#3b82f6',
    width: 16,
    borderRadius: 3,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  nextText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default SpotlightTooltip;
