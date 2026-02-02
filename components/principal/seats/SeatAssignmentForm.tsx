// Seat assignment form component - manual email-based seat assignment

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface SeatAssignmentFormProps {
  subscriptionId: string | null;
  assigning: boolean;
  revoking: boolean;
  onAssign: (email: string) => Promise<void>;
  onRevoke: (email: string) => Promise<void>;
  theme: any;
  isDark: boolean;
}

export function SeatAssignmentForm({
  subscriptionId,
  assigning,
  revoking,
  onAssign,
  onRevoke,
  theme,
  isDark,
}: SeatAssignmentFormProps) {
  const { t } = useTranslation();
  const [teacherEmail, setTeacherEmail] = useState('');
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const handleAssign = async () => {
    await onAssign(teacherEmail);
    setTeacherEmail('');
  };

  const handleRevoke = async () => {
    await onRevoke(teacherEmail);
    setTeacherEmail('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          {t('seat_management.teacher_email', { defaultValue: 'Teacher email' })}
        </Text>
        <TextInput
          placeholder="teacher@example.com"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          keyboardType="email-address"
          value={teacherEmail}
          onChangeText={setTeacherEmail}
          style={styles.input}
        />
      </View>

      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnPrimary,
            (!subscriptionId || !teacherEmail || assigning) && styles.btnDisabled,
          ]}
          onPress={handleAssign}
          disabled={!subscriptionId || !teacherEmail || assigning}
        >
          {assigning ? (
            <EduDashSpinner color="#000" />
          ) : (
            <Text style={styles.btnPrimaryText}>
              {t('seat_management.assign_seat', { defaultValue: 'Assign seat' })}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnDanger,
            (!subscriptionId || !teacherEmail || revoking) && styles.btnDisabled,
          ]}
          onPress={handleRevoke}
          disabled={!subscriptionId || !teacherEmail || revoking}
        >
          {revoking ? (
            <EduDashSpinner color="#000" />
          ) : (
            <Text style={styles.btnDangerText}>
              {t('seat_management.revoke_seat', { defaultValue: 'Revoke seat' })}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      gap: 12,
    },
    inputGroup: {
      gap: 6,
    },
    label: {
      color: theme.text,
    },
    input: {
      backgroundColor: theme.surface,
      color: theme.text,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    btn: {
      flex: 1,
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
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
