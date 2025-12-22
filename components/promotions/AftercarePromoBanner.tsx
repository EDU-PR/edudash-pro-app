import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

interface AftercarePromoBannerProps {
  onPress?: () => void;
  compact?: boolean;
}

/**
 * Aftercare Registration Promo Banner
 * Displays 50% off promotion for 2026 aftercare registration
 * Original: R400.00 → Promo: R200.00 (if paid before Dec 31, 2025)
 */
export function AftercarePromoBanner({ onPress, compact = false }: AftercarePromoBannerProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  
  const styles = createStyles(theme, isDark);
  
  // Check if promo is still active (before Dec 31, 2025)
  const now = new Date();
  const promoEndDate = new Date('2025-12-31T23:59:59Z');
  const isActive = now < promoEndDate;
  
  if (!isActive) {
    return null; // Don't show if promo expired
  }
  
  const daysRemaining = Math.ceil((promoEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Default: navigate to registration or pricing
      router.push('/pricing' as any);
    }
  };
  
  if (compact) {
    return (
      <TouchableOpacity 
        style={[styles.compactBanner, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.compactContent}>
          <Ionicons name="flash" size={20} color={theme.primary} />
          <View style={styles.compactTextContainer}>
            <Text style={[styles.compactTitle, { color: theme.primary }]}>
              {t('promo.aftercare.title_short', { defaultValue: '50% Off 2026 Aftercare Registration' })}
            </Text>
            <Text style={[styles.compactSubtitle, { color: theme.textSecondary }]}>
              {t('promo.aftercare.deadline_short', { defaultValue: `Pay before Dec 31 - Save R200!` })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.primary} />
        </View>
      </TouchableOpacity>
    );
  }
  
  return (
    <TouchableOpacity 
      style={[styles.banner, { 
        backgroundColor: isDark ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.08)',
        borderColor: theme.primary,
      }]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <Text style={styles.badgeText}>50% OFF</Text>
          </View>
          <Text style={[styles.urgency, { color: theme.error || '#EF4444' }]}>
            {daysRemaining} {t('promo.days_left', { defaultValue: 'days left' })}
          </Text>
        </View>
        
        <Text style={[styles.title, { color: theme.text }]}>
          {t('promo.aftercare.title', { defaultValue: '2026 Aftercare Early Registration' })}
        </Text>
        
        <View style={styles.pricing}>
          <View style={styles.priceRow}>
            <Text style={[styles.originalPrice, { color: theme.textSecondary }]}>
              R400.00
            </Text>
            <Text style={[styles.promoPrice, { color: theme.primary }]}>
              R200.00
            </Text>
          </View>
          <Text style={[styles.savings, { color: theme.success || '#10B981' }]}>
            {t('promo.aftercare.savings', { defaultValue: 'Save R200.00!' })}
          </Text>
        </View>
        
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {t('promo.aftercare.description', { 
            defaultValue: 'Register and pay before December 31, 2025 to secure your spot for 2026 at 50% off the registration fee.' 
          })}
        </Text>
        
        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={18} color={theme.success || '#10B981'} />
            <Text style={[styles.featureText, { color: theme.text }]}>
              {t('promo.aftercare.feature1', { defaultValue: 'Secure your 2026 spot early' })}
            </Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={18} color={theme.success || '#10B981'} />
            <Text style={[styles.featureText, { color: theme.text }]}>
              {t('promo.aftercare.feature2', { defaultValue: 'Pay only R200 instead of R400' })}
            </Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={18} color={theme.success || '#10B981'} />
            <Text style={[styles.featureText, { color: theme.text }]}>
              {t('promo.aftercare.feature3', { defaultValue: 'Limited time offer - ends Dec 31' })}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.ctaButton, { backgroundColor: theme.primary }]}
          onPress={handlePress}
        >
          <Text style={styles.ctaText}>
            {t('promo.aftercare.cta', { defaultValue: 'Register Now & Save R200' })}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  banner: {
    borderRadius: 16,
    borderWidth: 2,
    marginVertical: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  urgency: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  pricing: {
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 18,
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  promoPrice: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  savings: {
    fontSize: 14,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  features: {
    gap: 10,
    marginBottom: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Compact version
  compactBanner: {
    borderRadius: 12,
    borderWidth: 1.5,
    marginVertical: 8,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  compactTextContainer: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  compactSubtitle: {
    fontSize: 12,
  },
});

