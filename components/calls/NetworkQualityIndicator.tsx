/**
 * Network Quality Indicator for Video/Voice Calls
 * 
 * Displays connection quality status with visual indicators.
 * Shows color-coded bars like cellular signal strength.
 * 
 * @module components/calls
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export interface NetworkQualityIndicatorProps {
  /** Current network quality */
  quality: NetworkQuality;
  /** Whether to show the label text */
  showLabel?: boolean;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Additional styles */
  style?: ViewStyle;
  /** Show detailed metrics */
  showDetails?: boolean;
  /** Packet loss percentage (0-100) */
  packetLoss?: number;
  /** Latency in ms */
  latency?: number;
  /** Bitrate in kbps */
  bitrate?: number;
}

interface QualityConfig {
  color: string;
  bars: number; // 0-4 bars filled
  label: string;
  icon: string;
}

const QUALITY_CONFIGS: Record<NetworkQuality, QualityConfig> = {
  excellent: {
    color: '#4CAF50', // Green
    bars: 4,
    label: 'Excellent',
    icon: 'wifi',
  },
  good: {
    color: '#8BC34A', // Light Green
    bars: 3,
    label: 'Good',
    icon: 'wifi',
  },
  fair: {
    color: '#FFC107', // Amber
    bars: 2,
    label: 'Fair',
    icon: 'wifi',
  },
  poor: {
    color: '#F44336', // Red
    bars: 1,
    label: 'Poor',
    icon: 'cellular',
  },
  unknown: {
    color: '#9E9E9E', // Gray
    bars: 0,
    label: 'Connecting...',
    icon: 'cellular',
  },
};

const SIZES = {
  small: { bar: { width: 3, heights: [4, 7, 10, 13] }, gap: 2, fontSize: 10 },
  medium: { bar: { width: 4, heights: [6, 10, 14, 18] }, gap: 2, fontSize: 12 },
  large: { bar: { width: 6, heights: [8, 14, 20, 26] }, gap: 3, fontSize: 14 },
};

/**
 * Convert Daily.co network quality threshold to our quality enum
 */
export function mapDailyQualityThreshold(threshold: string | undefined): NetworkQuality {
  switch (threshold) {
    case 'good':
      return 'excellent';
    case 'low':
      return 'fair';
    case 'very-low':
      return 'poor';
    default:
      return 'unknown';
  }
}

/**
 * Estimate quality from packet loss and latency
 */
export function estimateQualityFromMetrics(
  packetLoss?: number,
  latency?: number
): NetworkQuality {
  // No data
  if (packetLoss === undefined && latency === undefined) {
    return 'unknown';
  }

  // Packet loss thresholds
  const packetLossScore = packetLoss !== undefined
    ? packetLoss < 1 ? 4 : packetLoss < 3 ? 3 : packetLoss < 5 ? 2 : 1
    : 3;

  // Latency thresholds
  const latencyScore = latency !== undefined
    ? latency < 100 ? 4 : latency < 200 ? 3 : latency < 400 ? 2 : 1
    : 3;

  // Average the scores
  const avgScore = (packetLossScore + latencyScore) / 2;

  if (avgScore >= 3.5) return 'excellent';
  if (avgScore >= 2.5) return 'good';
  if (avgScore >= 1.5) return 'fair';
  return 'poor';
}

export function NetworkQualityIndicator({
  quality,
  showLabel = false,
  size = 'medium',
  style,
  showDetails = false,
  packetLoss,
  latency,
  bitrate,
}: NetworkQualityIndicatorProps) {
  const config = QUALITY_CONFIGS[quality];
  const dimensions = SIZES[size];
  
  // Animation for pulse when quality is poor
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (quality === 'poor' || quality === 'fair') {
      // Pulse animation for poor quality
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [quality, pulseAnim]);

  return (
    <View style={[styles.container, style]}>
      {/* Signal bars */}
      <Animated.View style={[styles.barsContainer, { opacity: pulseAnim }]}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                width: dimensions.bar.width,
                height: dimensions.bar.heights[index],
                marginHorizontal: dimensions.gap / 2,
                backgroundColor: index < config.bars ? config.color : '#E0E0E0',
                borderRadius: dimensions.bar.width / 2,
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* Label */}
      {showLabel && (
        <Text
          style={[
            styles.label,
            { fontSize: dimensions.fontSize, color: config.color },
          ]}
        >
          {config.label}
        </Text>
      )}

      {/* Detailed metrics */}
      {showDetails && (
        <View style={styles.detailsContainer}>
          {latency !== undefined && (
            <View style={styles.metric}>
              <Ionicons name="timer-outline" size={12} color="#666" />
              <Text style={styles.metricText}>{latency}ms</Text>
            </View>
          )}
          {packetLoss !== undefined && (
            <View style={styles.metric}>
              <Ionicons name="warning-outline" size={12} color="#666" />
              <Text style={styles.metricText}>{packetLoss.toFixed(1)}%</Text>
            </View>
          )}
          {bitrate !== undefined && (
            <View style={styles.metric}>
              <Ionicons name="speedometer-outline" size={12} color="#666" />
              <Text style={styles.metricText}>{bitrate}kbps</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bar: {
    backgroundColor: '#E0E0E0',
  },
  label: {
    marginLeft: 6,
    fontWeight: '500',
  },
  detailsContainer: {
    flexDirection: 'row',
    marginLeft: 8,
    gap: 8,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metricText: {
    fontSize: 10,
    color: '#666',
  },
});

export default NetworkQualityIndicator;
