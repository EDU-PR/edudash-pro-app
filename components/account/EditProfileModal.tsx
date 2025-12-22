import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ViewStyle, TextStyle } from 'react-native';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  firstName: string;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  theme: {
    primary: string;
    error: string;
    text: string;
    textTertiary: string;
  };
  styles: {
    editModalContainer: ViewStyle;
    editModalHeader: ViewStyle;
    editModalCancel: TextStyle;
    editModalTitle: TextStyle;
    editModalSave: TextStyle;
    editModalContent: ViewStyle;
    editSection: ViewStyle;
    editSectionTitle: TextStyle;
    editFieldContainer: ViewStyle;
    editFieldLabel: TextStyle;
    editFieldInput: TextStyle;
  };
}

export function EditProfileModal({
  visible,
  onClose,
  onSave,
  saving,
  firstName,
  lastName,
  onFirstNameChange,
  onLastNameChange,
  theme,
  styles,
}: EditProfileModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.editModalContainer}>
        <View style={styles.editModalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.editModalCancel}>{t('navigation.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.editModalTitle}>{t('account.edit.title', { defaultValue: 'Edit Profile' })}</Text>
          <TouchableOpacity
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={theme.primary} size="small" />
            ) : (
              <Text style={styles.editModalSave}>{t('navigation.save')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.editModalContent}>
          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>{t('account.edit.personal_information', { defaultValue: 'Personal Information' })}</Text>

            <View style={styles.editFieldContainer}>
              <Text style={styles.editFieldLabel}>{t('auth.firstName', { defaultValue: 'First Name' })}</Text>
              <TextInput
                style={styles.editFieldInput}
                value={firstName}
                onChangeText={onFirstNameChange}
                placeholder={t('account.placeholders.first_name', { defaultValue: 'Enter your first name' })}
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.editFieldContainer}>
              <Text style={styles.editFieldLabel}>{t('auth.lastName', { defaultValue: 'Last Name' })}</Text>
              <TextInput
                style={styles.editFieldInput}
                value={lastName}
                onChangeText={onLastNameChange}
                placeholder={t('account.placeholders.last_name', { defaultValue: 'Enter your last name' })}
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="words"
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
