/**
 * Finance Dashboard Screen
 * Comprehensive financial tracking for membership payments, invoices, and reports
 */
import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  FlatList,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
interface FinancialSummary {
  totalRevenue: number;
  thisMonth: number;
  outstanding: number;
  pendingPayments: number;
  collectionRate: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  member_name: string;
  member_number: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  due_date: string;
  paid_date?: string;
}

interface Payment {
  id: string;
  member_name: string;
  amount: number;
  payment_method: 'card' | 'eft' | 'cash' | 'payfast';
  reference: string;
  created_at: string;
  status: 'completed' | 'pending' | 'failed';
}

interface RegionFinance {
  region: string;
  code: string;
  collected: number;
  outstanding: number;
  members_paid: number;
  total_members: number;
}

// Mock Data
const FINANCIAL_SUMMARY: FinancialSummary = {
  totalRevenue: 1250000,
  thisMonth: 185000,
  outstanding: 320000,
  pendingPayments: 47,
  collectionRate: 78.5,
};

const RECENT_PAYMENTS: Payment[] = [
  { id: '1', member_name: 'Thabo Mokoena', amount: 1200, payment_method: 'payfast', reference: 'PF-202412-001', created_at: '2024-12-23T10:30:00', status: 'completed' },
  { id: '2', member_name: 'Sarah Johnson', amount: 2500, payment_method: 'eft', reference: 'EFT-202412-015', created_at: '2024-12-23T09:15:00', status: 'completed' },
  { id: '3', member_name: 'James Ndlovu', amount: 1200, payment_method: 'card', reference: 'CARD-202412-089', created_at: '2024-12-22T16:45:00', status: 'pending' },
  { id: '4', member_name: 'Nomvula Dlamini', amount: 5000, payment_method: 'eft', reference: 'EFT-202412-016', created_at: '2024-12-22T14:20:00', status: 'completed' },
  { id: '5', member_name: 'Lindiwe Sithole', amount: 1200, payment_method: 'cash', reference: 'CASH-202412-003', created_at: '2024-12-22T11:00:00', status: 'completed' },
];

const OVERDUE_INVOICES: Invoice[] = [
  { id: 'i1', invoice_number: 'INV-2024-0892', member_name: 'Sipho Nkosi', member_number: 'SOA-GP-24-00234', amount: 1200, status: 'overdue', due_date: '2024-12-01' },
  { id: 'i2', invoice_number: 'INV-2024-0845', member_name: 'Maria van der Berg', member_number: 'SOA-WC-24-00089', amount: 2500, status: 'overdue', due_date: '2024-11-28' },
  { id: 'i3', invoice_number: 'INV-2024-0801', member_name: 'David Pillay', member_number: 'SOA-KZN-24-00156', amount: 1200, status: 'overdue', due_date: '2024-11-25' },
];

const REGIONAL_FINANCE: RegionFinance[] = [
  { region: 'Gauteng', code: 'GP', collected: 425000, outstanding: 85000, members_paid: 312, total_members: 387 },
  { region: 'Western Cape', code: 'WC', collected: 285000, outstanding: 62000, members_paid: 198, total_members: 245 },
  { region: 'KwaZulu-Natal', code: 'KZN', collected: 198000, outstanding: 78000, members_paid: 145, total_members: 201 },
  { region: 'Eastern Cape', code: 'EC', collected: 125000, outstanding: 45000, members_paid: 89, total_members: 124 },
  { region: 'Limpopo', code: 'LP', collected: 98000, outstanding: 32000, members_paid: 72, total_members: 98 },
];

const PAYMENT_METHOD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  card: 'card-outline',
  eft: 'swap-horizontal-outline',
  cash: 'cash-outline',
  payfast: 'flash-outline',
};

const STATUS_COLORS = {
  completed: '#10B981',
  pending: '#F59E0B',
  failed: '#EF4444',
  paid: '#10B981',
  overdue: '#EF4444',
  cancelled: '#6B7280',
};

