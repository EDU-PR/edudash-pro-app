/**
 * Live Lesson Hero Card
 * Purple gradient header with stats and features
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LiveLessonHeroProps {
  classCount: number;
  maxDuration: string;
  badge: string;
  onStartPress: () => void;
  disabled?: boolean;
}

export function LiveLessonHero({
  classCount,
  maxDuration,
  badge,
  onStartPress,
  disabled = false,
}: LiveLessonHeroProps) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroGradient}>
        {/* Header */}
        <View style={styles.heroHeader}>
          <View style={styles.heroIcon}>
            <Ionicons name="videocam" size={28} color="#ffffff" />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Live Lessons</Text>
            <Text style={styles.heroSubtitle}>Start or schedule group video lessons</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statContent}>
              <Ionicons name="people" size={18} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.statValue}>{classCount}</Text>
            </View>
            <Text style={styles.statLabel}>Classes</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statContent}>
              <Ionicons name="time" size={18} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.statValue}>{maxDuration}</Text>
            </View>
            <Text style={styles.statLabel}>Max Duration</Text>
          </View>
        </View>

        {/* Features */}
        <View style={styles.featuresList}>
          {['Screen Share', 'Recording', 'Chat', 'Hand Raise'].map((feature) => (
            <View key={feature} style={styles.featureTag}>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Start Button */}
        <TouchableOpacity
          style={[styles.startButton, disabled && styles.startButtonDisabled]}
          onPress={onStartPress}
          disabled={disabled}
        >
          <Ionicons name="radio" size={20} color="#7c3aed" />
          <Text style={styles.startButtonText}>
            {disabled ? 'No Classes Assigned' : 'Start Live Lesson'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    margin: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  heroGradient: {
    padding: 20,
    backgroundColor: '#7c3aed',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  featuresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  featureTag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  featureText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 14,
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7c3aed',
  },
});
