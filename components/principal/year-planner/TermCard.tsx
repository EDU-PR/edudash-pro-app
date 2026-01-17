// Term card component - displays individual academic term

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AcademicTerm } from './types';

interface TermCardProps {
  term: AcademicTerm;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  theme: any;
}

export function TermCard({ term, onEdit, onDelete, onTogglePublish, theme }: TermCardProps) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.termCard, term.is_active && styles.termCardActive]}>
      <View style={styles.termHeader}>
        <View style={styles.termInfo}>
          <Text style={styles.termName}>{term.name}</Text>
          <View style={styles.badges}>
            {term.is_active && (
              <View style={[styles.badge, styles.badgeActive]}>
                <Text style={styles.badgeText}>Active</Text>
              </View>
            )}
            {term.is_published && (
              <View style={[styles.badge, styles.badgePublished]}>
                <Text style={styles.badgeText}>Published</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.termActions}>
          <TouchableOpacity onPress={onTogglePublish} style={styles.iconButton}>
            <Ionicons
              name={term.is_published ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={24}
              color={term.is_published ? '#10b981' : theme.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onEdit} style={styles.iconButton}>
            <Ionicons name="create-outline" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.termDates}>
        {new Date(term.start_date).toLocaleDateString()} - {new Date(term.end_date).toLocaleDateString()}
      </Text>
      {term.description && <Text style={styles.termDescription}>{term.description}</Text>}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    termCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    termCardActive: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    termHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    termInfo: {
      flex: 1,
    },
    termName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    badges: {
      flexDirection: 'row',
      gap: 8,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    badgeActive: {
      backgroundColor: theme.primary,
    },
    badgePublished: {
      backgroundColor: '#10b981',
    },
    badgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    termActions: {
      flexDirection: 'row',
      gap: 8,
    },
    iconButton: {
      padding: 4,
    },
    termDates: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    termDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
    },
  });
