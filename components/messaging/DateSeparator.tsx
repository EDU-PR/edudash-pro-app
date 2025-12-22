/**
 * Date Separator Component
 * WhatsApp-style date pill between message groups
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DateSeparatorProps {
  label: string;
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({ label }) => (
  <View style={styles.container}>
    <View style={styles.pill}>
      <Text style={styles.text}>{label}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  pill: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(148, 163, 184, 0.9)',
  },
});
