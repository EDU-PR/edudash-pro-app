import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ViewStyle, TextStyle } from 'react-native';

interface ProfileInfoCardsProps {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string | null;
  school: string | null;
  onEditPress: () => void;
  theme: {
    textSecondary: string;
    primary: string;
  };
  styles: {
    infoSection: ViewStyle;
    sectionTitle: TextStyle;
    infoCard: ViewStyle;
    infoRow: ViewStyle;
    infoContent: ViewStyle;
    infoLabel: TextStyle;
    infoValue: TextStyle;
    editButton: ViewStyle;
  };
}

export function ProfileInfoCards({
  firstName,
  lastName,
  email,
  role,
  school,
  onEditPress,
  theme,
  styles,
}: ProfileInfoCardsProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.infoSection}>
      <Text style={styles.sectionTitle}>{t('account.info.title', { defaultValue: 'Account Information' })}</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={20} color={theme.textSecondary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>{t('account.info.full_name', { defaultValue: 'Full Name' })}</Text>
            <Text style={styles.infoValue}>
              {firstName || lastName
                ? `${firstName || ""} ${lastName || ""}`.trim()
                : t('common.not_set', { defaultValue: 'Not set' })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={onEditPress}
          >
            <Ionicons name="pencil" size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.infoCard, { marginTop: 12 }]}>
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>{t('auth.email', { defaultValue: 'Email' })}</Text>
            <Text style={styles.infoValue}>{email || t('common.not_set', { defaultValue: 'Not set' })}</Text>
          </View>
        </View>
      </View>

      {role && (
        <View style={[styles.infoCard, { marginTop: 12 }]}>
          <View style={styles.infoRow}>
            <Ionicons name="briefcase-outline" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{t('account.info.role', { defaultValue: 'Role' })}</Text>
              <Text style={styles.infoValue}>{role.replace("_", " ")}</Text>
            </View>
          </View>
        </View>
      )}

      {school && (
        <View style={[styles.infoCard, { marginTop: 12 }]}>
          <View style={styles.infoRow}>
            <Ionicons name="school-outline" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{t('account.info.school_id', { defaultValue: 'School ID' })}</Text>
              <Text style={styles.infoValue}>{String(school).slice(0, 8)}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
