/**
 * Budget Requests Screen
 * Manages budget requests and approvals for Youth President dashboard
 */
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { useBudgetRequests, BudgetRequest, STATUS_CONFIG } from '@/hooks/membership/useBudgetRequests';
import { BudgetRequestForm } from '@/components/membership/BudgetRequestForm';
import { styles } from './budget-requests.styles';

type FilterType = 'all' | 'pending' | 'approved' | 'rejected';
const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected' },
];

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(amount);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

export default function BudgetRequestsScreen() {
  const { theme } = useTheme();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', amount: '', category: 'Events' });

  const { requests, isLoading, isRefreshing, stats, refetch, submitRequest, isSubmitting } = useBudgetRequests(activeFilter);

  const handleSubmit = async () => {
    if (!formData.title.trim()) return Alert.alert('Error', 'Please enter a title');
    if (!formData.amount || parseFloat(formData.amount) <= 0) return Alert.alert('Error', 'Please enter a valid amount');

    try {
      await submitRequest({ title: formData.title, description: formData.description, amount: parseFloat(formData.amount), category: formData.category, submitted_by: 'Youth President' });
      setShowModal(false);
      setFormData({ title: '', description: '', amount: '', category: 'Events' });
      Alert.alert('Success', 'Budget request submitted successfully');
    } catch { Alert.alert('Error', 'Failed to submit request'); }
  };

  const renderRequestItem = ({ item }: { item: BudgetRequest }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    return (
      <TouchableOpacity style={[styles.requestCard, { backgroundColor: theme.card }]}>
        <View style={styles.requestHeader}>
          <View style={styles.requestHeaderLeft}>
            <Text style={[styles.requestTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.categoryBadge, { backgroundColor: theme.primary + '15' }]}>
              <Text style={[styles.categoryText, { color: theme.primary }]}>{item.category}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>
        <View style={styles.amountContainer}>
          <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>Amount:</Text>
          <Text style={[styles.amountValue, { color: '#10B981' }]}>{formatCurrency(item.amount)}</Text>
        </View>
        {item.description && <Text style={[styles.requestDescription, { color: theme.textSecondary }]} numberOfLines={2}>{item.description}</Text>}
        <View style={styles.requestFooter}>
          <View style={styles.footerItem}><Ionicons name="calendar-outline" size={14} color={theme.textSecondary} /><Text style={[styles.footerText, { color: theme.textSecondary }]}>{formatDate(item.submitted_at)}</Text></View>
          {item.reviewed_by && <View style={styles.footerItem}><Ionicons name="person-outline" size={14} color={theme.textSecondary} /><Text style={[styles.footerText, { color: theme.textSecondary }]}>{item.reviewed_by}</Text></View>}
        </View>
        {item.notes && <View style={[styles.notesContainer, { backgroundColor: theme.background }]}><Ionicons name="chatbubble-outline" size={14} color={theme.textSecondary} /><Text style={[styles.notesText, { color: theme.textSecondary }]}>{item.notes}</Text></View>}
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="receipt-outline" size={64} color={theme.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No Budget Requests</Text>
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Submit your first budget request</Text>
    </View>
  );

  if (isLoading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}><View style={styles.loadingContainer}><ActivityIndicator size="large" color="#10B981" /><Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading...</Text></View></SafeAreaView>;
  }

  return (
    <DashboardWallpaperBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Budget Requests</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{stats.pending} pending • {formatCurrency(stats.pendingAmount)}</Text>
          </View>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: '#10B981' }]} onPress={() => setShowModal(true)}><Ionicons name="add" size={24} color="#fff" /></TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}><Ionicons name="document-text" size={24} color="#3B82F6" /><Text style={[styles.statCardValue, { color: theme.text }]}>{stats.total}</Text><Text style={[styles.statCardLabel, { color: theme.textSecondary }]}>Total</Text></View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}><Ionicons name="time" size={24} color="#F59E0B" /><Text style={[styles.statCardValue, { color: theme.text }]}>{stats.pending}</Text><Text style={[styles.statCardLabel, { color: theme.textSecondary }]}>Pending</Text></View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}><Ionicons name="checkmark-circle" size={24} color="#10B981" /><Text style={[styles.statCardValue, { color: theme.text }]}>{stats.approved}</Text><Text style={[styles.statCardLabel, { color: theme.textSecondary }]}>Approved</Text></View>
        </View>

        <View style={styles.filtersContainer}>
          <FlatList horizontal showsHorizontalScrollIndicator={false} data={FILTERS} keyExtractor={(i) => i.key} contentContainerStyle={styles.filtersList}
            renderItem={({ item }) => <TouchableOpacity style={[styles.filterChip, { backgroundColor: activeFilter === item.key ? '#10B981' : theme.card, borderColor: activeFilter === item.key ? '#10B981' : theme.border }]} onPress={() => setActiveFilter(item.key)}><Text style={[styles.filterText, { color: activeFilter === item.key ? '#fff' : theme.text }]}>{item.label}</Text></TouchableOpacity>} />
        </View>

        <FlatList data={requests} keyExtractor={(i) => i.id} renderItem={renderRequestItem} contentContainerStyle={styles.listContent} ListEmptyComponent={renderEmptyList}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} colors={['#10B981']} tintColor="#10B981" />} ItemSeparatorComponent={() => <View style={styles.separator} />} />

        <BudgetRequestForm visible={showModal} onClose={() => setShowModal(false)} onSubmit={handleSubmit} isSubmitting={isSubmitting} formData={formData} setFormData={setFormData} theme={theme} />
      </SafeAreaView>
    </DashboardWallpaperBackground>
  );
}
