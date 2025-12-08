/**
 * Existing Call Banner
 * Shows when teacher has an active live lesson with rejoin/end actions
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ExistingCallBannerProps {
  title: string;
  className: string;
  onRejoin: () => void;
  onEnd: () => void;
  isRejoining: boolean;
  colors: {
    cardBg: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    error: string;
    errorBg: string;
  };
}

export function ExistingCallBanner({
  title,
  className,
  onRejoin,
  onEnd,
  isRejoining,
  colors,
}: ExistingCallBannerProps) {
  return (
    <View style={[styles.banner, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.pulseDot} />
        <Text style={[styles.title, { color: colors.text }]}>Live Lesson in Progress</Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {title} • {className}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.rejoinButton, { backgroundColor: colors.accent }]}
          onPress={onRejoin}
          disabled={isRejoining}
        >
          {isRejoining ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="enter" size={16} color="#ffffff" />
              <Text style={styles.rejoinButtonText}>Rejoin</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.endButton, { backgroundColor: colors.errorBg, borderColor: colors.error }]}
          onPress={onEnd}
        >
          <Ionicons name="stop-circle" size={16} color={colors.error} />
          <Text style={[styles.endButtonText, { color: colors.error }]}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  rejoinButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  rejoinButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  endButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  endButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
