import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function DashOrb({ size = 64 }: { size?: number }) {
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <LinearGradient
        colors={['#1B2236', '#101525']}
        style={styles.orb}
      >
        <LinearGradient
          colors={['#3C8E62', '#5A409D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.innerGlow}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  orb: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F121E',
  },
  innerGlow: {
    width: '60%',
    height: '60%',
    borderRadius: 999,
    opacity: 0.8,
  },
});
