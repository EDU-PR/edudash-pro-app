/**
 * RegistrationCard Component
 * 
 * Displays a single registration request with status, guardian info,
 * payment status, and action buttons.
 * Extracted from principal-registrations.tsx per WARP.md file size standards.
 */

import React from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Registration } from '@/hooks/useRegistrations';
import { styles } from './RegistrationCard.styles';

interface RegistrationCardProps {
  item: Registration;
  isProcessing: boolean;
  onApprove: (registration: Registration) => void;
  onReject: (registration: Registration) => void;
  onVerifyPayment: (registration: Registration, verify: boolean) => void;
  canApprove: (registration: Registration) => boolean;
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

export const RegistrationCard: React.FC<RegistrationCardProps> = ({
  item,
  isProcessing,
  onApprove,
  onReject,
  onVerifyPayment,
  canApprove,
}) => {
  const { theme } = useTheme();
  const colors = theme;
  
  const viewDetail = () => {
    router.push({
      pathname: '/screens/registration-detail',
      params: { id: item.id },
    } as any);
  };

  const canApproveItem = canApprove(item);

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
      {item.registration_fee_amount && (
        <View style={[styles.feeRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>Registration Fee:</Text>
          <Text style={[styles.feeAmount, { color: colors.text }]}>
            R{item.registration_fee_amount.toLocaleString()}
            {item.discount_amount ? ` (-R${item.discount_amount})` : ''}
          </Text>
        </View>
      )}

      {/* Applied Date */}
      <Text style={[styles.dateText, { color: colors.textSecondary }]}>
        Applied: {formatDate(item.created_at)}
      </Text>

      {/* POP Warning */}
      {item.status === 'pending' && !canApproveItem && (
        <View style={[styles.popWarning, { backgroundColor: '#F59E0B20' }]}>
          <Ionicons name="warning" size={16} color="#F59E0B" />
          <Text style={styles.popWarningText}>
            Proof of Payment required before approval
          </Text>
        </View>
      )}

      {/* Action Buttons (for pending) */}
      {item.status === 'pending' && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionButton, 
              styles.approveButton,
              !canApproveItem && styles.disabledButton
            ]}
            onPress={() => onApprove(item)}
            disabled={isProcessing || !canApproveItem}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color={canApproveItem ? '#fff' : '#999'} />
                <Text style={[styles.actionButtonText, !canApproveItem && { color: '#999' }]}>
                  Approve
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => onReject(item)}
            disabled={isProcessing}
          >
            <Ionicons name="close" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
          {!item.payment_verified && item.registration_fee_paid && (
            <TouchableOpacity
              style={[styles.actionButton, styles.verifyButton]}
              onPress={() => onVerifyPayment(item, true)}
              disabled={isProcessing}
            >
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Verify</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default RegistrationCard;
