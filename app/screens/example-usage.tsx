import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Developer helper route.
 * Kept as a real screen so Expo Router can compile without runtime errors.
 * The actual production flow lives in `/screens/uniform-register`.
 */
export default function ExampleUsageScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors?.background || '#0b1020' }]}>
      <Ionicons name="code-slash-outline" size={42} color={theme.colors?.primary || '#4f46e5'} />
      <Text style={[styles.title, { color: theme.colors?.text || '#e5e7eb' }]}>Example Usage</Text>
      <Text style={[styles.description, { color: theme.colors?.textSecondary || '#9ca3af' }]}>
        This screen is a safe placeholder for development snippets.
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors?.primary || '#4f46e5' }]}
        onPress={() => router.push('/screens/uniform-register')}
      >
        <Ionicons name="open-outline" size={16} color="#fff" />
        <Text style={styles.buttonText}>Open Uniform Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: '700',
  },
  description: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
