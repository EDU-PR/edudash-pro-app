// Teacher list item component - displays individual teacher with seat status

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Teacher } from './types';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface TeacherListItemProps {
  teacher: Teacher;
  isPending: boolean;
  disabled: boolean;
  onAction: () => void;
  theme: any;
  isDark: boolean;
}

export function TeacherListItem({
  teacher,
  isPending,
  disabled,
  onAction,
  theme,
  isDark,
}: TeacherListItemProps) {
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const hasSeat = teacher.hasSeat;

  return (
    <View style={[styles.teacherRow, hasSeat ? styles.teacherRowWithSeat : styles.teacherRowWithoutSeat]}>
      <View style={styles.teacherInfo}>
        <Ionicons
          name={hasSeat ? 'checkmark-circle' : 'alert-circle-outline'}
          size={20}
          color={hasSeat ? theme.success : theme.warning}
        />
        <Text style={styles.teacherEmail}>{teacher.email}</Text>
      </View>
      <TouchableOpacity
        style={[
          styles.smallBtn,
          hasSeat ? styles.btnDanger : styles.btnPrimary,
          (isPending || disabled) && styles.btnDisabled,
        ]}
        disabled={isPending || disabled}
        onPress={onAction}
      >
        {isPending ? (
          <EduDashSpinner color="#000" size="small" />
        ) : (
          <Text style={hasSeat ? styles.btnDangerText : styles.btnPrimaryText}>
            {hasSeat ? 'Revoke' : 'Assign Seat'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    teacherRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      marginBottom: 8,
    },
    teacherRowWithSeat: {
      borderColor: theme.success,
    },
    teacherRowWithoutSeat: {
      borderColor: theme.warning,
    },
    teacherInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    teacherEmail: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '500',
    },
    smallBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      minWidth: 80,
      alignItems: 'center',
    },
    btnPrimary: {
      backgroundColor: theme.primary,
    },
    btnPrimaryText: {
      color: theme.onPrimary,
      fontWeight: '800',
    },
    btnDanger: {
      backgroundColor: theme.error,
    },
    btnDangerText: {
      color: theme.onError,
      fontWeight: '800',
    },
    btnDisabled: {
      opacity: 0.5,
    },
  });
