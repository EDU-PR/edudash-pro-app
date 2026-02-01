/**
 * usePaymentFlow Hook
 * Manages payment flow state and actions
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert, Share, Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { SchoolBankDetails } from '@/types/payments';
import { SA_BANKING_APPS, type BankApp } from '@/lib/payments/bankingApps';

// Lazy load IntentLauncher - prevents crashes if the module isn't available in OTA builds
let IntentLauncher: typeof import('expo-intent-launcher') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  IntentLauncher = require('expo-intent-launcher');
} catch {
  logger.debug('usePaymentFlow', 'expo-intent-launcher not available (needs rebuild)');
}

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
  availableBankApps: BankApp[];
  bankHint: string | null;
  copiedField: string | null;
  formattedAmount: string;
  paymentInitiated: boolean; // Track if user has clicked "Open Banking App"
  copyToClipboard: (text: string, field: string) => Promise<void>;
  openBankingApp: (bank?: BankApp) => Promise<void>;
  sharePaymentDetails: () => Promise<void>;
}

export function usePaymentFlow(params: PaymentFlowParams): UsePaymentFlowReturn {
  const { preschoolId, preschoolName, feeAmount, feeDescription, studentCode } = params;
  
  const [loading, setLoading] = useState(true);
  const [bankDetails, setBankDetails] = useState<SchoolBankDetails | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [availableBankApps, setAvailableBankApps] = useState<BankApp[]>([]);
  const [bankHint, setBankHint] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [paymentInitiated, setPaymentInitiated] = useState(false); // Track if banking app was opened

  // Parse amount from params
  const parsedAmount = feeAmount ? parseFloat(feeAmount) : 0;
  const formattedAmount = `R ${parsedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  // Fetch school bank details
  useEffect(() => {
    fetchBankDetails();
  }, [preschoolId]);

  useEffect(() => {
    let cancelled = false;

    const resolveAvailableBanks = async () => {
      const checks = await Promise.all(
        SA_BANKING_APPS.map(async (bank) => {
          for (const scheme of bank.schemes) {
            try {
              const canOpen = await Linking.canOpenURL(scheme);
              if (canOpen) return true;
            } catch (error) {
              logger.warn('usePaymentFlow', `Scheme check failed for ${scheme}`, error);
            }
          }
          return false;
        })
      );

      const available = SA_BANKING_APPS.filter((_, index) => checks[index]);
      if (!cancelled) {
        setAvailableBankApps(available);
      }
    };

    resolveAvailableBanks();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchBankDetails = async () => {
    if (!preschoolId) {
      console.log('[usePaymentFlow] No preschoolId provided, skipping bank details fetch');
      setLoading(false);
      return;
    }

    console.log('[usePaymentFlow] Fetching bank details for preschoolId:', preschoolId);

    try {
      const supabase = assertSupabase();
      
      // For preschools, the organization_id in organization_bank_accounts IS the preschool_id
      // (preschools use their own ID as the organization_id for bank accounts)
      
      // First try to get primary bank account using preschoolId as organization_id
      const { data: bankAccount, error: bankError } = await supabase
        .from('organization_bank_accounts')
        .select('*')
        .eq('organization_id', preschoolId)
        .eq('is_primary', true)
        .maybeSingle(); // Use maybeSingle to avoid error when no rows found

      console.log('[usePaymentFlow] Primary bank account query result:', { bankAccount, bankError });

      if (bankAccount) {
        setBankDetails({
          id: bankAccount.id,
          account_name: bankAccount.account_name,
          bank_name: bankAccount.bank_name,
          // Use FULL account number for payment flow - parents need the real number to make EFT
          account_number: bankAccount.account_number || bankAccount.account_number_masked || 'Contact school',
          branch_code: bankAccount.branch_code,
          swift_code: bankAccount.swift_code,
          account_type: bankAccount.account_type,
        });
        setLoading(false);
        return;
      }

      // Fallback - check for any active bank account (not marked as primary)
      const { data: anyAccounts, error: anyError } = await supabase
        .from('organization_bank_accounts')
        .select('*')
        .eq('organization_id', preschoolId)
        .eq('is_active', true)
        .limit(1);

      console.log('[usePaymentFlow] Any bank account query result:', { anyAccounts, anyError });

      if (anyAccounts && anyAccounts.length > 0) {
        const anyAccount = anyAccounts[0];
        setBankDetails({
          id: anyAccount.id,
          account_name: anyAccount.account_name,
          bank_name: anyAccount.bank_name,
          // Use FULL account number for payment flow - parents need the real number to make EFT
          account_number: anyAccount.account_number || anyAccount.account_number_masked || 'Contact school',
          branch_code: anyAccount.branch_code,
          swift_code: anyAccount.swift_code,
          account_type: anyAccount.account_type,
        });
        setLoading(false);
        return;
      }

      // Final fallback - try organization_payment_methods table
      const { data: paymentMethod, error: pmError } = await supabase
        .from('organization_payment_methods')
        .select('*')
        .eq('organization_id', preschoolId)
        .eq('method_name', 'bank_transfer')
        .maybeSingle();

      console.log('[usePaymentFlow] Payment methods query result:', { paymentMethod, pmError });

      if (paymentMethod) {
        setBankDetails({
          id: paymentMethod.id,
          account_name: paymentMethod.display_name || 'School Account',
          bank_name: paymentMethod.bank_name || 'Contact school for details',
          account_number: paymentMethod.account_number || 'Contact school',
          branch_code: paymentMethod.branch_code,
        });
      } else {
        console.log('[usePaymentFlow] No bank details found for preschoolId:', preschoolId);
      }
    } catch (error) {
      console.error('[usePaymentFlow] Error fetching bank details:', error);
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

  const tryOpenBankApp = useCallback(async (bank: BankApp): Promise<boolean> => {
    if (Platform.OS === 'android' && IntentLauncher) {
      for (const packageName of bank.packageIds) {
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
            packageName,
            category: 'android.intent.category.LAUNCHER',
          });
          logger.debug('usePaymentFlow', `Opened ${bank.name} via IntentLauncher: ${packageName}`);
          return true;
        } catch (error) {
          logger.warn('usePaymentFlow', `IntentLauncher failed for ${packageName}`, error);
        }
      }
    }

    for (const scheme of bank.schemes) {
      try {
        const canOpen = await Linking.canOpenURL(scheme);
        if (canOpen) {
          await Linking.openURL(scheme);
          logger.debug('usePaymentFlow', `Opened ${bank.name} via scheme: ${scheme}`);
          return true;
        }
      } catch (error) {
        logger.warn('usePaymentFlow', `Scheme open failed for ${scheme}`, error);
      }
    }

    return false;
  }, []);

  const openBankingApp = useCallback(async (bank?: BankApp) => {
    // Mark payment as initiated - enables Upload POP button
    setPaymentInitiated(true);
    setBankHint(null);

    if (bank) {
      const opened = await tryOpenBankApp(bank);
      if (!opened) {
        setBankHint(`Could not open ${bank.name}. Please open it manually.`);
      }
      return;
    }

    if (availableBankApps.length === 1) {
      const opened = await tryOpenBankApp(availableBankApps[0]);
      if (!opened) {
        setBankHint('We could not open your banking app. Please open it manually.');
      }
      return;
    }

    if (availableBankApps.length > 1) {
      setBankHint('Choose your bank below to open it.');
      return;
    }

    setBankHint('No banking apps detected. Please open your banking app manually.');
  }, [availableBankApps, tryOpenBankApp]);

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
    availableBankApps,
    bankHint,
    copiedField,
    formattedAmount,
    paymentInitiated,
    copyToClipboard,
    openBankingApp,
    sharePaymentDetails,
  };
}
