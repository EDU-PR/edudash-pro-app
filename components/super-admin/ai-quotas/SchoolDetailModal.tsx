/**
 * School detail modal for viewing and managing individual school quotas
 * @module components/super-admin/ai-quotas/SchoolDetailModal
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AIQuotaSettings } from './types';
import { getUsagePercentage, getUsageColor, getPlanColor, formatNumber, formatCurrency } from './utils';

interface SchoolDetailModalProps {
  visible: boolean;
  school: AIQuotaSettings | null;
  onClose: () => void;
  onResetUsage: (school: AIQuotaSettings) => void;
  onSuspend: (school: AIQuotaSettings) => void;
}

export function SchoolDetailModal({
  visible,
  school,
  onClose,
  onResetUsage,
  onSuspend,
}: SchoolDetailModalProps) {
  if (!school) {
    return null;
  }

  const usagePercentage = getUsagePercentage(school.current_usage, school.monthly_limit);
  const isOverLimit = school.current_usage > school.monthly_limit;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#00f5ff" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{school.school_name}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Usage Overview Section */}
          <View style={styles.schoolDetailSection}>
            <Text style={styles.modalSectionTitle}>Usage Overview</Text>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Current Usage</Text>
              <Text style={styles.detailValue}>
                {formatNumber(school.current_usage)} tokens
              </Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Monthly Limit</Text>
              <Text style={styles.detailValue}>
                {formatNumber(school.monthly_limit)} tokens
              </Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Usage Percentage</Text>
              <Text style={[
                styles.detailValue, 
                { color: getUsageColor(usagePercentage) }
              ]}>
                {usagePercentage.toFixed(1)}%
              </Text>
            </View>

            {isOverLimit && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Overage Cost</Text>
                <Text style={[styles.detailValue, { color: '#ef4444' }]}>
                  {formatCurrency((school.current_usage - school.monthly_limit) * school.cost_per_overage)}
                </Text>
              </View>
            )}
          </View>

          {/* Settings Section */}
          <View style={styles.schoolDetailSection}>
            <Text style={styles.modalSectionTitle}>Settings</Text>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Plan Type</Text>
              <View style={[
                styles.planBadge, 
                { 
                  backgroundColor: getPlanColor(school.plan_type) + '20', 
                  borderColor: getPlanColor(school.plan_type) 
                }
              ]}>
                <Text style={[styles.planBadgeText, { color: getPlanColor(school.plan_type) }]}>
                  {school.plan_type.toUpperCase()}
                </Text>
              </View>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Overage Allowed</Text>
              <Text style={styles.detailValue}>
                {school.overage_allowed ? 'Yes' : 'No'}
              </Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Reset Date</Text>
              <Text style={styles.detailValue}>
                {new Date(school.reset_date).toLocaleDateString()}
              </Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={[
                styles.detailValue, 
                { color: school.is_suspended ? '#ef4444' : '#10b981' }
              ]}>
                {school.is_suspended ? 'Suspended' : 'Active'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalActionButton}
              onPress={() => onResetUsage(school)}
            >
              <Ionicons name="refresh" size={20} color="#00f5ff" />
              <Text style={styles.modalActionText}>Reset Usage</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalActionButton,
                school.is_suspended ? styles.reactivateButton : styles.suspendButton
              ]}
              onPress={() => onSuspend(school)}
            >
              <Ionicons 
                name={school.is_suspended ? "play" : "pause"} 
                size={20} 
                color={school.is_suspended ? "#10b981" : "#ef4444"} 
              />
              <Text style={[
                styles.modalActionText, 
                { color: school.is_suspended ? "#10b981" : "#ef4444" }
              ]}>
                {school.is_suspended ? 'Reactivate' : 'Suspend'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 24,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#111827',
  },
  schoolDetailSection: {
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  modalSectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  detailValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  reactivateButton: {
    borderColor: '#10b981',
  },
  suspendButton: {
    borderColor: '#ef4444',
  },
  modalActionText: {
    color: '#00f5ff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});
