/**
 * TierComparison Component
 * 
 * Shows side-by-side comparison of subscription tiers with features and pricing.
 * Used in pricing/upgrade screens.
 * 
 * Complies with WARP.md:
 * - Component ≤400 lines (excluding StyleSheet)
 * - Mobile-first design
 * - Analytics tracking
 */

import React, { useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Dimensions 
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { track } from '@/lib/analytics';

const { width: screenWidth } = Dimensions.get('window');

export interface TierInfo {
  id: string;
  name: string;
  price: number;
  priceAnnual?: number;
  description: string;
  features: string[];
  quotas: {
    homework_help: number | 'unlimited';
    lesson_generation: number | 'unlimited';
    grading_assistance: number | 'unlimited';
    transcription: number | 'unlimited';
  };
  recommended?: boolean;
  color: string;
}

// Default tier configuration
const DEFAULT_TIERS: TierInfo[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Perfect for getting started',
    features: [
      '10 AI homework help sessions',
      '5 AI-generated lessons',
      'Basic attendance tracking',
      'Parent messaging',
    ],
    quotas: {
      homework_help: 10,
      lesson_generation: 5,
      grading_assistance: 5,
      transcription: 60,
    },
    color: '#6B7280',
  },
  {
    id: 'parent_starter',
    name: 'Parent Starter',
    price: 49,
    priceAnnual: 490,
    description: 'Essential features for parents',
    features: [
      '30 AI homework help sessions',
      'Detailed progress reports',
      'Priority support',
      'Voice transcription (2 hrs)',
    ],
    quotas: {
      homework_help: 30,
      lesson_generation: 0,
      grading_assistance: 0,
      transcription: 120,
    },
    color: '#06B6D4',
  },
  {
    id: 'parent_plus',
    name: 'Parent Plus',
    price: 99,
    priceAnnual: 990,
    description: 'Complete home learning support',
    features: [
      '100 AI homework help sessions',
      'Personalized learning paths',
      'Exam prep assistance',
      'Voice transcription (5 hrs)',
      'Advanced analytics',
    ],
    quotas: {
      homework_help: 100,
      lesson_generation: 0,
      grading_assistance: 0,
      transcription: 300,
    },
    recommended: true,
    color: '#22C55E',
  },
  {
    id: 'school_starter',
    name: 'School Starter',
    price: 199,
    priceAnnual: 1990,
    description: 'For small schools getting started',
    features: [
      'Up to 5 teachers',
      '50 AI lessons per teacher',
      'Basic grading assistance',
      'Student progress tracking',
      'Parent communication tools',
    ],
    quotas: {
      homework_help: 100,
      lesson_generation: 50,
      grading_assistance: 100,
      transcription: 600,
    },
    color: '#059669',
  },
  {
    id: 'school_premium',
    name: 'School Premium',
    price: 499,
    priceAnnual: 4990,
    description: 'Complete school management',
    features: [
      'Up to 20 teachers',
      'Unlimited AI lessons',
      'Advanced grading with rubrics',
      'Custom curriculum alignment',
      'Priority support',
      'Analytics dashboard',
    ],
    quotas: {
      homework_help: 300,
      lesson_generation: 'unlimited',
      grading_assistance: 500,
      transcription: 1800,
    },
    recommended: true,
    color: '#7C3AED',
  },
];

export interface TierComparisonProps {
  /** Filter tiers by type */
  tierType?: 'parent' | 'school' | 'all';
  /** Currently selected tier */
  currentTier?: string;
  /** Show annual pricing option */
  showAnnual?: boolean;
  /** Custom container style */
  containerStyle?: object;
  /** Callback when tier is selected */
  onSelectTier?: (tierId: string) => void;
}

/**
 * Individual tier card component
 */
