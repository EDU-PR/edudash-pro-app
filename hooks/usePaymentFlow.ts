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
import { SA_BANKING_APPS, type BankApp, type ResolvedBankApp } from '@/lib/payments/bankingApps';

// Lazy load IntentLauncher - prevents crashes if the module isn't available in OTA builds
let IntentLauncher: typeof import('expo-intent-launcher') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  IntentLauncher = require('expo-intent-launcher');
} catch {
  logger.debug('usePaymentFlow', 'expo-intent-launcher not available (needs rebuild)');
}

type LaunchState = 'idle' | 'launched' | 'manual_confirmed';
type LaunchMethod = 'package' | 'scheme';

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
  bankApps: ResolvedBankApp[];
  bankHint: string | null;
  copiedField: string | null;
  formattedAmount: string;
  launchState: LaunchState;
  canUploadProof: boolean;
  copyToClipboard: (text: string, field: string) => Promise<void>;
  openBankingApp: (bank?: BankApp) => Promise<void>;
  confirmManualPayment: () => void;
  sharePaymentDetails: () => Promise<void>;
}

type LaunchAttemptResult = {
  opened: boolean;
  method?: LaunchMethod;
};

export function usePaymentFlow(params: PaymentFlowParams): UsePaymentFlowReturn {
  const { preschoolId, preschoolName, feeAmount, feeDescription, studentCode } = params;

  const [loading, setLoading] = useState(true);
  const [bankDetails, setBankDetails] = useState<SchoolBankDetails | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [bankApps, setBankApps] = useState<ResolvedBankApp[]>(
    SA_BANKING_APPS.map((bank) => ({ ...bank, detected: false }))
  );
  const [bankHint, setBankHint] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [launchState, setLaunchState] = useState<LaunchState>('idle');

  // Parse amount from params
  const parsedAmount = feeAmount ? parseFloat(feeAmount) : 0;
  const formattedAmount = `R ${parsedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  const canUploadProof = launchState !== 'idle';

  // Fetch school bank details
  useEffect(() => {
    fetchBankDetails();
  }, [preschoolId]);

  useEffect(() => {
    let cancelled = false;

    const resolveBankDetection = async () => {
      const resolvedBanks = await Promise.all(
        SA_BANKING_APPS.map(async (bank) => {
          let detected = false;

          for (const scheme of bank.schemes) {
            try {
              const canOpen = await Linking.canOpenURL(scheme);
              if (canOpen) {
                detected = true;
                break;
              }
            } catch (error) {
              logger.warn('usePaymentFlow', `Scheme check failed for ${scheme}`, error);
            }
          }

          return {
            ...bank,
            detected,
          };
        })
      );

      if (!cancelled) {
        const detectedCount = resolvedBanks.filter((bank) => bank.detected).length;
        logger.debug('usePaymentFlow', 'Bank detection summary', {
          total: resolvedBanks.length,
          detectedCount,
          undetectedCount: resolvedBanks.length - detectedCount,
        });
        setBankApps(resolvedBanks);
      }
    };

    resolveBankDetection();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchBankDetails = async () => {
    if (!preschoolId) {
      logger.debug('usePaymentFlow', 'No preschoolId provided, skipping bank details fetch');
      setLoading(false);
      return;
    }

    logger.debug('usePaymentFlow', 'Fetching bank details', { preschoolId });

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

      logger.debug('usePaymentFlow', 'Primary bank account query result', {
        hasBankAccount: !!bankAccount,
        hasError: !!bankError,
      });

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

      logger.debug('usePaymentFlow', 'Any active bank account query result', {
        count: anyAccounts?.length || 0,
        hasError: !!anyError,
      });

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
      const { data: paymentMethod, error: paymentMethodError } = await supabase
        .from('organization_payment_methods')
        .select('*')
        .eq('organization_id', preschoolId)
        .eq('method_name', 'bank_transfer')
        .maybeSingle();

      logger.debug('usePaymentFlow', 'Payment methods query result', {
        hasPaymentMethod: !!paymentMethod,
        hasError: !!paymentMethodError,
      });

      if (paymentMethod) {
        setBankDetails({
          id: paymentMethod.id,
          account_name: paymentMethod.display_name || 'School Account',
          bank_name: paymentMethod.bank_name || 'Contact school for details',
          account_number: paymentMethod.account_number || 'Contact school',
          branch_code: paymentMethod.branch_code,
        });
      } else {
        logger.warn('usePaymentFlow', 'No bank details found for school', { preschoolId });
      }
    } catch (error) {
      logger.error('usePaymentFlow', 'Error fetching bank details', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  }, []);

  const confirmManualPayment = useCallback(() => {
    setLaunchState((prev) => (prev === 'launched' ? prev : 'manual_confirmed'));
    setBankHint('Manual payment confirmed. Upload your proof of payment once your transfer is complete.');
    logger.debug('usePaymentFlow', 'Fallback outcome', { action: 'manual_confirmed' });
  }, []);

  const openStoreForBank = useCallback(async (bank: BankApp) => {
    const primaryPackage = bank.packageIds[0];

    try {
      if (Platform.OS === 'android' && primaryPackage) {
        await Linking.openURL(`market://details?id=${primaryPackage}`);
      } else {
        await Linking.openURL(bank.marketUrl);
      }

      logger.debug('usePaymentFlow', 'Fallback outcome', {
        action: 'store',
        bankId: bank.id,
      });
    } catch (error) {
      logger.warn('usePaymentFlow', `Store deep link failed for ${bank.id}`, error);

      try {
        await Linking.openURL(bank.marketUrl);
        logger.debug('usePaymentFlow', 'Fallback outcome', {
          action: 'store_web',
          bankId: bank.id,
        });
      } catch (fallbackError) {
        logger.error('usePaymentFlow', 'Unable to open store fallback', fallbackError);
      }
    }
  }, []);

  const openWebsiteForBank = useCallback(async (bank: BankApp) => {
    try {
      await Linking.openURL(bank.fallbackUrl);
      logger.debug('usePaymentFlow', 'Fallback outcome', {
        action: 'website',
        bankId: bank.id,
      });
    } catch (error) {
      logger.error('usePaymentFlow', 'Unable to open bank website fallback', error);
    }
  }, []);

  const showBankFallbackOptions = useCallback((bank: BankApp) => {
    Alert.alert(
      bank.name,
      `${bank.name} could not be opened automatically. Choose a fallback option.`,
      [
        {
          text: 'Open Store',
          onPress: () => {
            void openStoreForBank(bank);
          },
        },
        {
          text: 'Open Website',
          onPress: () => {
            void openWebsiteForBank(bank);
          },
        },
        {
          text: 'I paid manually',
          onPress: confirmManualPayment,
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            logger.debug('usePaymentFlow', 'Fallback outcome', {
              action: 'cancel',
              bankId: bank.id,
            });
          },
        },
      ]
    );
  }, [confirmManualPayment, openStoreForBank, openWebsiteForBank]);

  const tryOpenBankApp = useCallback(async (bank: BankApp): Promise<LaunchAttemptResult> => {
    if (Platform.OS === 'android' && IntentLauncher) {
      for (const packageName of bank.packageIds) {
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
            packageName,
            category: 'android.intent.category.LAUNCHER',
          });
          return { opened: true, method: 'package' };
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
          return { opened: true, method: 'scheme' };
        }
      } catch (error) {
        logger.warn('usePaymentFlow', `Scheme open failed for ${scheme}`, error);
      }
    }

    return { opened: false };
  }, []);

  const handleLaunchResult = useCallback((bank: BankApp, launchResult: LaunchAttemptResult): boolean => {
    if (!launchResult.opened || !launchResult.method) {
      return false;
    }

    setLaunchState('launched');
    setBankHint(`${bank.name} opened. Complete payment and upload your proof once done.`);
    logger.debug('usePaymentFlow', 'Bank launch success', {
      bankId: bank.id,
      method: launchResult.method,
    });
    return true;
  }, []);

  const openBankingApp = useCallback(async (bank?: BankApp) => {
    setBankHint(null);

    if (bank) {
      const launchResult = await tryOpenBankApp(bank);
      if (!handleLaunchResult(bank, launchResult)) {
        setBankHint(`Could not open ${bank.name} automatically. Use a fallback option below.`);
        showBankFallbackOptions(bank);
      }
      return;
    }

    const detectedBanks = bankApps.filter((entry) => entry.detected);

    if (detectedBanks.length === 1) {
      const detectedBank = detectedBanks[0];
      const launchResult = await tryOpenBankApp(detectedBank);
      if (!handleLaunchResult(detectedBank, launchResult)) {
        setBankHint(`Could not open ${detectedBank.name} automatically. Use a fallback option below.`);
        showBankFallbackOptions(detectedBank);
      }
      return;
    }

    if (detectedBanks.length > 1) {
      logger.debug('usePaymentFlow', 'Multiple detected banking apps', {
        detectedBankIds: detectedBanks.map((entry) => entry.id),
      });
      setBankHint('Choose your bank below to open it. If opening fails, use the fallback options.');
      return;
    }

    logger.debug('usePaymentFlow', 'No detected banking apps', { totalBanks: bankApps.length });
    setBankHint('No bank app was detected. Select your bank below and use fallback options if needed.');
  }, [bankApps, handleLaunchResult, showBankFallbackOptions, tryOpenBankApp]);

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
      logger.error('usePaymentFlow', 'Error sharing payment details', error);
    }
  }, [preschoolName, formattedAmount, studentCode, feeDescription, bankDetails]);

  return {
    loading,
    bankDetails,
    showUploadModal,
    setShowUploadModal,
    bankApps,
    bankHint,
    copiedField,
    formattedAmount,
    launchState,
    canUploadProof,
    copyToClipboard,
    openBankingApp,
    confirmManualPayment,
    sharePaymentDetails,
  };
}
