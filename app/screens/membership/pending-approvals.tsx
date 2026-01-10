/**
 * Pending Approvals Screen - Youth President
 * Review and process approval requests
 * WARP.md compliant: <500 lines, separate styles, React Query
 */
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingApprovals, useApprovalStats, useProcessApproval, APPROVAL_TYPE_CONFIG, ApprovalRequest } from '@/hooks/membership/usePendingApprovals';
import { styles } from './pending-approvals.styles';

const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'history', label: 'History' },
] as const;

export default function PendingApprovalsScreen() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  // Route guard: Only youth_president can access approvals
  useEffect(() => {
    const memberType = (profile as any)?.organization_membership?.member_type;
    if (profile && memberType !== 'youth_president') {
      console.log('[PendingApprovals] Access denied - member_type:', memberType, '- redirecting');
      Alert.alert(
        'Access Restricted',
        'Only Youth President can access approvals.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [profile]);
  
  const { data: requests = [], isLoading, refetch } = usePendingApprovals(activeTab);
  const { data: stats } = useApprovalStats();
  const processMutation = useProcessApproval();

  const handleAction = (item: ApprovalRequest, action: 'approve' | 'reject') => {
    Alert.alert(
      action === 'approve' ? 'Approve Request' : 'Reject Request',
      `Are you sure you want to ${action} this request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : 'Reject',
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: () => {
            try {
              processMutation.mutate({ 
                id: item.id, 
                action,
                sourceTable: item.sourceTable || 'join_requests',
              });
            } catch (error) {
              console.error('[PendingApprovals] Error processing approval:', error);
              Alert.alert('Error', 'Failed to process approval. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const formatAmount = (amount: number) => `R${amount.toLocaleString()}`;

  const renderRequest = ({ item }: { item: ApprovalRequest }) => {
    const typeConfig = APPROVAL_TYPE_CONFIG[item.type];
    return (
      <View style={[styles.approvalCard, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeIconContainer, { backgroundColor: typeConfig.color + '20' }]}>
            <Ionicons name={typeConfig.icon as any} size={22} color={typeConfig.color} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.requestTitle, { color: colors.text }]}>{item.title}</Text>
            <View style={styles.requestMeta}>
              <Text style={[styles.requestMetaText, { color: colors.textSecondary }]}>{item.requestedBy}</Text>
              <View style={[styles.metaDot, { backgroundColor: colors.textSecondary }]} />
              <Text style={[styles.requestMetaText, { color: colors.textSecondary }]}>{formatDate(item.requestedAt)}</Text>
            </View>
          </View>
          {item.isUrgent && item.status === 'pending' && (
            <View style={[styles.urgentBadge, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="alert-circle" size={12} color="#EF4444" />
              <Text style={[styles.urgentText, { color: '#EF4444' }]}>Urgent</Text>
            </View>
          )}
        </View>

        <Text style={[styles.requestDescription, { color: colors.textSecondary }]} numberOfLines={3}>{item.description}</Text>

        <View style={styles.requestDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="pricetag-outline" size={14} color={typeConfig.color} />
            <Text style={[styles.detailText, { color: colors.text }]}>{typeConfig.label}</Text>
          </View>
          {item.amount && (
            <View style={styles.detailItem}>
              <Ionicons name="cash-outline" size={14} color="#10B981" />
              <Text style={[styles.detailText, styles.amountHighlight, { color: '#10B981' }]}>{formatAmount(item.amount)}</Text>
            </View>
          )}
        </View>

        {item.status === 'pending' ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleAction(item, 'reject')}
              disabled={processMutation.isPending}
            >
              <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
              <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleAction(item, 'approve')}
              disabled={processMutation.isPending}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
              <Text style={[styles.actionButtonText, { color: '#10B981' }]}>Approve</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.historyInfo, { borderTopColor: colors.border }]}>
            <View style={[styles.statusBadge, { backgroundColor: item.status === 'approved' ? '#D1FAE5' : '#FEE2E2' }]}>
              <Ionicons
                name={item.status === 'approved' ? 'checkmark-circle' : 'close-circle'}
                size={14}
                color={item.status === 'approved' ? '#10B981' : '#EF4444'}
              />
              <Text style={[styles.statusText, { color: item.status === 'approved' ? '#10B981' : '#EF4444' }]}>
                {item.status === 'approved' ? 'Approved' : 'Rejected'}
              </Text>
            </View>
            <Text style={[styles.historyText, { color: colors.textSecondary }]}>
              by {item.processedBy} • {item.processedAt && formatDate(item.processedAt)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Pending Approvals</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Review requests</Text>
          </View>
        </View>

        {/* Stats Bar */}
        {stats && (
          <View style={[styles.statsBar, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.pending}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#EF4444' }]}>{stats.urgent}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Urgent</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>{stats.processed}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Processed</Text>
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsList}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, { backgroundColor: activeTab === tab.id ? colors.primary : colors.cardBackground }]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabText, { color: activeTab === tab.id ? '#fff' : colors.text }]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* List */}
        <FlatList
          data={requests}
          renderItem={renderRequest}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onRefresh={refetch}
          refreshing={isLoading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {activeTab === 'pending' ? 'All caught up!' : 'No history yet'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {activeTab === 'pending' ? 'No pending requests to review' : 'Processed requests will appear here'}
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}
