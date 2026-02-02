import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { assertSupabase } from '@/lib/supabase';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
export default function ChangePasswordScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { showAlert, alertProps } = useAlertModal();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [currentEmail, setCurrentEmail] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const loadCurrentEmail = async () => {
      try {
        const { data, error } = await assertSupabase().auth.getUser();
        if (error) throw error;
        setCurrentEmail(data.user?.email || '');
      } catch (err) {
        showAlert({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('account.change_password_load_failed', {
            defaultValue: 'Could not load your account. Please try again.',
          }),
          type: 'error',
          buttons: [{ text: t('common.ok', { defaultValue: 'OK' }), style: 'default' }],
        });
      } finally {
        setInitializing(false);
      }
    };

    loadCurrentEmail();
  }, [showAlert, t]);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('account.change_password_fill_all', { defaultValue: 'Please fill in all fields.' }),
        type: 'error',
        buttons: [{ text: t('common.ok', { defaultValue: 'OK' }), style: 'default' }],
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('auth.passwords_do_not_match', { defaultValue: 'Passwords do not match.' }),
        type: 'error',
        buttons: [{ text: t('common.ok', { defaultValue: 'OK' }), style: 'default' }],
      });
      return;
    }

    if (newPassword.length < 8) {
      showAlert({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('auth.password_too_short', { defaultValue: 'Password must be at least 8 characters long.' }),
        type: 'error',
        buttons: [{ text: t('common.ok', { defaultValue: 'OK' }), style: 'default' }],
      });
      return;
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      showAlert({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('auth.password_strength', {
          defaultValue: 'Password must include uppercase, lowercase, and a number.',
        }),
        type: 'error',
        buttons: [{ text: t('common.ok', { defaultValue: 'OK' }), style: 'default' }],
      });
      return;
    }

    if (!currentEmail) {
      showAlert({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('account.change_password_missing_email', {
          defaultValue: 'Unable to verify your account email. Please try again.',
        }),
        type: 'error',
        buttons: [{ text: t('common.ok', { defaultValue: 'OK' }), style: 'default' }],
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = assertSupabase();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });

      if (signInError) {
        throw signInError;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      await supabase.auth.updateUser({
        data: { password_changed_at: new Date().toISOString() },
      }).catch(() => undefined);

      showAlert({
        title: t('common.success', { defaultValue: 'Success' }),
        message: t('account.change_password_success', {
          defaultValue: 'Your password has been updated successfully.',
        }),
        type: 'success',
        buttons: [
          {
            text: t('common.ok', { defaultValue: 'OK' }),
            style: 'default',
            onPress: () => router.back(),
          },
        ],
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t('common.unexpected_error', { defaultValue: 'An unexpected error occurred.' });
      showAlert({
        title: t('common.error', { defaultValue: 'Error' }),
        message,
        type: 'error',
        buttons: [{ text: t('common.ok', { defaultValue: 'OK' }), style: 'default' }],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: t('account.change_password_title', { defaultValue: 'Change Password' }),
          headerShown: true,
          headerStyle: { backgroundColor: theme.surface },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
        }}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.iconRow}>
              <Ionicons name="lock-closed-outline" size={22} color={theme.primary} />
              <Text style={styles.heading}>
                {t('account.change_password_heading', { defaultValue: 'Update your password' })}
              </Text>
            </View>

            <Text style={styles.helper}>
              {t('account.change_password_helper', {
                defaultValue: 'Enter your current password, then choose a new one.',
              })}
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>
                {t('account.current_email', { defaultValue: 'Account Email' })}
              </Text>
              <View style={styles.readonlyInput}>
                {initializing ? (
                  <EduDashSpinner size="small" color={theme.primary} />
                ) : (
                  <Text style={styles.readonlyValue}>{currentEmail || '—'}</Text>
                )}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                {t('account.current_password', { defaultValue: 'Current Password' })}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder={t('account.current_password_placeholder', {
                    defaultValue: 'Enter current password',
                  })}
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showCurrent}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => setShowCurrent((prev) => !prev)}
                >
                  <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                {t('account.new_password', { defaultValue: 'New Password' })}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={t('account.new_password_placeholder', {
                    defaultValue: 'Create a new password',
                  })}
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => setShowNew((prev) => !prev)}
                >
                  <Ionicons name={showNew ? 'eye-off' : 'eye'} size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {newPassword.length > 0 && (
              <PasswordStrengthIndicator password={newPassword} userInfo={{ email: currentEmail || undefined }} />
            )}

            <View style={styles.field}>
              <Text style={styles.label}>
                {t('account.confirm_password', { defaultValue: 'Confirm New Password' })}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('account.confirm_password_placeholder', {
                    defaultValue: 'Re-enter new password',
                  })}
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => setShowConfirm((prev) => !prev)}
                >
                  <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading || initializing}
              activeOpacity={0.8}
            >
              {loading ? (
                <EduDashSpinner size="small" color={theme.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>
                  {t('account.change_password_cta', { defaultValue: 'Update Password' })}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      gap: 16,
    },
    iconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    heading: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
    },
    helper: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    field: {
      gap: 6,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    readonlyInput: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceVariant,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    readonlyValue: {
      fontSize: 16,
      color: theme.text,
    },
    inputRow: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBackground,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: theme.inputText,
      paddingVertical: 8,
    },
    toggleButton: {
      paddingHorizontal: 6,
      paddingVertical: 6,
    },
    button: {
      marginTop: 6,
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.onPrimary,
    },
  });
}
