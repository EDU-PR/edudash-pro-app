/**
 * Billing cycle toggle component
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface BillingToggleProps {
  annual: boolean;
  onToggle: (annual: boolean) => void;
}

export function BillingToggle({ annual, onToggle }: BillingToggleProps) {
  return (
    <View style={styles.toggleSection}>
      <Text style={styles.toggleLabel}>Choose billing cycle:</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity 
          onPress={() => onToggle(false)} 
          style={[styles.toggleBtn, !annual && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleBtnText, !annual && styles.toggleBtnTextActive]}>
            Monthly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => onToggle(true)} 
          style={[styles.toggleBtn, annual && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleBtnText, annual && styles.toggleBtnTextActive]}>
            Annual
          </Text>
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>Save 17%</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleSection: {
    alignItems: 'center',
  },
  toggleLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#111827',
    padding: 4,
    borderRadius: 12,
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    position: 'relative',
  },
  toggleBtnActive: {
    backgroundColor: '#00f5ff',
  },
  toggleBtnText: {
    color: '#9CA3AF',
    fontWeight: '700',
    fontSize: 14,
  },
  toggleBtnTextActive: {
    color: '#000',
  },
  savingsBadge: {
    position: 'absolute',
    top: -8,
    right: -4,
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
