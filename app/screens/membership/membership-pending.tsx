/**
 * Membership Pending Screen
 * Shown to users whose membership is awaiting approval from the President
 * 
 * This screen is displayed when:
 * 1. User registered via invite code
 * 2. User registered via website
 * 3. Membership status is 'pending' or 'pending_verification'
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';

interface MembershipStatus {
  status: 'pending' | 'pending_verification' | 'active' | 'suspended' | 'revoked';
  memberType: string;
  organizationName: string;
  regionName?: string;
  requestedAt: string;
  message?: string;
}

export default function MembershipPendingScreen() {
  const { user, profile, signOut } = useAuth();
  const { theme } = useTheme();
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMembershipStatus = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const supabase = assertSupabase();
      
      // Fetch organization membership with organization and region details
      const { data: membership, error } = await supabase
        .from('organization_members')
        .select(`
          membership_status,
          member_type,
          created_at,
          organization:organizations(name),
          region:organization_regions(name)
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[MembershipPending] Error fetching membership:', error);
        return;
      }

      if (membership) {
        setMembershipStatus({
          status: membership.membership_status as MembershipStatus['status'],
          memberType: membership.member_type,
          organizationName: (membership.organization as any)?.name || 'Organization',
          regionName: (membership.region as any)?.name,
          requestedAt: membership.created_at,
        });

        // If status is now 'active', redirect to dashboard
        if (membership.membership_status === 'active') {
          Alert.alert(
            'Membership Approved! 🎉',
            'Your membership has been approved. Welcome aboard!',
            [{ text: 'Continue', onPress: () => router.replace('/profiles-gate') }]
          );
        }
      }
    } catch (error) {
      console.error('[MembershipPending] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMembershipStatus();
  }, [fetchMembershipStatus]);

  // Set up real-time subscription for status changes
  useEffect(() => {
    if (!user?.id) return;

    const supabase = assertSupabase();
    const channel = supabase
      .channel('membership-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organization_members',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[MembershipPending] Membership updated:', payload);
          const newStatus = payload.new?.membership_status;
          
          if (newStatus === 'active') {
            Alert.alert(
              'Membership Approved! 🎉',
              'Your membership has been approved by the President. Welcome aboard!',
              [{ text: 'Continue', onPress: () => router.replace('/profiles-gate') }]
            );
          } else if (newStatus === 'revoked' || newStatus === 'suspended') {
            Alert.alert(
              'Membership Update',
              'Your membership request was not approved. Please contact the organization for more information.',
              [{ text: 'OK' }]
            );
          }
          
          fetchMembershipStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchMembershipStatus]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMembershipStatus();
  }, [fetchMembershipStatus]);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You can sign back in anytime to check your membership status.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/sign-in');
          }
        },
      ]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'For assistance with your membership application, please contact:\n\n• Email: support@soilofafrica.org\n• WhatsApp: +27 XX XXX XXXX',
      [{ text: 'OK' }]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getMemberTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      youth_member: 'Youth Member',
      youth_president: 'Youth President',
      youth_secretary: 'Youth Secretary',
      youth_coordinator: 'Youth Coordinator',
      learner: 'Learner',
      member: 'Member',
    };
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Checking membership status...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <DashboardWallpaperBackground>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: `${theme.warning}20` }]}>
              <Ionicons name="hourglass-outline" size={64} color={theme.warning || '#F59E0B'} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              Membership Pending
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Your membership application is awaiting approval from the Youth President
            </Text>
          </View>

          {/* Status Card */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={24} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Application Details</Text>
            </View>
            
            <View style={styles.cardContent}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Organization</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {membershipStatus?.organizationName || 'Soil of Africa'}
                </Text>
              </View>
              
              {membershipStatus?.regionName && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Region</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {membershipStatus.regionName}
                  </Text>
                </View>
              )}
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Role Requested</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {getMemberTypeLabel(membershipStatus?.memberType || 'member')}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Applied On</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {membershipStatus?.requestedAt ? formatDate(membershipStatus.requestedAt) : 'N/A'}
                </Text>
              </View>
              
              <View style={[styles.statusBadge, { backgroundColor: `${theme.warning}20` }]}>
                <Ionicons name="time-outline" size={16} color={theme.warning || '#F59E0B'} />
                <Text style={[styles.statusText, { color: theme.warning || '#F59E0B' }]}>
                  Awaiting Approval
                </Text>
              </View>
            </View>
          </View>

          {/* Info Card */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="information-circle-outline" size={24} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>What happens next?</Text>
            </View>
            
            <View style={styles.cardContent}>
              <View style={styles.infoStep}>
                <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={[styles.stepText, { color: theme.text }]}>
                  The Youth President will review your application
                </Text>
              </View>
              
              <View style={styles.infoStep}>
                <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={[styles.stepText, { color: theme.text }]}>
                  You'll receive a notification when approved
                </Text>
              </View>
              
              <View style={styles.infoStep}>
                <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={[styles.stepText, { color: theme.text }]}>
                  Once approved, you can access all member features
                </Text>
              </View>
            </View>
          </View>

          {/* Refresh Hint */}
          <Text style={[styles.refreshHint, { color: theme.textSecondary }]}>
            Pull down to refresh your status
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={handleContactSupport}
            >
              <Ionicons name="help-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Contact Support</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { borderColor: theme.border }]}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={20} color={theme.text} />
              <Text style={[styles.actionButtonText, { color: theme.text }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </DashboardWallpaperBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepText: {
    fontSize: 14,
    flex: 1,
  },
  refreshHint: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
