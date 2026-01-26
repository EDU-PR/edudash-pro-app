/**
 * BankSelectionSheet - Bottom sheet modal for selecting SA banking apps
 * Uses proper deep linking with package visibility support
 */
import React from 'react';
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

// Lazy load IntentLauncher - will be null if not available (pre-rebuild)
// This prevents OTA crashes while still enabling the feature after rebuild
let IntentLauncher: typeof import('expo-intent-launcher') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  IntentLauncher = require('expo-intent-launcher');
} catch {
  console.log('[BankSelectionSheet] expo-intent-launcher not available (needs rebuild)');
}
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

// SA banking apps with deep links and package names
type BankApp = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  schemes: string[];
  packageIds: string[];
  fallbackUrl: string;
  marketUrl: string;
};

export const SA_BANKING_APPS: BankApp[] = [
  { 
    id: 'fnb', 
    name: 'FNB', 
    shortName: 'FNB',
    color: '#009639',
    schemes: ['fnbbanking://', 'fnb://'],
    packageIds: ['za.co.fnb.connect.itt'],
    fallbackUrl: 'https://www.fnb.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.fnb.connect.itt',
  },
  { 
    id: 'standard_bank', 
    name: 'Standard Bank', 
    shortName: 'SB',
    color: '#0033A0',
    schemes: ['standardbank://'],
    packageIds: ['com.standardbank.sb'],
    fallbackUrl: 'https://www.standardbank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=com.standardbank.sb',
  },
  { 
    id: 'absa', 
    name: 'ABSA', 
    shortName: 'ABSA',
    color: '#E31837',
    schemes: ['absabanking://', 'absa://'],
    packageIds: ['com.barclays.africa'],
    fallbackUrl: 'https://www.absa.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=com.barclays.africa',
  },
  { 
    id: 'nedbank', 
    name: 'Nedbank', 
    shortName: 'NED',
    color: '#007A4E',
    schemes: ['nedbankmoneyapp://', 'nedbank://'],
    packageIds: ['za.co.nedbank.nedbank'],
    fallbackUrl: 'https://www.nedbank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.nedbank.nedbank',
  },
  { 
    id: 'capitec', 
    name: 'Capitec', 
    shortName: 'CAP',
    color: '#E5173F',
    schemes: ['capitecbank://', 'capitec://'],
    packageIds: ['za.co.capitecbank.production', 'za.co.capitecbank'],
    fallbackUrl: 'https://www.capitecbank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.capitecbank.production',
  },
  { 
    id: 'tymebank', 
    name: 'TymeBank', 
    shortName: 'TYME',
    color: '#FF4B00',
    schemes: ['tymebank://'],
    packageIds: ['za.co.tymebank', 'za.co.tymebank.digital'],
    fallbackUrl: 'https://www.tymebank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.tymebank',
  },
  { 
    id: 'discovery', 
    name: 'Discovery Bank', 
    shortName: 'DISC',
    color: '#003366',
    schemes: ['discoverybank://', 'discovery://'],
    packageIds: ['com.discoverycoza', 'com.discovery.bank'],
    fallbackUrl: 'https://www.discovery.co.za/bank',
    marketUrl: 'https://play.google.com/store/apps/details?id=com.discoverycoza',
  },
  { 
    id: 'investec', 
    name: 'Investec', 
    shortName: 'INV',
    color: '#00205B',
    schemes: ['investec://'],
    packageIds: ['za.co.investec'],
    fallbackUrl: 'https://www.investec.com',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.investec',
  },
  { 
    id: 'african_bank', 
    name: 'African Bank', 
    shortName: 'AFB',
    color: '#00A651',
    schemes: ['africanbank://'],
    packageIds: ['za.co.africanbank.application', 'za.co.africanbank.myworld'],
    fallbackUrl: 'https://www.africanbank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.africanbank.application',
  },
];

interface BankSelectionSheetProps {
  visible: boolean;
  onClose: () => void;
  onBankSelected?: (bank: typeof SA_BANKING_APPS[0]) => void;
}

export function BankSelectionSheet({ visible, onClose, onBankSelected }: BankSelectionSheetProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

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
      console.log(`📱 Scheme open failed for ${scheme}:`, error);
    }
    return false;
  };

  const tryOpenPackage = async (packageName: string) => {
    if (Platform.OS !== 'android' || !IntentLauncher) return false;
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction?.MAIN ?? 'android.intent.action.MAIN',
        {
          packageName,
          category: IntentLauncher.ActivityCategory?.LAUNCHER ?? 'android.intent.category.LAUNCHER',
        }
      );
      return true;
    } catch (error) {
      console.log(`📱 IntentLauncher failed for ${packageName}:`, error);
      return false;
    }
  };

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
            console.log(`✅ Opened ${bank.name} via IntentLauncher: ${packageName}`);
            return;
          }
        }
      }

      for (const scheme of bank.schemes) {
        const opened = await tryOpenScheme(scheme);
        if (opened) {
          console.log(`✅ Opened ${bank.name} via scheme: ${scheme}`);
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
      console.error('Error opening banking app:', error);
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
      style={[styles.bankItem, { backgroundColor: theme.surface }]}
      onPress={() => handleBankPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.bankIcon, { backgroundColor: item.color }]}>
        <Text style={[styles.bankInitial, { fontSize: getBadgeFontSize(item.shortName) }]}>
          {item.shortName}
        </Text>
      </View>
      <Text style={[styles.bankName, { color: theme.text }]}>{item.name}</Text>
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
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
              {t('payments.select_bank', { defaultValue: 'Select Your Bank' })}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t('payments.select_bank_desc', { defaultValue: 'Choose your bank to open their app' })}
            </Text>
          </View>

          {/* Bank list */}
          <FlatList
            data={SA_BANKING_APPS}
            renderItem={renderBankItem}
            keyExtractor={item => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No banking apps available
                </Text>
              </View>
            )}
            initialNumToRender={10}
            getItemLayout={(data, index) => ({
              length: 66, // bankItem height (44 + 14*2 padding) + marginBottom 8
              offset: 66 * index,
              index,
            })}
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  bankIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bankInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  bankName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
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
