/**
 * Member Detail Screen
 * Comprehensive profile view with actions and history
 * 
 * Refactored to use modular components following WARP.md standards
 */
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useMemberDetail } from '@/hooks/membership/useMemberDetail';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { 
  ProfileHeader,
  ProfileTabContent,
  PaymentsTabContent,
  ActivityTabContent,
  MOCK_PAYMENT_HISTORY,
  MOCK_ACTIVITY_LOG,
} from '@/components/membership/member-detail';

export default function MemberDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const memberId = typeof params.id === 'string' ? params.id : params.id?.[0] || null;
  
  const [activeTab, setActiveTab] = useState<'profile' | 'payments' | 'activity'>('profile');
  
  const { 
    member, 
    loading, 
    error, 
    suspendMember,
    activateMember,
    deleteMember,
    approveRemoval,
    rejectRemoval,
    canRemoveMember,
    canApproveRemoval,
    isExecutive,
    isPendingRemoval,
  } = useMemberDetail(memberId);
  
  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading member details...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Error state
  if (error || !member) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.error || '#EF4444'} />
          <Text style={[styles.errorText, { color: theme.text }]}>
            {error || 'Member not found'}
          </Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleAction = (action: string) => {
    if (action === 'Suspend' || action === 'Suspend Membership') {
      Alert.alert(
        'Suspend Member',
        `Are you sure you want to suspend ${member.first_name}'s membership?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Suspend', 
            style: 'destructive',
            onPress: async () => {
              const success = await suspendMember();
              if (success) {
                Alert.alert('Success', 'Member has been suspended');
              }
            }
          },
        ]
      );
    } else if (action === 'Activate') {
      Alert.alert(
        'Activate Member',
        `Are you sure you want to activate ${member.first_name}'s membership?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Activate', 
            onPress: async () => {
              const success = await activateMember();
              if (success) {
                Alert.alert('Success', 'Member has been activated');
              }
            }
          },
        ]
      );
    } else if (action === 'Delete' || action === 'Remove Member') {
      // Check if member is an executive (protected from deletion)
      if (!canRemoveMember) {
        Alert.alert(
          'Cannot Remove Executive',
          `${member.first_name} is a ${member.member_type?.replace(/_/g, ' ')}.\n\nExecutive members cannot be removed directly. You must first demote them to a regular member role.`,
          [{ text: 'OK', style: 'cancel' }]
        );
        return;
      }

      Alert.alert(
        'Remove Member',
        `Are you sure you want to remove ${member.first_name || ''} ${member.last_name || ''} from the organization?\n\nThis will revoke their membership but their account will remain.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Remove', 
            style: 'destructive',
            onPress: async () => {
              try {
                const success = await deleteMember();
                if (success) {
                  Alert.alert('Success', 'Member has been removed', [
                    { text: 'OK', onPress: () => router.back() }
                  ]);
                } else {
                  Alert.alert('Error', 'Failed to remove member. You may not have permission to perform this action.');
                }
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Failed to remove member');
              }
            }
          },
        ]
      );
    } else if (action === 'Message') {
      // Navigate to message screen or open email/SMS
      if (member.phone) {
        Alert.alert(
          'Contact Member',
          `How would you like to contact ${member.first_name}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'WhatsApp', 
              onPress: () => {
                const phone = member.phone?.replace(/\D/g, '');
                const url = `whatsapp://send?phone=${phone}`;
                import('react-native').then(({ Linking }) => Linking.openURL(url));
              }
            },
            { 
              text: 'Call', 
              onPress: () => {
                import('react-native').then(({ Linking }) => Linking.openURL(`tel:${member.phone}`));
              }
            },
          ]
        );
      } else if (member.email) {
        import('react-native').then(({ Linking }) => Linking.openURL(`mailto:${member.email}`));
      } else {
        Alert.alert('No Contact', 'This member has no contact details on file.');
      }
    } else if (action === 'Invoice') {
      // Navigate to invoice/payment screen
      router.push(`/screens/membership/member-invoice?memberId=${member.id}`);
    } else if (action === 'Edit') {
      router.push(`/screens/membership/edit-member?memberId=${member.id}`);
    } else if (action === 'More') {
      const moreOptions: any[] = [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change Role', onPress: () => handleAction('Change Role') },
        { text: 'Transfer Region', onPress: () => handleAction('Transfer Region') },
      ];
      
      // Only show Remove option for non-executive members
      if (canRemoveMember) {
        moreOptions.push({ text: 'Remove Member', style: 'destructive', onPress: () => handleAction('Remove Member') });
      }
      
      Alert.alert(
        'More Actions',
        `Select an action for ${member.first_name}${isExecutive ? ' (Executive)' : ''}`,
        moreOptions
      );
    } else if (action === 'Change Role') {
      Alert.alert('Coming Soon', 'Role change functionality will be available soon.');
    } else if (action === 'Transfer Region') {
      Alert.alert('Coming Soon', 'Region transfer functionality will be available soon.');
    } else if (action === 'Renew Membership') {
      Alert.alert('Renew Membership', `Renew ${member.first_name}'s membership for another year?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Renew', onPress: () => Alert.alert('Coming Soon', 'Payment integration coming soon.') },
      ]);
    } else {
      Alert.alert(action, `Action "${action}" is not yet implemented.`);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Member Profile',
          headerRight: () => (
            <TouchableOpacity style={styles.headerButton} onPress={() => handleAction('Edit')}>
              <Ionicons name="create-outline" size={24} color={theme.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      <DashboardWallpaperBackground>
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
        >
        {/* Profile Header */}
        <ProfileHeader member={member} theme={theme} />

        {/* Pending Removal Banner */}
        {isPendingRemoval && (
          <View style={[styles.pendingRemovalBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <View style={styles.pendingRemovalContent}>
              <Ionicons name="warning-outline" size={24} color="#D97706" />
              <View style={styles.pendingRemovalText}>
                <Text style={[styles.pendingRemovalTitle, { color: '#92400E' }]}>
                  Pending Removal
                </Text>
                <Text style={[styles.pendingRemovalSubtitle, { color: '#B45309' }]}>
                  This member's removal is awaiting president approval
                </Text>
              </View>
            </View>
            {canApproveRemoval && (
              <View style={styles.pendingRemovalActions}>
                <TouchableOpacity
                  style={[styles.pendingRemovalButton, { backgroundColor: '#EF4444' }]}
                  onPress={() => {
                    Alert.alert(
                      'Confirm Removal',
                      `Are you sure you want to approve the removal of ${member.first_name} ${member.last_name}? This action cannot be undone.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Approve Removal',
                          style: 'destructive',
                          onPress: async () => {
                            const success = await approveRemoval();
                            if (success) {
                              Alert.alert('Removed', 'Member has been removed from the organization.', [
                                { text: 'OK', onPress: () => router.back() }
                              ]);
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.pendingRemovalButtonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pendingRemovalButton, { backgroundColor: '#10B981' }]}
                  onPress={() => {
                    Alert.alert(
                      'Restore Member',
                      `Are you sure you want to reject the removal request and restore ${member.first_name} ${member.last_name}'s membership?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Restore',
                          onPress: async () => {
                            const success = await rejectRemoval();
                            if (success) {
                              Alert.alert('Restored', 'Member has been restored to active status.');
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                  <Text style={styles.pendingRemovalButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.quickAction, { backgroundColor: theme.card }]}
            onPress={() => router.push(`/screens/membership/id-card?memberId=${member.id}`)}
          >
            <Ionicons name="card-outline" size={22} color={theme.primary} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>ID Card</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.quickAction, { backgroundColor: theme.card }]}
            onPress={() => handleAction('Message')}
          >
            <Ionicons name="chatbubble-outline" size={22} color={theme.primary} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>Message</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.quickAction, { backgroundColor: theme.card }]}
            onPress={() => handleAction('Invoice')}
          >
            <Ionicons name="receipt-outline" size={22} color={theme.primary} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>Invoice</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.quickAction, { backgroundColor: theme.card }]}
            onPress={() => handleAction('More')}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.primary} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>More</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'profile' && { backgroundColor: theme.primary + '20' }]}
            onPress={() => setActiveTab('profile')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'profile' ? theme.primary : theme.textSecondary }]}>
              Profile
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'payments' && { backgroundColor: theme.primary + '20' }]}
            onPress={() => setActiveTab('payments')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'payments' ? theme.primary : theme.textSecondary }]}>
              Payments
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'activity' && { backgroundColor: theme.primary + '20' }]}
            onPress={() => setActiveTab('activity')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'activity' ? theme.primary : theme.textSecondary }]}>
              Activity
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'profile' && <ProfileTabContent member={member} theme={theme} />}
          {activeTab === 'payments' && <PaymentsTabContent payments={MOCK_PAYMENT_HISTORY} theme={theme} />}
          {activeTab === 'activity' && <ActivityTabContent activities={MOCK_ACTIVITY_LOG} theme={theme} />}
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity 
          style={[styles.bottomAction, { backgroundColor: '#EF444420' }]}
          onPress={() => handleAction('Suspend Membership')}
        >
          <Ionicons name="pause-circle-outline" size={20} color="#EF4444" />
          <Text style={[styles.bottomActionText, { color: '#EF4444' }]}>Suspend</Text>
        </TouchableOpacity>
        
        {canRemoveMember ? (
          <TouchableOpacity 
            style={[styles.bottomAction, { backgroundColor: '#DC262620' }]}
            onPress={() => handleAction('Remove Member')}
          >
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
            <Text style={[styles.bottomActionText, { color: '#DC2626' }]}>Remove</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.bottomAction, { backgroundColor: theme.border + '40', opacity: 0.5 }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.bottomActionText, { color: theme.textSecondary }]}>Executive</Text>
          </View>
        )}
        
        <TouchableOpacity 
          style={[styles.bottomAction, { backgroundColor: theme.primary }]}
          onPress={() => handleAction('Renew Membership')}
        >
          <Ionicons name="refresh-outline" size={20} color="#fff" />
          <Text style={[styles.bottomActionText, { color: '#fff' }]}>Renew</Text>
        </TouchableOpacity>
      </View>
      </DashboardWallpaperBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    padding: 16,
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bottomAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  bottomActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Pending Removal Banner Styles
  pendingRemovalBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  pendingRemovalContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pendingRemovalText: {
    flex: 1,
  },
  pendingRemovalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  pendingRemovalSubtitle: {
    fontSize: 13,
  },
  pendingRemovalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  pendingRemovalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  pendingRemovalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
