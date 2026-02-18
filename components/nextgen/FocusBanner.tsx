import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface FocusBannerProps {
  childName: string;
  /** Optional label override, e.g. "Learner" or "Student" */
  label?: string;
}

/**
 * Personalized green focus banner.
 * "Parents, focus on Adam, Learner"
 */
export default function FocusBanner({ childName, label = 'Learner' }: FocusBannerProps) {
  return (
    <LinearGradient
      colors={['rgba(60,142,98,0.18)', 'rgba(60,142,98,0.08)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.container}
    >
      <View style={styles.dot} />
      <Text style={styles.text}>
        Parents, focus on{' '}
        <Text style={styles.name}>{childName}</Text>
        , {label}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(60,142,98,0.20)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3C8E62',
    marginRight: 10,
  },
  text: {
    color: 'rgba(234,240,255,0.80)',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  name: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
