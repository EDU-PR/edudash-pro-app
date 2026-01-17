// Recipient Selection Component

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { RecipientType, ClassOption } from './types';
import { RECIPIENT_OPTIONS } from './types';

interface RecipientSelectorProps {
  recipientType: RecipientType;
  selectedClass: string | null;
  classes: ClassOption[];
  onRecipientChange: (type: RecipientType) => void;
  onClassChange: (classId: string | null) => void;
}

export function RecipientSelector({
  recipientType,
  selectedClass,
  classes,
  onRecipientChange,
  onClassChange,
}: RecipientSelectorProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Send To</Text>
      <View style={styles.recipientGrid}>
        {RECIPIENT_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.recipientOption,
              recipientType === option.id && { 
                borderColor: option.color, 
                backgroundColor: option.color + '15' 
              }
            ]}
            onPress={() => {
              onRecipientChange(option.id);
              if (option.id !== 'class') onClassChange(null);
            }}
          >
            <View style={[styles.recipientIcon, { backgroundColor: option.color + '20' }]}>
              <Ionicons name={option.icon as any} size={24} color={option.color} />
            </View>
            <Text style={[
              styles.recipientLabel,
              recipientType === option.id && { color: option.color }
            ]}>
              {option.label}
            </Text>
            {recipientType === option.id && (
              <Ionicons name="checkmark-circle" size={20} color={option.color} style={styles.checkIcon} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {recipientType === 'class' && (
        <View style={styles.classSelector}>
          <Text style={styles.label}>Select Class</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {classes.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.classChip,
                  selectedClass === c.id && styles.classChipActive
                ]}
                onPress={() => onClassChange(c.id)}
              >
                <Text style={[
                  styles.classChipText,
                  selectedClass === c.id && styles.classChipTextActive
                ]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  card: {
    backgroundColor: theme?.card || '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme?.border || '#1f2937',
    marginBottom: 16,
  },
  cardTitle: {
    color: theme?.text || '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  recipientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recipientOption: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme?.border || '#1f2937',
    backgroundColor: theme?.surface || '#1f2937',
  },
  recipientIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  recipientLabel: {
    flex: 1,
    color: theme?.text || '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  classSelector: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme?.border || '#1f2937',
  },
  label: {
    color: theme?.text || '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  classChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme?.surface || '#1f2937',
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme?.border || '#374151',
  },
  classChipActive: {
    backgroundColor: theme?.primary || '#00f5ff',
    borderColor: theme?.primary || '#00f5ff',
  },
  classChipText: {
    color: theme?.text || '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  classChipTextActive: {
    color: theme?.onPrimary || '#000',
  },
});