export default function FinanceScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'invoices'>('overview');

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const formatCurrency = (amount: number): string => {
    return `R ${amount.toLocaleString('en-ZA')}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  };

  const renderOverview = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Stats Card */}
      <LinearGradient
        colors={['#059669', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.heroLabel}>Total Revenue (2024)</Text>
            <Text style={styles.heroAmount}>{formatCurrency(FINANCIAL_SUMMARY.totalRevenue)}</Text>
          </View>
          <View style={styles.heroIconBg}>
            <Ionicons name="wallet-outline" size={32} color="#fff" />
          </View>
        </View>
        
        <View style={styles.heroStats}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>This Month</Text>
            <Text style={styles.heroStatValue}>{formatCurrency(FINANCIAL_SUMMARY.thisMonth)}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Outstanding</Text>
            <Text style={[styles.heroStatValue, { color: '#FCD34D' }]}>
              {formatCurrency(FINANCIAL_SUMMARY.outstanding)}
            </Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Collection Rate</Text>
            <Text style={styles.heroStatValue}>{FINANCIAL_SUMMARY.collectionRate}%</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: theme.card }]}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="receipt-outline" size={22} color="#3B82F6" />
            </View>
            <Text style={[styles.quickActionText, { color: theme.text }]}>Create Invoice</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: theme.card }]}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="add-circle-outline" size={22} color="#10B981" />
            </View>
            <Text style={[styles.quickActionText, { color: theme.text }]}>Record Payment</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: theme.card }]}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#8B5CF620' }]}>
              <Ionicons name="analytics-outline" size={22} color="#8B5CF6" />
            </View>
            <Text style={[styles.quickActionText, { color: theme.text }]}>View Reports</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: theme.card }]}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="send-outline" size={22} color="#F59E0B" />
            </View>
            <Text style={[styles.quickActionText, { color: theme.text }]}>Send Reminders</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Overdue Invoices Alert */}
      {OVERDUE_INVOICES.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <Text style={[styles.sectionTitle, { color: theme.text, marginLeft: 8 }]}>
                Overdue Invoices
              </Text>
            </View>
            <TouchableOpacity>
              <Text style={[styles.seeAll, { color: theme.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          
          {OVERDUE_INVOICES.map((invoice, index) => (
            <TouchableOpacity 
              key={invoice.id}
              style={[styles.overdueCard, { backgroundColor: '#FEE2E2' }]}
            >
              <View style={styles.overdueInfo}>
                <Text style={[styles.overdueName, { color: '#991B1B' }]}>{invoice.member_name}</Text>
                <Text style={[styles.overdueNumber, { color: '#DC2626' }]}>{invoice.invoice_number}</Text>
                <Text style={[styles.overdueDue, { color: '#B91C1C' }]}>Due: {formatDate(invoice.due_date)}</Text>
              </View>
              <View style={styles.overdueRight}>
                <Text style={[styles.overdueAmount, { color: '#991B1B' }]}>{formatCurrency(invoice.amount)}</Text>
                <TouchableOpacity style={styles.reminderButton}>
                  <Ionicons name="notifications-outline" size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Regional Finance Breakdown */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Regional Performance</Text>
        </View>
        
        {REGIONAL_FINANCE.map((region, index) => {
          const percentage = Math.round((region.members_paid / region.total_members) * 100);
          
          return (
            <View key={region.code} style={[styles.regionFinanceCard, { backgroundColor: theme.card }]}>
              <View style={styles.regionFinanceHeader}>
                <View style={styles.regionFinanceInfo}>
                  <Text style={[styles.regionName, { color: theme.text }]}>{region.region}</Text>
                  <Text style={[styles.regionMembers, { color: theme.textSecondary }]}>
                    {region.members_paid}/{region.total_members} members paid
                  </Text>
                </View>
                <View style={styles.regionFinanceAmounts}>
                  <Text style={[styles.regionCollected, { color: '#10B981' }]}>
                    {formatCurrency(region.collected)}
                  </Text>
                  <Text style={[styles.regionOutstanding, { color: theme.textSecondary }]}>
                    {formatCurrency(region.outstanding)} due
                  </Text>
                </View>
              </View>
              
              <View style={styles.progressContainer}>
                <View style={[styles.progressBg, { backgroundColor: theme.border }]}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        backgroundColor: percentage >= 80 ? '#10B981' : percentage >= 50 ? '#F59E0B' : '#EF4444',
                        width: `${percentage}%` 
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.progressText, { color: theme.textSecondary }]}>{percentage}%</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Recent Payments */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Payments</Text>
          <TouchableOpacity onPress={() => setActiveTab('payments')}>
            <Text style={[styles.seeAll, { color: theme.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>
        
        {RECENT_PAYMENTS.slice(0, 4).map((payment) => (
          <View key={payment.id} style={[styles.paymentCard, { backgroundColor: theme.card }]}>
            <View style={[styles.paymentIcon, { backgroundColor: theme.surface }]}>
              <Ionicons 
                name={PAYMENT_METHOD_ICONS[payment.payment_method]} 
                size={20} 
                color={STATUS_COLORS[payment.status]} 
              />
            </View>
            
            <View style={styles.paymentInfo}>
              <Text style={[styles.paymentName, { color: theme.text }]}>{payment.member_name}</Text>
              <Text style={[styles.paymentRef, { color: theme.textSecondary }]}>
                {payment.reference} • {formatTime(payment.created_at)}
              </Text>
            </View>
            
            <View style={styles.paymentRight}>
              <Text style={[styles.paymentAmount, { color: theme.text }]}>
                +{formatCurrency(payment.amount)}
              </Text>
              <View style={[styles.paymentStatus, { backgroundColor: STATUS_COLORS[payment.status] + '20' }]}>
                <Text style={[styles.paymentStatusText, { color: STATUS_COLORS[payment.status] }]}>
                  {payment.status}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderPaymentsList = () => (
    <FlatList
      data={RECENT_PAYMENTS}
      renderItem={({ item: payment }) => (
        <View style={[styles.paymentCard, { backgroundColor: theme.card }]}>
          <View style={[styles.paymentIcon, { backgroundColor: theme.surface }]}>
            <Ionicons 
              name={PAYMENT_METHOD_ICONS[payment.payment_method]} 
              size={20} 
              color={STATUS_COLORS[payment.status]} 
            />
          </View>
          
          <View style={styles.paymentInfo}>
            <Text style={[styles.paymentName, { color: theme.text }]}>{payment.member_name}</Text>
            <Text style={[styles.paymentRef, { color: theme.textSecondary }]}>
              {payment.reference}
            </Text>
            <Text style={[styles.paymentDate, { color: theme.textSecondary }]}>
              {formatDate(payment.created_at)} at {formatTime(payment.created_at)}
            </Text>
          </View>
          
          <View style={styles.paymentRight}>
            <Text style={[styles.paymentAmount, { color: theme.text }]}>
              +{formatCurrency(payment.amount)}
            </Text>
            <View style={[styles.paymentStatus, { backgroundColor: STATUS_COLORS[payment.status] + '20' }]}>
              <Text style={[styles.paymentStatusText, { color: STATUS_COLORS[payment.status] }]}>
                {payment.status}
              </Text>
            </View>
          </View>
        </View>
      )}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
    />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <DashboardWallpaperBackground>
        <View style={[styles.customHeader, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
          <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Finance</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Financial Reports</Text>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="download-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'overview' && { backgroundColor: theme.primary + '20' }]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'overview' ? theme.primary : theme.textSecondary }]}>
            Overview
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
          style={[styles.tab, activeTab === 'invoices' && { backgroundColor: theme.primary + '20' }]}
          onPress={() => setActiveTab('invoices')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'invoices' ? theme.primary : theme.textSecondary }]}>
            Invoices
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'payments' && renderPaymentsList()}
      {activeTab === 'invoices' && renderPaymentsList()} {/* Would be invoices list */}
      </DashboardWallpaperBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Custom Header
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  headerButton: {
    padding: 4,
  },
  
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
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
    flex: 1,
  },
  
  // Hero Card
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  heroLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  heroIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  
  // Section
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAction: {
    width: (SCREEN_WIDTH - 42) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 10,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  
  // Overdue Cards
  overdueCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  overdueInfo: {},
  overdueName: {
    fontSize: 14,
    fontWeight: '600',
  },
  overdueNumber: {
    fontSize: 11,
    marginTop: 2,
  },
  overdueDue: {
    fontSize: 11,
    marginTop: 2,
  },
  overdueRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  overdueAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  reminderButton: {
    padding: 6,
  },
  
  // Regional Finance
  regionFinanceCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  regionFinanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  regionFinanceInfo: {},
  regionName: {
    fontSize: 15,
    fontWeight: '600',
  },
  regionMembers: {
    fontSize: 12,
    marginTop: 2,
  },
  regionFinanceAmounts: {
    alignItems: 'flex-end',
  },
  regionCollected: {
    fontSize: 15,
    fontWeight: '700',
  },
  regionOutstanding: {
    fontSize: 11,
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  
  // Payment Card
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    gap: 12,
  },
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentRef: {
    fontSize: 11,
    marginTop: 2,
  },
  paymentDate: {
    fontSize: 10,
    marginTop: 2,
  },
  paymentRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  paymentStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  paymentStatusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
