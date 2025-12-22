/**
 * Subscription Card Component
 * Extracted from app/screens/super-admin-subscriptions.tsx
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Subscription } from './types';
import { getStatusColor } from './utils';

interface SubscriptionCardProps {
  subscription: Subscription;
  onUpgrade: (subscription: Subscription) => void;
  onCancel: (id: string) => void;
  onReactivate: (id: string) => void;
  onManualActivate: (subscription: Subscription) => void;
  onDelete: (id: string, schoolName: string) => void;
}

export function SubscriptionCard({
  subscription,
  onUpgrade,
  onCancel,
  onReactivate,
  onManualActivate,
  onDelete,
}: SubscriptionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.schoolName}>
          {subscription.school?.name || 'Unknown School'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(subscription.status) }]}>
          <Text style={styles.statusText}>{subscription.status}</Text>
        </View>
      </View>

      <Text style={styles.cardDetail}>
        Tenant: {subscription.school?.tenant_slug || 'N/A'}
      </Text>
      <Text style={styles.cardDetail}>
        Plan: {subscription.plan_id} • {subscription.billing_frequency}
      </Text>
      <Text style={styles.cardDetail}>
        Seats: {subscription.seats_used}/{subscription.seats_total}
      </Text>
      <Text style={styles.cardDetail}>
        Period: {new Date(subscription.start_date).toLocaleDateString()} -{' '}
        {new Date(subscription.end_date).toLocaleDateString()}
      </Text>

      <View style={styles.actionsRow}>
        {subscription.status === 'active' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.upgradeButton]}
              onPress={() => onUpgrade(subscription)}
            >
              <Text style={styles.upgradeButtonText}>Upgrade Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => onCancel(subscription.id)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {subscription.status === 'cancelled' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.activateButton]}
            onPress={() => onReactivate(subscription.id)}
          >
            <Text style={styles.activateButtonText}>Reactivate</Text>
          </TouchableOpacity>
        )}

        {subscription.status === 'pending_payment' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.activateButton]}
            onPress={() => onManualActivate(subscription)}
          >
            <Text style={styles.activateButtonText}>Activate Manually</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => onDelete(subscription.id, subscription.school?.name || 'Unknown School')}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  schoolName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  cardDetail: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  upgradeButton: {
    borderColor: '#00f5ff',
    backgroundColor: '#00f5ff22',
  },
  upgradeButtonText: {
    color: '#00f5ff',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelButton: {
    borderColor: '#ef4444',
    backgroundColor: '#ef444422',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  activateButton: {
    borderColor: '#10b981',
    backgroundColor: '#10b98122',
  },
  activateButtonText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    borderColor: '#6b7280',
    backgroundColor: '#6b728022',
  },
  deleteButtonText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
  },
});
