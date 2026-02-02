/**
 * RegistrationCard Component
 * 
 * Displays a single registration request with status, guardian info,
 * payment status, and action buttons.
 * Extracted from principal-registrations.tsx per WARP.md file size standards.
 */

import React from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Registration, type ShowAlert } from '@/hooks/useRegistrations';
import { styles } from './RegistrationCard.styles';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface RegistrationCardProps {
  item: Registration;
  isProcessing: boolean;
  onApprove: (registration: Registration) => void;
  onReject: (registration: Registration) => void;
  onVerifyPayment: (registration: Registration, verify: boolean) => void;
  canApprove: (registration: Registration) => boolean;
  onSendReminder?: (registration: Registration) => void;
  isSendingReminder?: boolean;
  onSendPopUploadLink?: (registration: Registration) => void;
  isSendingPopLink?: boolean;
  showAlert?: ShowAlert;
}

// Calculate age from DOB
const calculateAge = (dob: string): string => {
  if (!dob) return 'N/A';
  const birthDate = new Date(dob);
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  if (years === 0) {
    return `${months}m`;
  }
  return `${years}y ${months}m`;
};

// Format date
const formatDate = (date: string): string => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Get status color
const getStatusColor = (status: Registration['status']): string => {
  switch (status) {
    case 'approved': return '#10B981';
    case 'rejected': return '#EF4444';
    case 'pending': return '#F59E0B';
    default: return '#6B7280';
  }
};

// Get status icon
const getStatusIcon = (status: Registration['status']): string => {
  switch (status) {
    case 'approved': return 'checkmark-circle';
    case 'rejected': return 'close-circle';
    case 'pending': return 'time';
    default: return 'help-circle';
  }
};

const hasValidPopUrl = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (['pending', 'n/a', 'na', 'none', 'null', 'undefined'].includes(normalized)) {
    return false;
  }
  return true;
};

