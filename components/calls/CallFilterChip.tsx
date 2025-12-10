/**
 * CallFilterChip Component
 * Filter chip for call history (all, missed, incoming, outgoing)
 */

import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface CallFilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}

export const CallFilterChip: React.FC<CallFilterChipProps> = ({ label, active, onPress, count }) => {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity 
      style={[
        styles.chip,
        { backgroundColor: active ? theme.primary : theme.surface },
        { borderColor: active ? theme.primary : theme.border }
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, { color: active ? theme.onPrimary : theme.text }]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.chipBadge, { backgroundColor: active ? theme.onPrimary : theme.primary }]}>
          <Text style={[styles.chipBadgeText, { color: active ? theme.primary : theme.onPrimary }]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
