import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function BuildExamCard({ onPress }: { onPress?: () => void }) {
  return (
    <LinearGradient
      colors={['#23214D', '#5A409D']}
      style={styles.container}
    >
      <Text style={styles.badge}>Exam Builder</Text>

      <Text style={styles.title}>Build Full Exam (Printable)</Text>

      <Text style={styles.subtitle}>
        Generate a CAPS-aligned formal test paper for review or print.
      </Text>

      <Pressable style={styles.button} onPress={onPress}>
        <Text style={styles.buttonText}>Generate Formal Test Paper →</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 18,
    marginVertical: 12,
  },
  badge: {
    color: '#C7BFFF',
    fontSize: 12,
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginVertical: 6,
  },
  button: {
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