export const RegistrationCard: React.FC<RegistrationCardProps> = ({
  item,
  isProcessing,
  onApprove,
  onReject,
  onVerifyPayment,
  canApprove,
  onSendReminder,
  isSendingReminder,
  onSendPopUploadLink,
  isSendingPopLink,
  showAlert,
}) => {
  const { theme } = useTheme();
  const colors = theme;
  
  const viewDetail = () => {
    router.push({
      pathname: '/screens/registration-detail',
      params: { id: item.id },
    } as any);
  };

  const feeAmount = item.registration_fee_amount ?? 0;
  const hasFee = feeAmount > 0;
  const hasPop = hasValidPopUrl(item.proof_of_payment_url);
  const canApproveItem = canApprove(item);
  const canVerifyPayment = item.status === 'pending' && hasFee;
  const canSendPopLink =
    item.status === 'pending' &&
    item.source === 'edusite' &&
    hasFee &&
    !hasPop &&
    !!onSendPopUploadLink;
  const verifyLabel = item.payment_verified
    ? 'Unverify'
    : hasPop
      ? 'Verify'
      : 'Confirm Paid';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={viewDetail}
      disabled={isProcessing}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.studentInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {item.student_first_name?.[0]}{item.student_last_name?.[0]}
            </Text>
          </View>
          <View style={styles.nameContainer}>
            <Text style={[styles.studentName, { color: colors.text }]}>
              {item.student_first_name} {item.student_last_name}
            </Text>
            <Text style={[styles.age, { color: colors.textSecondary }]}>
              Age: {calculateAge(item.student_dob)} • {item.student_gender || 'N/A'}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Ionicons name={getStatusIcon(item.status) as any} size={14} color={getStatusColor(item.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      
      {/* Source Badge */}
      {item.source && (
        <View style={[
          styles.sourceBadge, 
          { backgroundColor: item.source === 'in-app' ? '#8B5CF620' : '#3B82F620' }
        ]}>
          <Ionicons 
            name={item.source === 'in-app' ? 'phone-portrait-outline' : 'globe-outline'} 
            size={12} 
            color={item.source === 'in-app' ? '#8B5CF6' : '#3B82F6'} 
          />
          <Text style={{ 
            color: item.source === 'in-app' ? '#8B5CF6' : '#3B82F6',
            fontSize: 11,
            marginLeft: 4,
            fontWeight: '500',
          }}>
            {item.source === 'in-app' ? 'App Registration' : 'Website'}
          </Text>
        </View>
      )}

      {/* Guardian Info */}
      <View style={styles.section}>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.text }]}>{item.guardian_name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.text }]}>{item.guardian_phone}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.text }]} numberOfLines={1}>
            {item.guardian_email}
          </Text>
        </View>
      </View>

      {/* Payment & Documents Status */}
      <View style={styles.statusRow}>
        <View style={[
          styles.statusChip,
          { backgroundColor: item.registration_fee_paid ? '#10B98120' : '#EF444420' }
        ]}>
          <Ionicons 
            name={item.registration_fee_paid ? 'checkmark-circle' : 'close-circle'} 
            size={14} 
            color={item.registration_fee_paid ? '#10B981' : '#EF4444'} 
          />
          <Text style={{ 
            color: item.registration_fee_paid ? '#10B981' : '#EF4444',
            fontSize: 12,
            marginLeft: 4,
          }}>
            {item.registration_fee_paid 
              ? (item.payment_verified ? 'Payment Verified' : 'Paid (Unverified)')
              : 'Unpaid'}
          </Text>
        </View>
        <View style={[
          styles.statusChip,
          { backgroundColor: item.documents_uploaded ? '#10B98120' : '#F59E0B20' }
        ]}>
          <Ionicons 
            name={item.documents_uploaded ? 'document-text' : 'document-outline'} 
            size={14} 
            color={item.documents_uploaded ? '#10B981' : '#F59E0B'} 
          />
          <Text style={{ 
            color: item.documents_uploaded ? '#10B981' : '#F59E0B',
            fontSize: 12,
            marginLeft: 4,
          }}>
            {item.documents_uploaded ? 'Docs Uploaded' : 'Docs Pending'}
          </Text>
        </View>
      </View>

      {/* Fee Info */}
      {hasFee && (
        <View style={[styles.feeRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>Registration Fee:</Text>
          <Text style={[styles.feeAmount, { color: colors.text }]}>
            R{feeAmount.toLocaleString()}
            {item.discount_amount ? ` (-R${item.discount_amount})` : ''}
          </Text>
        </View>
      )}

      {/* Applied Date */}
      <Text style={[styles.dateText, { color: colors.textSecondary }]}>
        Applied: {formatDate(item.created_at)}
      </Text>

      {/* Send Payment Reminder Button (for unpaid pending registrations) */}
      {item.status === 'pending' && !item.registration_fee_paid && onSendReminder && (
        <TouchableOpacity
          style={[
            styles.reminderButton,
            { backgroundColor: '#F59E0B20', borderColor: '#F59E0B' },
            isSendingReminder && { opacity: 0.6 },
          ]}
          onPress={() => onSendReminder(item)}
          disabled={isSendingReminder || isProcessing}
        >
          {isSendingReminder ? (
            <EduDashSpinner size="small" color="#F59E0B" />
          ) : (
            <Ionicons name="mail-outline" size={16} color="#F59E0B" />
          )}
          <Text style={{ color: '#F59E0B', marginLeft: 8, fontWeight: '600', fontSize: 13 }}>
            {isSendingReminder ? 'Sending...' : 'Send Payment Reminder'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Send POP Upload Link */}
      {canSendPopLink && (
        <TouchableOpacity
          style={[
            styles.popUploadButton,
            { backgroundColor: '#2563EB20', borderColor: '#2563EB' },
            isSendingPopLink && { opacity: 0.6 },
          ]}
          onPress={() => onSendPopUploadLink?.(item)}
          disabled={isSendingPopLink || isProcessing}
        >
          {isSendingPopLink ? (
            <EduDashSpinner size="small" color="#2563EB" />
          ) : (
            <Ionicons name="link-outline" size={16} color="#2563EB" />
          )}
          <Text style={{ color: '#2563EB', marginLeft: 8, fontWeight: '600', fontSize: 13 }}>
            {isSendingPopLink ? 'Sending...' : 'Send POP Upload Link'}
          </Text>
        </TouchableOpacity>
      )}

      {/* POP Warning - only show if pending and needs payment */}
      {item.status === 'pending' && !canApproveItem && hasFee && (
        <View style={[styles.popWarning, { backgroundColor: '#F59E0B20' }]}>
          <Ionicons name="warning" size={16} color="#F59E0B" />
          <Text style={styles.popWarningText}>
            Proof of Payment not uploaded yet - confirm payment to approve
          </Text>
        </View>
      )}

      {/* Payment verification reminder - show if POP uploaded but not verified */}
      {item.status === 'pending' && hasPop && !item.payment_verified && (
        <View style={[styles.popWarning, { backgroundColor: '#3B82F620' }]}>
          <Ionicons name="information-circle" size={16} color="#3B82F6" />
          <Text style={[styles.popWarningText, { color: '#3B82F6' }]}>
            POP uploaded - verify payment before approving
          </Text>
        </View>
      )}
      
      {/* POP Preview Link */}
      {hasPop && item.status === 'pending' && (
        <TouchableOpacity 
          style={[styles.popLink, { backgroundColor: colors.primary + '15' }]}
          onPress={() => {
            // Open POP in browser/external viewer
            if (!item.proof_of_payment_url) {
              showAlert?.({
                title: 'Not Available',
                message: 'Proof of payment has not been uploaded yet.',
                type: 'warning',
              });
              return;
            }
            Linking.openURL(item.proof_of_payment_url).catch(() => {
              showAlert?.({
                title: 'Error',
                message: 'Could not open proof of payment document',
                type: 'error',
              });
            });
          }}
        >
          <Ionicons name="receipt-outline" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, marginLeft: 8, fontWeight: '600' }}>
            View Proof of Payment
          </Text>
          {hasFee && (
            <Text style={{ color: colors.primary, marginLeft: 'auto', fontWeight: '700' }}>
              R{feeAmount.toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Action Buttons */}
      {item.status === 'pending' && (
        <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
          {canVerifyPayment && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.verifyButton,
                isProcessing && styles.disabledButton,
              ]}
              onPress={() => onVerifyPayment(item, !item.payment_verified)}
              disabled={isProcessing}
            >
              <Ionicons
                name={item.payment_verified ? 'close-circle' : 'checkmark-circle'}
                size={18}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>
                {verifyLabel}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.approveButton,
              (!canApproveItem || isProcessing) && styles.disabledButton,
            ]}
            onPress={() => onApprove(item)}
            disabled={!canApproveItem || isProcessing}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.rejectButton,
              isProcessing && styles.disabledButton,
            ]}
            onPress={() => onReject(item)}
            disabled={isProcessing}
          >
            <Ionicons name="close-circle" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default RegistrationCard;
