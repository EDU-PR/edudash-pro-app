/**
 * CTA section for upgrade screen
 */
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SubscriptionPlan } from './types';
import { getPlanColor } from './utils';

interface UpgradeCTAProps {
  selectedPlan: string | null;
  plans: SubscriptionPlan[];
  upgrading: boolean;
  annual: boolean;
  onUpgrade: (planId: string) => void;
}

export function UpgradeCTA({ selectedPlan, plans, upgrading, annual, onUpgrade }: UpgradeCTAProps) {
  if (!selectedPlan) return null;
  
  const plan = plans.find(p => p.id === selectedPlan);
  if (!plan) return null;

  const planColor = getPlanColor(plan.tier);
  const isEnterprise = plan.tier.toLowerCase() === 'enterprise';
  const isZeroCost = plan.price_monthly === 0;

  return (
    <View style={styles.ctaSection}>
      <TouchableOpacity
        style={[
          styles.upgradeButton,
          { 
            backgroundColor: planColor,
            opacity: upgrading ? 0.7 : 1
          }
        ]}
        onPress={() => onUpgrade(selectedPlan)}
        disabled={upgrading}
      >
        {upgrading ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <>
            <Text style={styles.upgradeButtonText}>
              {isEnterprise ? 'Contact Sales' : (isZeroCost ? 'Downgrade Now' : 'Upgrade Now')}
            </Text>
            <Text style={styles.upgradeButtonSubtext}>
              {isZeroCost ? 'No payment required' : `Start your ${annual ? 'annual' : 'monthly'} subscription`}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => {
          try {
            router.back();
          } catch {
            router.replace('/screens/principal-dashboard');
          }
        }}
      >
        <Text style={styles.cancelButtonText}>Maybe Later</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  ctaSection: {
    gap: 12,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  upgradeButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  upgradeButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
  },
  upgradeButtonSubtext: {
    color: '#000',
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
  },
});
