/**
 * SubscriptionStatusCard Component
 * 
 * Displays current subscription status, payment history, and upgrade options.
 * Used in parent dashboard and settings screens.
 * 
 * Complies with WARP.md:
 * - Component ≤400 lines (excluding StyleSheet)
 * - Mobile-first design
 * - Analytics tracking
 */

import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useRealtimeTier } from '@/hooks/useRealtimeTier';
import { TierBadge } from '@/components/ui/TierBadge';
import { track } from '@/lib/analytics';
import { assertSupabase } from '@/lib/supabase';

export interface PaymentHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  plan_name: string;
  created_at: string;
  pf_payment_id?: string;
}

export interface SubscriptionStatusCardProps {
  /** Show payment history section */
  showPaymentHistory?: boolean;
  /** Show upgrade CTA */
  showUpgradeCTA?: boolean;
  /** Show cancellation option */
  showCancelOption?: boolean;
  /** Custom container style */
  containerStyle?: object;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format amount as ZAR currency
 */
function formatCurrency(amount: number): string {
  return `R${amount.toFixed(2)}`;
}

/**
 * Get status color
 */
function getStatusColor(status: string, theme: any): string {
  switch (status) {
    case 'completed':
    case 'active':
      return theme.success;
    case 'pending':
    case 'trialing':
      return theme.warning;
    case 'failed':
    case 'cancelled':
    case 'expired':
      return theme.error;
    default:
      return theme.textSecondary;
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
    case 'active':
      return 'checkmark-circle';
    case 'pending':
    case 'trialing':
      return 'time';
    case 'failed':
    case 'cancelled':
      return 'close-circle';
    default:
      return 'help-circle';
  }
}

export const SubscriptionStatusCard: React.FC<SubscriptionStatusCardProps> = ({
  showPaymentHistory = true,
  showUpgradeCTA = true,
  showCancelOption = true,
  containerStyle,
}) => {
  const { theme, isDark } = useTheme();
  const { user, profile } = useAuth();
  const { tier, ready: subReady, refresh: refreshSubscription } = useSubscription();
  const { tierStatus, isLoading: tierLoading, refresh: refreshTier } = useRealtimeTier();
  
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [showAllPayments, setShowAllPayments] = useState(false);
  
  /**
   * Fetch payment history from database
   */
  const fetchPaymentHistory = useCallback(async () => {
    if (!user?.id) return;
    
    setLoadingHistory(true);
    try {
      const supabase = assertSupabase();
      
      // Fetch payment transactions
      const { data: transactions, error } = await supabase
        .from('payment_transactions')
        .select('id, amount, status, created_at, completed_at, metadata, payfast_payment_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      const history: PaymentHistoryItem[] = (transactions || []).map((tx: any) => ({
        id: tx.id,
        amount: tx.amount || 0,
        currency: 'ZAR',
        status: tx.status,
        plan_name: tx.metadata?.plan_name || 'Subscription',
        created_at: tx.created_at,
        pf_payment_id: tx.payfast_payment_id,
      }));
      
      setPaymentHistory(history);
      
      // Also fetch current subscription details
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select(`
          id, status, start_date, end_date, next_billing_date, billing_frequency,
          subscription_plans(name, tier, price_monthly)
        `)
        .eq('school_id', (profile as any)?.preschool_id || (profile as any)?.organization_id)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setSubscriptionDetails(subscription);
      
    } catch (err) {
      console.error('[SubscriptionStatusCard] Error fetching payment history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [user?.id, profile]);
  
  // Load payment history on mount
  React.useEffect(() => {
    if (showPaymentHistory) {
      fetchPaymentHistory();
    }
  }, [showPaymentHistory, fetchPaymentHistory]);
  
  /**
   * Handle subscription cancellation
   */
  const handleCancelSubscription = useCallback(() => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            try {
              track('edudash.subscription.cancel_requested', {
                user_id: user?.id,
                current_tier: tier,
              });
              
              // Call cancellation endpoint (to be implemented)
              Alert.alert(
                'Contact Support',
                'To cancel your subscription, please contact support@edudashpro.org.za. We\'ll process your request within 24 hours.',
                [{ text: 'OK' }]
              );
            } catch (err) {
              console.error('[SubscriptionStatusCard] Cancellation error:', err);
              Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
            }
          },
        },
      ]
    );
  }, [user?.id, tier]);
  
  /**
   * Handle upgrade press
   */
  const handleUpgradePress = useCallback(() => {
    track('edudash.subscription.upgrade_clicked', {
      user_id: user?.id,
      current_tier: tier,
      source: 'subscription_status_card',
    });
    router.push('/pricing');
  }, [user?.id, tier]);
  
  const isFreeTier = tier === 'free';
  const planDetails = subscriptionDetails?.subscription_plans?.[0] || subscriptionDetails?.subscription_plans;
  
  return (
    <View style={[styles.container, { backgroundColor: theme.surface }, containerStyle]}>
      {/* Current Plan Section */}
      <View style={styles.planSection}>
        <View style={styles.planHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Current Plan
          </Text>
          <TierBadge tier={tier} size="md" />
        </View>
        
        {subscriptionDetails && !isFreeTier ? (
          <View style={styles.planDetails}>
            <View style={styles.planDetailRow}>
              <Ionicons 
                name={getStatusIcon(subscriptionDetails.status) as any} 
                size={16} 
                color={getStatusColor(subscriptionDetails.status, theme)} 
              />
              <Text style={[styles.planDetailText, { color: theme.text }]}>
                Status: <Text style={{ fontWeight: '600' }}>{subscriptionDetails.status}</Text>
              </Text>
            </View>
            
            {planDetails?.price_monthly && (
              <View style={styles.planDetailRow}>
                <Ionicons name="card" size={16} color={theme.textSecondary} />
                <Text style={[styles.planDetailText, { color: theme.text }]}>
                  {formatCurrency(planDetails.price_monthly)}/{subscriptionDetails.billing_frequency || 'month'}
                </Text>
              </View>
            )}
            
            {subscriptionDetails.next_billing_date && (
              <View style={styles.planDetailRow}>
                <Ionicons name="calendar" size={16} color={theme.textSecondary} />
                <Text style={[styles.planDetailText, { color: theme.text }]}>
                  Next billing: {formatDate(subscriptionDetails.next_billing_date)}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={[styles.freeTierText, { color: theme.textSecondary }]}>
            You're on the free plan with limited AI features.
          </Text>
        )}
        
        {/* Upgrade CTA for free tier */}
        {showUpgradeCTA && isFreeTier && (
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: theme.primary }]}
            onPress={handleUpgradePress}
          >
            <LinearGradient
              colors={[theme.primary, '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.upgradeGradient}
            >
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        
        {/* Cancel option for paid tiers */}
        {showCancelOption && !isFreeTier && subscriptionDetails?.status === 'active' && (
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: theme.border }]}
            onPress={handleCancelSubscription}
          >
            <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
              Cancel Subscription
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Payment History Section */}
      {showPaymentHistory && (
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Payment History
            </Text>
            {paymentHistory.length > 3 && (
              <TouchableOpacity onPress={() => setShowAllPayments(!showAllPayments)}>
                <Text style={[styles.viewAllText, { color: theme.primary }]}>
                  {showAllPayments ? 'Show Less' : 'View All'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {loadingHistory ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : paymentHistory.length > 0 ? (
            <View style={styles.historyList}>
              {(showAllPayments ? paymentHistory : paymentHistory.slice(0, 3)).map((payment) => (
                <View 
                  key={payment.id} 
                  style={[styles.paymentItem, { borderBottomColor: theme.border }]}
                >
                  <View style={styles.paymentLeft}>
                    <Ionicons 
                      name={getStatusIcon(payment.status) as any}
                      size={20}
                      color={getStatusColor(payment.status, theme)}
                    />
                    <View style={styles.paymentInfo}>
                      <Text style={[styles.paymentPlan, { color: theme.text }]}>
                        {payment.plan_name}
                      </Text>
                      <Text style={[styles.paymentDate, { color: theme.textSecondary }]}>
                        {formatDate(payment.created_at)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={[styles.paymentAmount, { color: theme.text }]}>
                      {formatCurrency(payment.amount)}
                    </Text>
                    <Text style={[styles.paymentStatus, { color: getStatusColor(payment.status, theme) }]}>
                      {payment.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyHistory}>
              <Ionicons name="receipt-outline" size={32} color={theme.textSecondary} />
              <Text style={[styles.emptyHistoryText, { color: theme.textSecondary }]}>
                No payment history yet
              </Text>
            </View>
          )}
        </View>
      )}
      
      {/* Refresh Button */}
      <TouchableOpacity
        style={[styles.refreshButton, { borderColor: theme.border }]}
        onPress={() => {
          refreshTier();
          refreshSubscription();
          fetchPaymentHistory();
        }}
      >
        <Ionicons name="refresh" size={16} color={theme.textSecondary} />
        <Text style={[styles.refreshText, { color: theme.textSecondary }]}>
          Refresh
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  planSection: {
    marginBottom: 20,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  planDetails: {
    gap: 8,
    marginBottom: 16,
  },
  planDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planDetailText: {
    fontSize: 14,
  },
  freeTierText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  upgradeButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 14,
  },
  historySection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  historyList: {
    gap: 0,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentPlan: {
    fontSize: 14,
    fontWeight: '500',
  },
  paymentDate: {
    fontSize: 12,
    marginTop: 2,
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentStatus: {
    fontSize: 12,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyHistoryText: {
    fontSize: 14,
    marginTop: 8,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 16,
  },
  refreshText: {
    fontSize: 13,
  },
});

export default SubscriptionStatusCard;
