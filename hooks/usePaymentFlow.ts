/**
 * usePaymentFlow Hook
 * Manages payment flow state and actions
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert, Linking, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { assertSupabase } from '@/lib/supabase';
import type { SchoolBankDetails } from '@/types/payments';

interface PaymentFlowParams {
  feeId?: string;
  feeDescription?: string;
  feeAmount?: string;
  childId?: string;
  childName?: string;
  studentCode?: string;
  preschoolId?: string;
  preschoolName?: string;
}

interface UsePaymentFlowReturn {
  loading: boolean;
  bankDetails: SchoolBankDetails | null;
  showUploadModal: boolean;
  setShowUploadModal: (show: boolean) => void;
  copiedField: string | null;
  formattedAmount: string;
  copyToClipboard: (text: string, field: string) => Promise<void>;
  openBankingApp: () => Promise<void>;
  sharePaymentDetails: () => Promise<void>;
}

// SA banking app schemes
const BANKING_APPS = [
  { name: 'FNB', scheme: 'fnb://', playStoreId: 'za.co.fnb.connect.itt', fallbackUrl: 'https://www.fnb.co.za' },
  { name: 'Standard Bank', scheme: 'standardbank://', playStoreId: 'com.standardbank.sb', fallbackUrl: 'https://www.standardbank.co.za' },
  { name: 'ABSA', scheme: 'absa://', playStoreId: 'com.barclays.africa', fallbackUrl: 'https://www.absa.co.za' },
  { name: 'Nedbank', scheme: 'nedbank://', playStoreId: 'za.co.nedbank.nedbank', fallbackUrl: 'https://www.nedbank.co.za' },
  { name: 'Capitec', scheme: 'capitec://', playStoreId: 'za.co.capitec', fallbackUrl: 'https://www.capitecbank.co.za' },
  { name: 'TymeBank', scheme: 'tymebank://', playStoreId: 'za.co.tymebank.digital', fallbackUrl: 'https://www.tymebank.co.za' },
  { name: 'Discovery Bank', scheme: 'discovery://', playStoreId: 'com.discovery.bank', fallbackUrl: 'https://www.discovery.co.za/bank' },
  { name: 'African Bank', scheme: 'africanbank://', playStoreId: 'za.co.africanbank.myworld', fallbackUrl: 'https://www.africanbank.co.za' },
];

export function usePaymentFlow(params: PaymentFlowParams): UsePaymentFlowReturn {
  const { preschoolId, preschoolName, feeAmount, feeDescription, studentCode } = params;
  
  const [loading, setLoading] = useState(true);
  const [bankDetails, setBankDetails] = useState<SchoolBankDetails | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Parse amount from params
  const parsedAmount = feeAmount ? parseFloat(feeAmount) : 0;
  const formattedAmount = `R ${parsedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  // Fetch school bank details
  useEffect(() => {
    fetchBankDetails();
  }, [preschoolId]);

  const fetchBankDetails = async () => {
    if (!preschoolId) {
      setLoading(false);
      return;
    }

    try {
      const supabase = assertSupabase();
      
      // First get organization_id from preschool
      const { data: preschool } = await supabase
        .from('preschools')
        .select('organization_id, name')
        .eq('id', preschoolId)
        .single();

      if (!preschool?.organization_id) {
        // Try to get bank details from payment_methods
        const { data: paymentMethod } = await supabase
          .from('payment_methods')
          .select('*')
          .eq('preschool_id', preschoolId)
          .eq('method_name', 'bank_transfer')
          .single();

        if (paymentMethod) {
          setBankDetails({
            id: paymentMethod.id,
            account_name: paymentMethod.display_name || preschool?.name || 'School Account',
            bank_name: paymentMethod.bank_name || 'Contact school for details',
            account_number: paymentMethod.account_number || 'Contact school',
            branch_code: paymentMethod.branch_code,
          });
        }
        setLoading(false);
        return;
      }

      // Get organization bank account
      const { data: bankAccount } = await supabase
        .from('organization_bank_accounts')
        .select('*')
        .eq('organization_id', preschool.organization_id)
        .eq('is_primary', true)
        .single();

      if (bankAccount) {
        setBankDetails({
          id: bankAccount.id,
          account_name: bankAccount.account_name,
          bank_name: bankAccount.bank_name,
          account_number: bankAccount.account_number_masked || 'Contact school',
          branch_code: bankAccount.branch_code,
          swift_code: bankAccount.swift_code,
          account_type: bankAccount.account_type,
        });
      } else {
        // Fallback - check for any bank account
        const { data: anyAccount } = await supabase
          .from('organization_bank_accounts')
          .select('*')
          .eq('organization_id', preschool.organization_id)
          .eq('is_active', true)
          .limit(1)
          .single();

        if (anyAccount) {
          setBankDetails({
            id: anyAccount.id,
            account_name: anyAccount.account_name,
            bank_name: anyAccount.bank_name,
            account_number: anyAccount.account_number_masked || 'Contact school',
            branch_code: anyAccount.branch_code,
            swift_code: anyAccount.swift_code,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching bank details:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  }, []);

  const openBankingApp = useCallback(async () => {
    // First, check which banking apps are installed
    const installedApps: typeof BANKING_APPS = [];
    const notInstalledApps: typeof BANKING_APPS = [];
    
    for (const app of BANKING_APPS) {
      try {
        const canOpen = await Linking.canOpenURL(app.scheme);
        if (canOpen) {
          installedApps.push(app);
        } else {
          notInstalledApps.push(app);
        }
      } catch {
        notInstalledApps.push(app);
      }
    }
    
    // If we found installed apps, show only those first
    if (installedApps.length > 0) {
      Alert.alert(
        'Open Banking App',
        'Select your installed banking app:',
        [
          ...installedApps.map(app => ({
            text: app.name,
            onPress: async () => {
              try {
                await Linking.openURL(app.scheme);
              } catch (error) {
                console.error('Error opening banking app:', error);
                // Fallback to website
                Linking.openURL(app.fallbackUrl);
              }
            },
          })),
          {
            text: 'Other Banks',
            onPress: () => showAllBanksDialog(notInstalledApps),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      // No apps detected, show all options
      showAllBanksDialog(BANKING_APPS);
    }
  }, []);
  
  const showAllBanksDialog = useCallback((banks: typeof BANKING_APPS) => {
    Alert.alert(
      'Select Your Bank',
      'Choose your bank to open their website or app store:',
      [
        ...banks.slice(0, 5).map(app => ({
          text: app.name,
          onPress: async () => {
            try {
              const canOpen = await Linking.canOpenURL(app.scheme);
              if (canOpen) {
                await Linking.openURL(app.scheme);
              } else {
                // Offer to open Play Store or website
                Alert.alert(
                  `${app.name} Not Installed`,
                  'Would you like to:',
                  [
                    { 
                      text: 'Open Website', 
                      onPress: () => Linking.openURL(app.fallbackUrl)
                    },
                    { 
                      text: 'Get App', 
                      onPress: () => Linking.openURL(`market://details?id=${app.playStoreId}`)
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }
            } catch (error) {
              console.error('Error:', error);
              Linking.openURL(app.fallbackUrl);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  const sharePaymentDetails = useCallback(async () => {
    const paymentRef = studentCode || 'N/A';
    const message = `Payment Details for ${preschoolName || 'School'}

Amount: ${formattedAmount}
Reference: ${paymentRef}
For: ${feeDescription || 'School Fees'}

Bank Details:
Bank: ${bankDetails?.bank_name || 'N/A'}
Account Name: ${bankDetails?.account_name || 'N/A'}
Account Number: ${bankDetails?.account_number || 'N/A'}
Branch Code: ${bankDetails?.branch_code || 'N/A'}

Please use the reference number when making payment.`;

    try {
      await Share.share({
        message,
        title: 'Payment Details',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [preschoolName, formattedAmount, studentCode, feeDescription, bankDetails]);

  return {
    loading,
    bankDetails,
    showUploadModal,
    setShowUploadModal,
    copiedField,
    formattedAmount,
    copyToClipboard,
    openBankingApp,
    sharePaymentDetails,
  };
}
