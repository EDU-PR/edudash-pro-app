/**
 * ProfileSwitcher - Multi-account switcher component
 * 
 * Allows users to switch between stored biometric accounts without signing out.
 * Uses EnhancedBiometricAuth for multi-account storage and session restoration.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { EnhancedBiometricAuth } from '@/services/EnhancedBiometricAuth';
import { BiometricAuthService } from '@/services/BiometricAuthService';
import { router } from 'expo-router';
import { track } from '@/lib/analytics';

export interface StoredAccount {
  userId: string;
  email: string;
  lastUsed: string;
  expiresAt: string;
  isActive?: boolean;
}

interface ProfileSwitcherProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback after successful account switch */
  onAccountSwitched?: (account: StoredAccount) => void;
  /** Show "Add Account" button */
  showAddAccount?: boolean;
}

export function ProfileSwitcher({
  visible,
  onClose,
  onAccountSwitched,
  showAddAccount = true,
}: ProfileSwitcherProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();

  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Load stored biometric accounts
  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      
      // Check biometric availability
      const capabilities = await BiometricAuthService.checkCapabilities();
      setBiometricAvailable(capabilities.isAvailable && capabilities.isEnrolled);

      // Get stored accounts
      const storedAccounts = await EnhancedBiometricAuth.getBiometricAccounts();
      
      // Mark current user as active
      const accountsWithActive = storedAccounts.map(acc => ({
        ...acc,
        isActive: acc.userId === user?.id,
      }));

      // Sort: active first, then by last used
      accountsWithActive.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
      });

      setAccounts(accountsWithActive);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (visible) {
      loadAccounts();
    }
  }, [visible, loadAccounts]);

  // Switch to a different account
  const handleSwitchAccount = useCallback(async (account: StoredAccount) => {
    if (account.isActive) {
      onClose();
      return;
    }

    try {
      setSwitching(account.userId);
      
      track('account.switch_attempt', {
        from_user_id: user?.id,
        to_user_id: account.userId,
      });

      // Authenticate with biometrics and restore session
      const result = await EnhancedBiometricAuth.authenticateWithBiometricForUser(account.userId);

      if (!result.success) {
        Alert.alert(
          t('account.switch_failed', { defaultValue: 'Switch Failed' }),
          result.error || t('account.biometric_failed', { defaultValue: 'Biometric authentication failed' }),
          [{ text: t('common.ok', { defaultValue: 'OK' }) }]
        );
        return;
      }

      track('account.switch_success', {
        from_user_id: user?.id,
        to_user_id: account.userId,
        session_restored: result.sessionRestored,
      });

      onClose();
      onAccountSwitched?.(account);

      // Refresh profile to update UI
      if (result.sessionRestored) {
        await refreshProfile();
        
        // Navigate to home to reload dashboard with new user
        if (Platform.OS === 'web') {
          // Force reload on web for clean state
          (globalThis as any)?.location?.reload?.();
        } else {
          router.replace('/(tabs)');
        }
      } else {
        // Session couldn't be restored - need to sign in again
        Alert.alert(
          t('account.session_expired', { defaultValue: 'Session Expired' }),
          t('account.session_expired_message', { defaultValue: 'Please sign in again to continue.' }),
          [{
            text: t('common.ok', { defaultValue: 'OK' }),
            onPress: () => router.replace('/(auth)/sign-in'),
          }]
        );
      }
    } catch (error) {
      console.error('Account switch error:', error);
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('account.switch_error', { defaultValue: 'Failed to switch account. Please try again.' })
      );
    } finally {
      setSwitching(null);
    }
  }, [user?.id, onClose, onAccountSwitched, refreshProfile, t]);

  // Remove an account from stored list
  const handleRemoveAccount = useCallback(async (account: StoredAccount) => {
    if (account.isActive) {
      Alert.alert(
        t('account.cannot_remove_active', { defaultValue: 'Cannot Remove' }),
        t('account.cannot_remove_active_message', { defaultValue: 'You cannot remove the currently active account.' })
      );
      return;
    }

    Alert.alert(
      t('account.remove_account', { defaultValue: 'Remove Account' }),
      t('account.remove_account_confirm', { 
        defaultValue: `Remove ${account.email} from quick switch? You can add it back by signing in again.`,
        email: account.email 
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.remove', { defaultValue: 'Remove' }),
          style: 'destructive',
          onPress: async () => {
            try {
              await EnhancedBiometricAuth.removeBiometricSession(account.userId);
              track('account.removed_from_switcher', { user_id: account.userId });
              loadAccounts();
            } catch (error) {
              console.error('Failed to remove account:', error);
            }
          },
        },
      ]
    );
  }, [t, loadAccounts]);

  // Add new account (sign out and go to sign in)
  const handleAddAccount = useCallback(() => {
    onClose();
    router.push('/(auth)/sign-in?switch=1');
  }, [onClose]);

  // Format last used date
  const formatLastUsed = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('time.just_now', { defaultValue: 'Just now' });
    if (diffMins < 60) return t('time.minutes_ago', { defaultValue: '{{count}} min ago', count: diffMins });
    if (diffHours < 24) return t('time.hours_ago', { defaultValue: '{{count}}h ago', count: diffHours });
    if (diffDays < 7) return t('time.days_ago', { defaultValue: '{{count}}d ago', count: diffDays });
    return date.toLocaleDateString();
  };

  // Get initials from email
  const getInitials = (email: string): string => {
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const renderAccountItem = ({ item }: { item: StoredAccount }) => {
    const isSwitching = switching === item.userId;
    
    return (
      <TouchableOpacity
        style={[
          styles.accountItem,
          { backgroundColor: theme.surface },
          item.isActive && { borderColor: theme.primary, borderWidth: 2 },
        ]}
        onPress={() => handleSwitchAccount(item)}
        onLongPress={() => handleRemoveAccount(item)}
        disabled={isSwitching}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={[styles.accountAvatar, { backgroundColor: theme.primary + '30' }]}>
          <Text style={[styles.avatarText, { color: theme.primary }]}>
            {getInitials(item.email)}
          </Text>
        </View>

        {/* Account Info */}
        <View style={styles.accountInfo}>
          <Text style={[styles.accountEmail, { color: theme.text }]} numberOfLines={1}>
            {item.email}
          </Text>
          <Text style={[styles.accountMeta, { color: theme.textSecondary }]}>
            {item.isActive 
              ? t('account.active_now', { defaultValue: 'Active now' })
              : formatLastUsed(item.lastUsed)
            }
          </Text>
        </View>

        {/* Status indicator */}
        {isSwitching ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : item.isActive ? (
          <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {t('account.no_accounts', { defaultValue: 'No Saved Accounts' })}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {biometricAvailable
          ? t('account.enable_biometric_hint', { defaultValue: 'Enable biometric login to quickly switch between accounts' })
          : t('account.biometric_not_available', { defaultValue: 'Set up biometrics on your device to use quick account switching' })
        }
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdropTouchable} onPress={onClose} activeOpacity={1} />
        
        <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom }]}>
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: theme.textSecondary + '40' }]} />
          </View>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              {t('account.switch_account', { defaultValue: 'Switch Account' })}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t('account.switch_account_desc', { defaultValue: 'Quick switch with biometric authentication' })}
            </Text>
          </View>

          {/* Account list */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : accounts.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={accounts}
              renderItem={renderAccountItem}
              keyExtractor={item => item.userId}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Add account button */}
          {showAddAccount && (
            <TouchableOpacity
              style={[styles.addAccountButton, { backgroundColor: theme.surface }]}
              onPress={handleAddAccount}
            >
              <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
              <Text style={[styles.addAccountText, { color: theme.primary }]}>
                {t('account.add_account', { defaultValue: 'Add Another Account' })}
              </Text>
            </TouchableOpacity>
          )}

          {/* Cancel button */}
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.surface }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelText, { color: theme.text }]}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Text>
          </TouchableOpacity>

          {/* Help text for long press */}
          {accounts.length > 1 && (
            <Text style={[styles.helpText, { color: theme.textSecondary }]}>
              {t('account.long_press_hint', { defaultValue: 'Long press an account to remove it' })}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  accountInfo: {
    flex: 1,
  },
  accountEmail: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  accountMeta: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addAccountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: 8,
  },
});

export default ProfileSwitcher;
