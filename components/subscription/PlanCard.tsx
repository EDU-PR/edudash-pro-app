/**
 * Subscription plan card component
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SubscriptionPlan } from './types';
import { getPlanColor, withAlpha, convertPrice, normalizeTier } from './utils';

interface PlanCardProps {
  plan: SubscriptionPlan;
  isSelected: boolean;
  onSelect: (planId: string) => void;
  onUpgrade: (planId: string) => void;
  annual: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  isLaunchPromoActive: boolean;
  promoPercentOff: number;
}

export function PlanCard({
  plan,
  isSelected,
  onSelect,
  onUpgrade,
  annual,
  expanded,
  onToggleExpand,
  isLaunchPromoActive,
  promoPercentOff,
}: PlanCardProps) {
  const planColor = getPlanColor(plan.tier);
  const isEnterprise = plan.tier.toLowerCase() === 'enterprise';
  
  const monthlyPriceInRands = convertPrice(plan.price_monthly || 0);
  const annualPriceInRands = convertPrice(plan.price_annual || 0);
  
  const tierNorm = normalizeTier(plan.tier);
  const isParentTier = tierNorm === 'parent_starter' || tierNorm === 'parent_plus';
  const isPromoEligible = isLaunchPromoActive && isParentTier && monthlyPriceInRands > 0;
  
  const displayMonthlyPrice = isPromoEligible ? monthlyPriceInRands * promoPercentOff : monthlyPriceInRands;
  const displayAnnualPrice = isPromoEligible && annualPriceInRands > 0 ? annualPriceInRands * promoPercentOff : annualPriceInRands;
  
  const monthlyTotal = monthlyPriceInRands * 12;
  const savings = annual && annualPriceInRands > 0 && monthlyTotal > annualPriceInRands
    ? monthlyPriceInRands - (annualPriceInRands / 12)
    : 0;

  return (
    <TouchableOpacity
      style={[
        styles.planCard,
        isSelected && styles.planCardSelected,
        { borderColor: isSelected ? planColor : '#1f2937' }
      ]}
      onPress={() => onSelect(plan.id)}
      activeOpacity={0.8}
    >
      {/* Plan Header */}
      <View style={styles.planHeader}>
        <View style={styles.planTitleSection}>
          <Text style={styles.planName}>{plan.name}</Text>
          <View style={[styles.planTierBadge, { backgroundColor: withAlpha(planColor, 0.125) }]}>
            <Text style={[styles.planTier, { color: planColor }]}>{plan.tier}</Text>
          </View>
        </View>
        
        <View style={[styles.selectionIndicator, { borderColor: planColor }]}>
          {isSelected && (
            <View style={[styles.selectionDot, { backgroundColor: planColor }]} />
          )}
        </View>
      </View>

      {/* Price Section */}
      <View style={styles.priceSection}>
        {isEnterprise ? (
          <View>
            <Text style={[styles.customPrice, { color: planColor }]}>Custom</Text>
            <Text style={styles.contactText}>Contact for pricing</Text>
          </View>
        ) : (
          <View>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: planColor }]}>R{displayMonthlyPrice.toFixed(2)}</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </View>
            {isPromoEligible && (
              <Text style={styles.annualPrice}>
                <Text style={{ textDecorationLine: 'line-through' }}>R{monthlyPriceInRands.toFixed(2)}</Text>
                {' '}launch special
              </Text>
            )}
            {annual && plan.price_annual > 0 && (
              <View>
                <Text style={styles.annualPrice}>R{displayAnnualPrice.toFixed(2)} billed annually</Text>
                {savings > 0 && (
                  <Text style={styles.savingsAmount}>Save R{savings.toFixed(2)}/month</Text>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Plan Features */}
      <View style={styles.featuresSection}>
        <View style={styles.limitsRow}>
          <View style={styles.limitItem}>
            <Text style={styles.limitNumber}>
              {isEnterprise || plan.max_teachers == null
                ? '-'
                : (plan.max_teachers < 0 ? 'Unlimited' : String(plan.max_teachers))}
            </Text>
            <Text style={styles.limitLabel}>
              {plan.tier.toLowerCase().includes('parent') ? 'Parents' : 'Teachers'}
            </Text>
          </View>
          <View style={styles.limitItem}>
            <Text style={styles.limitNumber}>
              {isEnterprise || plan.max_students == null
                ? '-'
                : (plan.max_students < 0 ? 'Unlimited' : String(plan.max_students))}
            </Text>
            <Text style={styles.limitLabel}>
              {plan.tier.toLowerCase().includes('parent') ? 'Children' : 'Students'}
            </Text>
          </View>
        </View>

        {plan.features && plan.features.length > 0 && (
          <View style={styles.featuresList}>
            {((expanded ? plan.features : plan.features.slice(0, 3)) || []).map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Text style={[styles.featureIcon, { color: planColor }]}>✓</Text>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
            {plan.features.length > 3 && (
              <TouchableOpacity onPress={onToggleExpand}>
                <Text style={styles.moreFeatures}>
                  {expanded ? 'Hide features' : `See all features (${plan.features.length})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Upgrade Button */}
      <TouchableOpacity
        style={[styles.upgradeButton, { backgroundColor: planColor }]}
        onPress={() => onUpgrade(plan.id)}
      >
        <Text style={styles.upgradeButtonText}>
          {isEnterprise ? 'Contact Sales' : (monthlyPriceInRands === 0 ? 'Downgrade' : 'Upgrade')}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  planCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#1f2937',
  },
  planCardSelected: {
    shadowColor: '#00f5ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planTitleSection: {
    flex: 1,
  },
  planName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  planTierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  planTier: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  priceSection: {
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  price: {
    fontSize: 32,
    fontWeight: '900',
    marginRight: 4,
  },
  pricePeriod: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  annualPrice: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  savingsAmount: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  customPrice: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  featuresSection: {
    gap: 12,
  },
  limitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
  },
  limitItem: {
    alignItems: 'center',
  },
  limitNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  limitLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  featuresList: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  featureText: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  moreFeatures: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  upgradeButton: {
    marginTop: 12,
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
});