const TierCard: React.FC<{
  tier: TierInfo;
  isCurrentTier: boolean;
  isAnnual: boolean;
  theme: any;
  onSelect: () => void;
}> = ({ tier, isCurrentTier, isAnnual, theme, onSelect }) => {
  const price = isAnnual && tier.priceAnnual ? tier.priceAnnual : tier.price;
  const period = isAnnual ? '/year' : '/month';
  // Calculate savings: annual price vs 12 monthly payments
  // Only show savings if annual pricing is available and represents a discount
  const MONTHS_IN_YEAR = 12;
  const monthlyEquivalent = tier.price * MONTHS_IN_YEAR;
  const savings = (tier.priceAnnual && monthlyEquivalent > tier.priceAnnual) 
    ? Math.round((1 - (tier.priceAnnual / monthlyEquivalent)) * 100) 
    : 0;
  
  return (
    <View style={[
      styles.tierCard,
      { backgroundColor: theme.surface },
      tier.recommended && styles.recommendedCard,
      tier.recommended && { borderColor: tier.color },
    ]}>
      {/* Recommended badge */}
      {tier.recommended && (
        <View style={[styles.recommendedBadge, { backgroundColor: tier.color }]}>
          <Text style={styles.recommendedText}>RECOMMENDED</Text>
        </View>
      )}
      
      {/* Header */}
      <View style={styles.tierHeader}>
        <Text style={[styles.tierName, { color: tier.color }]}>{tier.name}</Text>
        <View style={styles.priceContainer}>
          <Text style={[styles.currency, { color: theme.text }]}>R</Text>
          <Text style={[styles.price, { color: theme.text }]}>{price}</Text>
          <Text style={[styles.period, { color: theme.textSecondary }]}>{period}</Text>
        </View>
        {isAnnual && savings > 0 && (
          <View style={[styles.savingsBadge, { backgroundColor: theme.success + '20' }]}>
            <Text style={[styles.savingsText, { color: theme.success }]}>
              Save {savings}%
            </Text>
          </View>
        )}
        <Text style={[styles.tierDescription, { color: theme.textSecondary }]}>
          {tier.description}
        </Text>
      </View>
      
      {/* Features */}
      <View style={styles.featuresList}>
        {tier.features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={18} color={tier.color} />
            <Text style={[styles.featureText, { color: theme.text }]}>{feature}</Text>
          </View>
        ))}
      </View>
      
      {/* Quotas */}
      <View style={[styles.quotasSection, { borderTopColor: theme.border }]}>
        <Text style={[styles.quotasTitle, { color: theme.textSecondary }]}>
          Monthly Quotas
        </Text>
        <View style={styles.quotasList}>
          <QuotaItem 
            label="Homework Help" 
            value={tier.quotas.homework_help} 
            theme={theme} 
          />
          {tier.quotas.lesson_generation > 0 && (
            <QuotaItem 
              label="Lessons" 
              value={tier.quotas.lesson_generation} 
              theme={theme} 
            />
          )}
          {tier.quotas.grading_assistance > 0 && (
            <QuotaItem 
              label="Grading" 
              value={tier.quotas.grading_assistance} 
              theme={theme} 
            />
          )}
        </View>
      </View>
      
      {/* CTA Button */}
      <TouchableOpacity
        style={[
          styles.selectButton,
          isCurrentTier 
            ? [styles.currentTierButton, { borderColor: tier.color }]
            : { backgroundColor: tier.color },
        ]}
        onPress={onSelect}
        disabled={isCurrentTier}
      >
        <Text style={[
          styles.selectButtonText,
          isCurrentTier && { color: tier.color },
        ]}>
          {isCurrentTier ? 'Current Plan' : tier.price === 0 ? 'Get Started' : 'Upgrade Now'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Quota display item
 */
const QuotaItem: React.FC<{
  label: string;
  value: number | 'unlimited';
  theme: any;
}> = ({ label, value, theme }) => (
  <View style={styles.quotaItem}>
    <Text style={[styles.quotaLabel, { color: theme.textSecondary }]}>{label}</Text>
    <Text style={[styles.quotaValue, { color: theme.text }]}>
      {value === 'unlimited' ? '∞' : value}
    </Text>
  </View>
);

export const TierComparison: React.FC<TierComparisonProps> = ({
  tierType = 'all',
  currentTier,
  showAnnual = true,
  containerStyle,
  onSelectTier,
}) => {
  const { theme } = useTheme();
  const { tier: contextTier } = useSubscription();
  const [isAnnual, setIsAnnual] = React.useState(false);
  
  const effectiveCurrentTier = currentTier || contextTier || 'free';
  
  // Filter tiers based on type
  const filteredTiers = DEFAULT_TIERS.filter((tier) => {
    if (tierType === 'parent') {
      return tier.id === 'free' || tier.id.startsWith('parent');
    }
    if (tierType === 'school') {
      return tier.id.startsWith('school');
    }
    return true;
  });
  
  /**
   * Handle tier selection
   */
  const handleSelectTier = useCallback((tierId: string) => {
    track('edudash.subscription.tier_selected', {
      selected_tier: tierId,
      current_tier: effectiveCurrentTier,
      is_annual: isAnnual,
      source: 'tier_comparison',
    });
    
    if (onSelectTier) {
      onSelectTier(tierId);
    } else {
      // Default: navigate to checkout
      router.push({
        pathname: '/screens/subscription-checkout',
        params: { tier: tierId, billing: isAnnual ? 'annual' : 'monthly' },
      } as any);
    }
  }, [effectiveCurrentTier, isAnnual, onSelectTier]);
  
  return (
    <View style={[styles.container, containerStyle]}>
      {/* Billing toggle */}
      {showAnnual && (
        <View style={styles.billingToggle}>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              !isAnnual && [styles.toggleActive, { backgroundColor: theme.primary }],
            ]}
            onPress={() => setIsAnnual(false)}
          >
            <Text style={[
              styles.toggleText,
              !isAnnual && styles.toggleActiveText,
              isAnnual && { color: theme.textSecondary },
            ]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              isAnnual && [styles.toggleActive, { backgroundColor: theme.primary }],
            ]}
            onPress={() => setIsAnnual(true)}
          >
            <Text style={[
              styles.toggleText,
              isAnnual && styles.toggleActiveText,
              !isAnnual && { color: theme.textSecondary },
            ]}>
              Annual
            </Text>
            {isAnnual && (
              <View style={[styles.savingsIndicator, { backgroundColor: theme.success }]}>
                <Text style={styles.savingsIndicatorText}>Save 17%</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
      
      {/* Tier cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tiersScrollContent}
        snapToInterval={screenWidth * 0.85 + 16}
        decelerationRate="fast"
      >
        {filteredTiers.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            isCurrentTier={tier.id === effectiveCurrentTier}
            isAnnual={isAnnual}
            theme={theme}
            onSelect={() => handleSelectTier(tier.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  billingToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 6,
  },
  toggleActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleActiveText: {
    color: '#fff',
  },
  savingsIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savingsIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tiersScrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  tierCard: {
    width: screenWidth * 0.85,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  recommendedCard: {
    borderWidth: 2,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    transform: [{ translateX: -50 }],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tierHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  tierName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  currency: {
    fontSize: 20,
    fontWeight: '600',
  },
  price: {
    fontSize: 48,
    fontWeight: '800',
  },
  period: {
    fontSize: 14,
    marginLeft: 4,
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tierDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  featuresList: {
    gap: 12,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
  quotasSection: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginBottom: 20,
  },
  quotasTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  quotasList: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quotaItem: {
    alignItems: 'center',
  },
  quotaLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  quotaValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  selectButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  currentTierButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default TierComparison;
