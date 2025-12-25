/**
 * Membership Selection Step
 * Third step - selecting member type and tier
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MEMBER_TYPES, MEMBERSHIP_TIERS } from './constants';
import type { RegistrationData } from './types';
import type { MemberType, MembershipTier } from '@/components/membership/types';

interface MembershipStepProps {
  data: RegistrationData;
  onUpdate: (field: keyof RegistrationData, value: string) => void;
  theme: any;
}

export function MembershipStep({ data, onUpdate, theme }: MembershipStepProps) {
  const formatCurrency = (amount: number) => {
    return `R${amount.toLocaleString()}`;
  };

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Choose Your Membership</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Select your role and membership tier
      </Text>
      
      {/* Member Type Selection */}
      <Text style={[styles.sectionLabel, { color: theme.text }]}>I want to join as a:</Text>
      <View style={styles.typeGrid}>
        {MEMBER_TYPES.map(type => (
          <TouchableOpacity
            key={type.type}
            style={[
              styles.typeCard,
              { 
                backgroundColor: data.member_type === type.type ? theme.primary + '15' : theme.card,
                borderColor: data.member_type === type.type ? theme.primary : theme.border,
              }
            ]}
            onPress={() => onUpdate('member_type', type.type)}
          >
            <View style={[styles.typeIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name={type.icon} size={24} color={theme.primary} />
            </View>
            <Text style={[styles.typeTitle, { color: theme.text }]}>{type.title}</Text>
            <Text style={[styles.typeDesc, { color: theme.textSecondary }]}>{type.description}</Text>
            {data.member_type === type.type && (
              <View style={[styles.typeCheck, { backgroundColor: theme.primary }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Membership Tier Selection */}
      <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 24 }]}>Membership Tier:</Text>
      <View style={styles.tierList}>
        {MEMBERSHIP_TIERS.map((tier, index) => (
          <TouchableOpacity
            key={tier.tier}
            style={[
              styles.tierCard,
              { 
                backgroundColor: data.membership_tier === tier.tier ? theme.primary + '10' : theme.card,
                borderColor: data.membership_tier === tier.tier ? theme.primary : theme.border,
              }
            ]}
            onPress={() => onUpdate('membership_tier', tier.tier)}
          >
            {index === 1 && (
              <View style={[styles.popularBadge, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.popularText}>POPULAR</Text>
              </View>
            )}
            
            <View style={styles.tierHeader}>
              <View>
                <Text style={[styles.tierTitle, { color: theme.text }]}>{tier.title}</Text>
                <Text style={[styles.tierPrice, { color: theme.primary }]}>
                  {formatCurrency(tier.price)}<Text style={styles.tierPeriod}>/year</Text>
                </Text>
              </View>
              <View style={[
                styles.tierRadio,
                { 
                  borderColor: data.membership_tier === tier.tier ? theme.primary : theme.border,
                  backgroundColor: data.membership_tier === tier.tier ? theme.primary : 'transparent',
                }
              ]}>
                {data.membership_tier === tier.tier && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
            </View>
            
            <View style={styles.tierFeatures}>
              {tier.features.map((feature, i) => (
                <View key={i} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={[styles.featureText, { color: theme.textSecondary }]}>{feature}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  typeGrid: {
    gap: 12,
  },
  typeCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  typeDesc: {
    fontSize: 13,
  },
  typeCheck: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierList: {
    gap: 12,
  },
  tierCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 8,
    right: -28,
    paddingHorizontal: 30,
    paddingVertical: 4,
    transform: [{ rotate: '45deg' }],
  },
  popularText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  tierPrice: {
    fontSize: 20,
    fontWeight: '700',
  },
  tierPeriod: {
    fontSize: 14,
    fontWeight: '400',
  },
  tierRadio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierFeatures: {
    marginTop: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureText: {
    fontSize: 13,
    marginLeft: 8,
  },
});
