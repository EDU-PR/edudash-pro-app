/**
 * Create Subscription Modal Component
 * Extracted from app/screens/super-admin-subscriptions.tsx
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { School, SubscriptionPlan, CreateSubscriptionForm } from './types';

interface CreateSubscriptionModalProps {
  visible: boolean;
  theme: any;
  creating: boolean;
  createForm: CreateSubscriptionForm;
  availableSchools: School[];
  plans: SubscriptionPlan[];
  onClose: () => void;
  onCreate: () => void;
  onFormChange: React.Dispatch<React.SetStateAction<CreateSubscriptionForm>>;
}

export function CreateSubscriptionModal({
  visible,
  theme,
  creating,
  createForm,
  availableSchools,
  plans,
  onClose,
  onCreate,
  onFormChange,
}: CreateSubscriptionModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <ScreenHeader
          title="Create Subscription"
          onBackPress={onClose}
          rightAction={
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close modal">
              <Ionicons name="close" size={24} color={theme?.text || '#ffffff'} />
            </TouchableOpacity>
          }
        />

        <ScrollView
          style={styles.modalContent}
          contentContainerStyle={{ paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* School Selection */}
          <Text style={styles.formLabel}>Select School</Text>
          <ScrollView horizontal style={styles.schoolsScroll}>
            {availableSchools.map((school) => (
              <TouchableOpacity
                key={school.id}
                style={[
                  styles.schoolChip,
                  createForm.school_id === school.id && styles.schoolChipSelected,
                ]}
                onPress={() => onFormChange((prev) => ({ ...prev, school_id: school.id }))}
              >
                <Text
                  style={[
                    styles.schoolChipText,
                    createForm.school_id === school.id && styles.schoolChipTextSelected,
                  ]}
                >
                  {school.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Plan Selection */}
          <Text style={styles.formLabel}>Select Plan ({plans.length} plans loaded)</Text>
          <Text style={[styles.formLabel, { fontSize: 12, color: '#666' }]}>
            Current: {createForm.plan_tier || 'None selected'}
          </Text>
          {plans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planOption,
                createForm.plan_tier ===
                  (plan.tier || plan.id || plan.name?.toLowerCase()?.replace(/\s+/g, '_')) &&
                  styles.planOptionSelected,
              ]}
              onPress={() => {
                const planTier =
                  plan.tier || plan.name?.toLowerCase()?.replace(/\s+/g, '_') || 'custom';
                const defaultSeats = plan.max_teachers || 1;
                onFormChange((prev) => ({
                  ...prev,
                  plan_tier: planTier,
                  plan_id: plan.id,
                  seats_total: String(defaultSeats),
                }));
              }}
            >
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planDetails}>
                R{plan.price_monthly}/mo • Up to {plan.max_teachers || 1} teachers
              </Text>
              <Text style={[styles.planDetails, { fontSize: 10, color: '#999' }]}>
                ID: {plan.id} | Tier: {plan.tier || 'NO TIER'}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Billing Frequency */}
          <Text style={styles.formLabel}>Billing Frequency</Text>
          <View style={styles.billingRow}>
            {['monthly', 'annual'].map((freq) => (
              <TouchableOpacity
                key={freq}
                style={[
                  styles.billingOption,
                  createForm.billing_frequency === freq && styles.billingOptionSelected,
                ]}
                onPress={() => onFormChange((prev) => ({ ...prev, billing_frequency: freq }))}
              >
                <Text
                  style={[
                    styles.billingOptionText,
                    createForm.billing_frequency === freq && styles.billingOptionTextSelected,
                  ]}
                >
                  {freq}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Seats */}
          <Text style={styles.formLabel}>Number of Seats</Text>
          <TextInput
            style={styles.input}
            value={createForm.seats_total}
            onChangeText={(value) => onFormChange((prev) => ({ ...prev, seats_total: value }))}
            keyboardType="numeric"
            placeholderTextColor="#9CA3AF"
          />

          <TouchableOpacity
            style={[styles.createModalButton, creating && styles.createModalButtonDisabled]}
            onPress={onCreate}
            disabled={creating}
          >
            <Text style={styles.createModalButtonText}>
              {creating ? 'Creating...' : 'Create Subscription'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  schoolsScroll: {
    marginBottom: 8,
  },
  schoolChip: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  schoolChipSelected: {
    borderColor: '#00f5ff',
    backgroundColor: '#00f5ff22',
  },
  schoolChipText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  schoolChipTextSelected: {
    color: '#00f5ff',
    fontWeight: '700',
  },
  planOption: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  planOptionSelected: {
    borderColor: '#00f5ff',
    backgroundColor: '#00f5ff11',
  },
  planName: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
  },
  planDetails: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  billingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  billingOption: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  billingOptionSelected: {
    borderColor: '#00f5ff',
    backgroundColor: '#00f5ff22',
  },
  billingOptionText: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  billingOptionTextSelected: {
    color: '#00f5ff',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#111827',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  createModalButton: {
    backgroundColor: '#00f5ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  createModalButtonDisabled: {
    backgroundColor: '#00f5ff66',
    opacity: 0.6,
  },
  createModalButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
});
