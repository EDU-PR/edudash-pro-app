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
  showBankSelector: boolean;
  setShowBankSelector: (show: boolean) => void;
  copiedField: string | null;
  formattedAmount: string;
  paymentInitiated: boolean; // Track if user has clicked "Open Banking App"
  copyToClipboard: (text: string, field: string) => Promise<void>;
  openBankingApp: () => void;
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
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [paymentInitiated, setPaymentInitiated] = useState(false); // Track if banking app was opened

  // Parse amount from params
  const parsedAmount = feeAmount ? parseFloat(feeAmount) : 0;
  const formattedAmount = `R ${parsedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  // Fetch school bank details
  useEffect(() => {
    fetchBankDetails();
  }, [preschoolId]);

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

  const openBankingApp = useCallback(() => {
    // Mark payment as initiated - enables Upload POP button
    setPaymentInitiated(true);
    // Open the bank selection sheet instead of Alert
    setShowBankSelector(true);
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
    showBankSelector,
    setShowBankSelector,
    copiedField,
    formattedAmount,
    paymentInitiated,
    copyToClipboard,
    openBankingApp,
    sharePaymentDetails,
  };
}
