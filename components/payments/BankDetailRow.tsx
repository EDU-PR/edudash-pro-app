/**
 * Bank Detail Row Component
 * Displays a single bank detail with copy functionality
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BankDetailRowProps {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  theme: any;
  highlight?: boolean;
}

export function BankDetailRow({ label, value, onCopy, copied, theme, highlight }: BankDetailRowProps) {
  return (
    <View style={[styles.container, highlight && { backgroundColor: theme.primary + '10' }]}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[
          styles.value, 
          { color: theme.text },
          highlight && { fontWeight: '700', color: theme.primary }
        ]}>
          {value}
        </Text>
        <TouchableOpacity onPress={onCopy} style={styles.copyBtn}>
          <Ionicons 
            name={copied ? 'checkmark-circle' : 'copy-outline'} 
            size={18} 
            color={copied ? theme.success : theme.textSecondary} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  label: { fontSize: 13, flex: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontSize: 14, fontWeight: '500' },
  copyBtn: { padding: 4 },
});
