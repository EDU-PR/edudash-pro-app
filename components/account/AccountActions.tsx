import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { signOutAndRedirect } from '@/lib/authActions';
import type { ViewStyle, TextStyle } from 'react-native';

interface AccountActionsProps {
  theme: {
    surfaceVariant: string;
    primary: string;
    onError: string;
  };
  styles: {
    infoSection: ViewStyle;
    sectionTitle: TextStyle;
    signOutButton: ViewStyle;
    signOutText: TextStyle;
  };
}

export function AccountActions({ theme, styles }: AccountActionsProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.infoSection}>
      <Text style={styles.sectionTitle}>{t('account.account_actions', { defaultValue: 'Account Actions' })}</Text>
      
      <TouchableOpacity
        onPress={() => signOutAndRedirect({ clearBiometrics: false, redirectTo: '/(auth)/sign-in?switch=1' })}
        style={[styles.signOutButton, { 
          backgroundColor: theme.surfaceVariant, 
          borderWidth: 2,
          borderColor: theme.primary,
          shadowColor: theme.primary,
        }]}
        activeOpacity={0.7}
      >
        <Ionicons name="swap-horizontal" size={22} color={theme.primary} />
        <Text style={[styles.signOutText, { color: theme.primary }]}>{t('navigation.switch_account', { defaultValue: 'Switch Account' })}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => signOutAndRedirect({ clearBiometrics: false, redirectTo: '/(auth)/sign-in' })}
        style={styles.signOutButton}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={22} color={theme.onError} />
        <Text style={styles.signOutText}>{t('navigation.logout', { defaultValue: 'Sign Out' })}</Text>
      </TouchableOpacity>
    </View>
  );
}
