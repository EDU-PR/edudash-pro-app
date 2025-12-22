/**
 * Empty State and Seed Helper Component
 * Extracted from app/screens/super-admin-subscriptions.tsx
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import type { School, SubscriptionPlan } from './types';

interface EmptyStateProps {
  availableSchools: School[];
  plans: SubscriptionPlan[];
  onCreateClick: () => void;
  onSeedSuccess: () => Promise<void>;
}

export function EmptyState({
  availableSchools,
  plans,
  onCreateClick,
  onSeedSuccess,
}: EmptyStateProps) {
  const handleSeedFreePlan = async (school: School) => {
    try {
      // Prefer a dedicated RPC if available
      const { error: ensureErr } = await assertSupabase().rpc('ensure_school_free_subscription', {
        p_school_id: school.id,
        p_seats: 3,
      });
      if (ensureErr) {
        // Fallback: use admin_create_school_subscription with a free plan id
        const freePlan = plans.find((p) => (p.tier || '').toLowerCase() === 'free');
        if (!freePlan) {
          throw new Error('No free plan available. Please create plans first.');
        }
        const { error: createErr } = await assertSupabase().rpc('admin_create_school_subscription', {
          p_school_id: school.id,
          p_plan_id: freePlan.id,
          p_billing_frequency: 'monthly',
          p_seats_total: 3,
        });
        if (createErr) throw createErr;
      }
      Alert.alert('Success', `Seeded free plan for ${school.name}`);
      await onSeedSuccess();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to seed free plan');
    }
  };

  return (
    <View style={[styles.card, { borderColor: '#2563eb' }]}>
      <Text style={{ color: '#93c5fd', fontWeight: '800', marginBottom: 6 }}>
        No school-owned subscriptions
      </Text>
      <Text style={{ color: '#9CA3AF', marginBottom: 8 }}>
        Legacy user-owned subscriptions do not appear here. Create a school-owned subscription or
        seed a free plan for a school.
      </Text>
      {/* Quick actions */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity style={[styles.createButton, { flex: 1 }]} onPress={onCreateClick}>
          <Text style={styles.createButtonText}>+ Create Subscription</Text>
        </TouchableOpacity>
      </View>

      {/* Seed free plan helper */}
      <View style={{ marginTop: 12 }}>
        <Text style={[styles.cardDetail, { marginBottom: 6 }]}>Seed a free plan for a school</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {availableSchools.map((school) => (
            <TouchableOpacity
              key={school.id}
              style={[styles.schoolChip, { marginRight: 8 }]}
              onPress={() => handleSeedFreePlan(school)}
            >
              <Text style={styles.schoolChipText}>{school.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
  },
  cardDetail: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 2,
  },
  createButton: {
    backgroundColor: '#00f5ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  schoolChip: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  schoolChipText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
});
