import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAds } from '@/contexts/AdsContext';
import { useTheme } from '@/contexts/ThemeContext';
import SubscriptionAdGate from '@/components/ui/SubscriptionAdGate';
import AdBannerWithUpgrade from '@/components/ui/AdBannerWithUpgrade';

/**
 * AdTestingPanel - Debug component for testing ad integration
 * 
 * Shows subscription status, ad controls, and test functionality
 * Only visible in development mode or when explicitly enabled
 */
export const AdTestingPanel: React.FC = () => {
  const { tier, ready: subscriptionReady } = useSubscription();
  const { maybeShowInterstitial, offerRewarded, canShowBanner } = useAds();
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  // Only show in development or if testing flag is set
  const shouldShow = __DEV__ || process.env.EXPO_PUBLIC_SHOW_AD_TEST_PANEL === 'true';
  
  if (!shouldShow) return null;

  const showAds = subscriptionReady && tier === 'free';

  const testInterstitial = async () => {
    const shown = await maybeShowInterstitial('test_debug_interstitial');
    Alert.alert('Test Result', `Interstitial shown: ${shown}`);
  };

  const testRewarded = async () => {
    const result = await offerRewarded('test_debug_rewarded');
    Alert.alert('Test Result', `Rewarded ad - Shown: ${result.shown}, Rewarded: ${result.rewarded}`);
  };

  const styles = StyleSheet.create({
    panel: {
      position: 'absolute',
      top: 100,
      right: 16,
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      zIndex: 1000,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      backgroundColor: '#FF6B35',
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    headerText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 4,
    },
    content: {
      padding: 12,
      minWidth: 200,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    statusLabel: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    statusValue: {
      fontSize: 12,
      fontWeight: '600',
      color: showAds ? '#10B981' : '#DC2626',
    },
    button: {
      backgroundColor: theme.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 4,
      marginBottom: 6,
    },
    buttonDisabled: {
      backgroundColor: theme.textSecondary,
      opacity: 0.5,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
    },
    bannerTest: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    testLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginBottom: 4,
    },
  });

  return (
    <View style={styles.panel}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)}>
        <Ionicons name="bug" size={16} color="#FFFFFF" />
        <Text style={styles.headerText}>Ad Debug</Text>
        <Ionicons 
          name={expanded ? "chevron-up" : "chevron-down"} 
          size={16} 
          color="#FFFFFF" 
          style={{ marginLeft: 'auto' }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {/* Subscription Status */}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Subscription Ready:</Text>
            <Text style={styles.statusValue}>{subscriptionReady ? 'Yes' : 'No'}</Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Current Tier:</Text>
            <Text style={styles.statusValue}>{tier || 'Unknown'}</Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Show Ads:</Text>
            <Text style={styles.statusValue}>{showAds ? 'Yes' : 'No'}</Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Can Show Banner:</Text>
            <Text style={styles.statusValue}>{canShowBanner ? 'Yes' : 'No'}</Text>
          </View>

          {/* Test Controls */}
          <TouchableOpacity
            style={[styles.button, !showAds && styles.buttonDisabled]}
            onPress={testInterstitial}
            disabled={!showAds}
          >
            <Text style={styles.buttonText}>Test Interstitial</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, !showAds && styles.buttonDisabled]}
            onPress={testRewarded}
            disabled={!showAds}
          >
            <Text style={styles.buttonText}>Test Rewarded Ad</Text>
          </TouchableOpacity>

          {/* Banner Test */}
          <View style={styles.bannerTest}>
            <Text style={styles.testLabel}>Banner Test:</Text>
            <SubscriptionAdGate>
              <AdBannerWithUpgrade 
                screen="debug_panel" 
                showUpgradeCTA={true} 
                margin={4}
              />
            </SubscriptionAdGate>
            {!showAds && (
              <Text style={[styles.testLabel, { color: theme.textSecondary, textAlign: 'center' }]}>
                No banner (tier: {tier})
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
};