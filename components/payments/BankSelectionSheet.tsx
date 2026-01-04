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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

// SA banking apps with deep links and package names
export const SA_BANKING_APPS = [
  { 
    id: 'fnb', 
    name: 'FNB', 
    color: '#009639',
    scheme: 'fnbbanking://',
    playStoreId: 'za.co.fnb.connect.itt',
    fallbackUrl: 'https://www.fnb.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.fnb.connect.itt',
  },
  { 
    id: 'standard_bank', 
    name: 'Standard Bank', 
    color: '#0033A0',
    scheme: 'standardbank://',
    playStoreId: 'com.standardbank.sb',
    fallbackUrl: 'https://www.standardbank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=com.standardbank.sb',
  },
  { 
    id: 'absa', 
    name: 'ABSA', 
    color: '#E31837',
    scheme: 'absabanking://',
    playStoreId: 'com.barclays.africa',
    fallbackUrl: 'https://www.absa.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=com.barclays.africa',
  },
  { 
    id: 'nedbank', 
    name: 'Nedbank', 
    color: '#007A4E',
    scheme: 'nedbankmoneyapp://',
    playStoreId: 'za.co.nedbank.nedbank',
    fallbackUrl: 'https://www.nedbank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.nedbank.nedbank',
  },
  { 
    id: 'capitec', 
    name: 'Capitec', 
    color: '#E5173F',
    scheme: 'capitecbank://',
    playStoreId: 'za.co.capitecbank.production',
    fallbackUrl: 'https://www.capitecbank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.capitecbank.production',
  },
  { 
    id: 'tymebank', 
    name: 'TymeBank', 
    color: '#FF4B00',
    scheme: 'tymebank://',
    playStoreId: 'za.co.tymebank',
    fallbackUrl: 'https://www.tymebank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.tymebank',
  },
  { 
    id: 'discovery', 
    name: 'Discovery Bank', 
    color: '#003366',
    scheme: 'discoverybank://',
    playStoreId: 'com.discoverycoza',
    fallbackUrl: 'https://www.discovery.co.za/bank',
    marketUrl: 'https://play.google.com/store/apps/details?id=com.discoverycoza',
  },
  { 
    id: 'investec', 
    name: 'Investec', 
    color: '#00205B',
    scheme: 'investec://',
    playStoreId: 'za.co.investec',
    fallbackUrl: 'https://www.investec.com',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.investec',
  },
  { 
    id: 'african_bank', 
    name: 'African Bank', 
    color: '#00A651',
    scheme: 'africanbank://',
    playStoreId: 'za.co.africanbank.application',
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

  const handleBankPress = async (bank: typeof SA_BANKING_APPS[0]) => {
    onClose();
    onBankSelected?.(bank);
    
    try {
      // On Android, canOpenURL is unreliable for custom schemes even with queries declared
      // Instead, try to open directly and catch the error
      
      // First try: Open via Play Store intent (most reliable on Android)
      // This opens the app if installed, or shows Play Store page if not
      const playStoreIntent = `market://details?id=${bank.playStoreId}`;
      const playStoreWeb = bank.marketUrl;
      
      // Try opening the app directly first
      try {
        await Linking.openURL(bank.scheme);
        console.log(`✅ Opened ${bank.name} via scheme: ${bank.scheme}`);
        return;
      } catch (schemeError) {
        console.log(`📱 ${bank.name} scheme failed, trying alternatives...`);
      }

      // If scheme failed, offer options to user
      Alert.alert(
        bank.name,
        t('payments.open_bank_options', { 
          defaultValue: `How would you like to open ${bank.name}?` 
        }),
        [
          {
            text: t('payments.open_app_store', { defaultValue: 'Open in Play Store' }),
            onPress: async () => {
              try {
                await Linking.openURL(playStoreIntent);
              } catch {
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
      Linking.openURL(bank.fallbackUrl);
    }
  };

  const renderBankItem = ({ item }: { item: typeof SA_BANKING_APPS[0] }) => (
    <TouchableOpacity
      style={[styles.bankItem, { backgroundColor: theme.surface }]}
      onPress={() => handleBankPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.bankIcon, { backgroundColor: item.color }]}>
        <Text style={styles.bankInitial}>{item.name.charAt(0)}</Text>
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
