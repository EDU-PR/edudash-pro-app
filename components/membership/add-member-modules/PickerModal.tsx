/**
 * Reusable picker modal component for Add Member screen
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './styles';

interface PickerOption {
  value: string;
  label: string;
  color?: string;
}

interface PickerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  theme: {
    card: string;
    text: string;
    primary: string;
  };
}

export function PickerModal({
  visible,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
  theme,
}: PickerModalProps) {
  if (!visible) return null;

  return (
    <View style={[styles.pickerOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <View style={[styles.pickerContainer, { backgroundColor: theme.card }]}>
        <View style={styles.pickerHeader}>
          <Text style={[styles.pickerTitle, { color: theme.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.pickerScroll}>
          {options.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.pickerOption,
                selectedValue === option.value && { backgroundColor: theme.primary + '15' }
              ]}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
            >
              <Text style={[
                styles.pickerOptionText,
                { color: option.color || theme.text },
                selectedValue === option.value && { fontWeight: '700' }
              ]}>
                {option.label}
              </Text>
              {selectedValue === option.value && (
                <Ionicons name="checkmark" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
