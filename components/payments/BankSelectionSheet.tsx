/**
 * BankSelectionSheet - Bottom sheet modal for selecting SA banking apps
 * Uses proper deep linking with package visibility support
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logger } from '@/lib/logger';
import { SA_BANKING_APPS, type BankApp } from '@/lib/payments/bankingApps';

// Lazy load IntentLauncher - will be null if not available (pre-rebuild)
// This prevents OTA crashes while still enabling the feature after rebuild
let IntentLauncher: typeof import('expo-intent-launcher') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  IntentLauncher = require('expo-intent-launcher');
} catch {
  logger.debug('BankSelectionSheet', 'expo-intent-launcher not available (needs rebuild)');
}
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

export { SA_BANKING_APPS };

interface BankSelectionSheetProps {
  visible: boolean;
  onClose: () => void;
  onBankSelected?: (bank: BankApp) => void;
  autoOpenHomeScreen?: boolean;
}

export function BankSelectionSheet({
  visible,
  onClose,
  onBankSelected,
  autoOpenHomeScreen = false,
}: BankSelectionSheetProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const autoLaunchRef = useRef(false);

  const getBadgeFontSize = (label: string) => {
    if (label.length <= 2) return 18;
    if (label.length === 3) return 14;
    return 12;
  };

  const tryOpenScheme = async (scheme: string) => {
    try {
      const canOpen = await Linking.canOpenURL(scheme);
      if (canOpen) {
        await Linking.openURL(scheme);
        return true;
      }
    } catch (error) {
      logger.warn('BankSelectionSheet', `Scheme open failed for ${scheme}`, error);
    }
    return false;
  };

  const tryOpenPackage = async (packageName: string) => {
    if (Platform.OS !== 'android' || !IntentLauncher) return false;
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
        packageName,
        category: 'android.intent.category.LAUNCHER',
      });
      return true;
    } catch (error) {
      logger.warn('BankSelectionSheet', `IntentLauncher failed for ${packageName}`, error);
      return false;
    }
  };

  const openHomeScreen = async () => {
    if (Platform.OS !== 'android' || !IntentLauncher) return false;
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
        category: 'android.intent.category.HOME',
      });
      return true;
    } catch (error) {
      logger.warn('BankSelectionSheet', 'Failed to open home screen', error);
      return false;
    }
  };

  const handleOpenHomeScreen = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        t('payments.open_bank_app', { defaultValue: 'Open Banking App' }),
        t('payments.open_bank_app_ios', {
          defaultValue: 'Please return to your home screen and open your banking app.',
        })
      );
      return;
    }

    if (!IntentLauncher) {
      Alert.alert(
        t('payments.update_required', { defaultValue: 'Update Required' }),
        t('payments.bank_launcher_unavailable', {
          defaultValue: 'This feature needs the latest app update. Please update and try again.',
        })
      );
      return;
    }

    const opened = await openHomeScreen();
    if (opened) {
      onClose();
      return;
    }

    Alert.alert(
      t('payments.open_bank_app', { defaultValue: 'Open Banking App' }),
      t('payments.open_bank_app_failed', {
        defaultValue: 'Could not open your home screen. Please select a bank from the list.',
      })
    );
  };

  useEffect(() => {
    if (!visible) {
      autoLaunchRef.current = false;
      return;
    }
    if (!autoOpenHomeScreen || autoLaunchRef.current) return;
    autoLaunchRef.current = true;
    handleOpenHomeScreen();
  }, [visible, autoOpenHomeScreen]);

  const handleBankPress = async (bank: BankApp) => {
    onClose();
    onBankSelected?.(bank);
    
    const playStoreWeb = bank.marketUrl;
    const primaryPackage = bank.packageIds[0];
    
    try {
      if (Platform.OS === 'android' && IntentLauncher) {
        for (const packageName of bank.packageIds) {
          const opened = await tryOpenPackage(packageName);
          if (opened) {
            logger.debug('BankSelectionSheet', `Opened ${bank.name} via IntentLauncher: ${packageName}`);
            return;
          }
        }
      }

      for (const scheme of bank.schemes) {
        const opened = await tryOpenScheme(scheme);
        if (opened) {
          logger.debug('BankSelectionSheet', `Opened ${bank.name} via scheme: ${scheme}`);
          return;
        }
      }

      // If app couldn't be opened, ask user what to do
      Alert.alert(
        bank.name,
        t('payments.app_not_installed', { 
          bankName: bank.name,
          defaultValue: `${bank.name} app doesn't seem to be installed. What would you like to do?` 
        }),
        [
          {
            text: Platform.OS === 'android' 
              ? t('payments.open_play_store', { defaultValue: 'Open Play Store' })
              : t('payments.open_app_store', { defaultValue: 'Open App Store' }),
            onPress: async () => {
              try {
                if (Platform.OS === 'android') {
                  // Use market:// intent for Play Store
                  if (primaryPackage) {
                    await Linking.openURL(`market://details?id=${primaryPackage}`);
                  } else {
                    await Linking.openURL(playStoreWeb);
                  }
                } else {
                  await Linking.openURL(playStoreWeb);
                }
              } catch {
                // Fallback to web URL
                await Linking.openURL(playStoreWeb);
              }
            },
          },
          {
            text: t('payments.open_website', { defaultValue: 'Open Website' }),
            onPress: () => Linking.openURL(bank.fallbackUrl),
          },
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        ]
      );
    } catch (error) {
      logger.error('BankSelectionSheet', 'Error opening banking app', error);
      // Ultimate fallback to website
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('payments.error_opening_bank', { 
          defaultValue: 'Could not open the banking app. Opening website instead.' 
        }),
        [
          { 
            text: t('common.ok', { defaultValue: 'OK' }), 
            onPress: () => Linking.openURL(bank.fallbackUrl) 
          }
        ]
      );
    }
  };

  const renderBankItem = ({ item }: { item: BankApp }) => (
    <TouchableOpacity
      style={[styles.bankTile, { backgroundColor: theme.surface }]}
      onPress={() => handleBankPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.bankBadge, { backgroundColor: item.color }]}>
        <Text style={[styles.bankBadgeText, { fontSize: getBadgeFontSize(item.shortName) }]}>
          {item.shortName}
        </Text>
      </View>
      <Text style={[styles.bankTileLabel, { color: theme.text }]} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
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
              {t('payments.select_bank', { defaultValue: 'Banking Apps' })}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t('payments.select_bank_desc', { defaultValue: 'Open your banking app to complete payment' })}
            </Text>
          </View>

          {/* Quick action */}
          <View style={styles.quickActionContainer}>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: theme.surface }]}
              onPress={handleOpenHomeScreen}
              activeOpacity={0.85}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="apps-outline" size={18} color={theme.primary} />
              </View>
              <View style={styles.quickActionText}>
                <Text style={[styles.quickActionTitle, { color: theme.text }]}>
                  {t('payments.open_home_screen', { defaultValue: 'Open Home Screen' })}
                </Text>
                <Text style={[styles.quickActionSubtitle, { color: theme.textSecondary }]}>
                  {t('payments.open_home_screen_desc', { defaultValue: 'Pick your banking app from your device' })}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Bank list */}
          <FlatList
            data={SA_BANKING_APPS}
            renderItem={renderBankItem}
            keyExtractor={item => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            numColumns={3}
            columnWrapperStyle={styles.gridRow}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No banking apps available
                </Text>
              </View>
            )}
            initialNumToRender={10}
          />

          {/* Cancel button */}
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.surface }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelText, { color: theme.text }]}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Text>
          </TouchableOpacity>
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
    maxHeight: '80%',
    minHeight: 400,
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
  quickActionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  bankTile: {
    flex: 1,
    margin: 6,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 118,
  },
  bankBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankBadgeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  bankTileLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
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
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
