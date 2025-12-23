/**
 * Member Detail Screen
 * Comprehensive profile view with actions and history
 */
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { 
  OrganizationMember, 
  MEMBER_TYPE_LABELS, 
  STATUS_COLORS,
  MEMBERSHIP_TIER_LABELS 
} from '@/components/membership/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Mock member data - Extended type for demo purposes
interface ExtendedMember extends OrganizationMember {
  address_line1?: string;
  address_line2?: string;
  postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
}

const MOCK_MEMBER: ExtendedMember = {
  id: '1',
  organization_id: 'org1',
  region_id: 'reg1',
  member_number: 'SOA-GP-24-00001',
  member_type: 'facilitator',
  first_name: 'Thabo',
  last_name: 'Mokoena',
  email: 'thabo.mokoena@email.com',
  phone: '+27 82 123 4567',
  date_of_birth: '1990-05-15',
  id_number: '9005155123089',
  physical_address: '123 Main Road, Sandton',
  city: 'Johannesburg',
  province: 'Gauteng',
  address_line1: '123 Main Road',
  address_line2: 'Sandton',
  postal_code: '2196',
  emergency_contact_name: 'Sarah Mokoena',
  emergency_contact_phone: '+27 83 987 6543',
  membership_tier: 'premium',
  membership_status: 'active',
  joined_date: '2024-01-15',
  expiry_date: '2025-12-31',
  photo_url: null,
  notes: 'Outstanding facilitator with excellent feedback from learners.',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  region: { id: 'reg1', organization_id: 'org1', name: 'Gauteng', code: 'GP', is_active: true, created_at: '' },
};

// Payment history
interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  type: string;
  status: 'paid' | 'pending' | 'failed';
  reference: string;
}

const PAYMENT_HISTORY: PaymentRecord[] = [
  { id: '1', date: '2024-12-01', amount: 1200, type: 'Annual Membership', status: 'paid', reference: 'PF-202412-001' },
  { id: '2', date: '2024-06-15', amount: 500, type: 'Workshop Fee', status: 'paid', reference: 'PF-202406-045' },
  { id: '3', date: '2024-01-15', amount: 1200, type: 'Annual Membership', status: 'paid', reference: 'PF-202401-089' },
  { id: '4', date: '2023-06-01', amount: 350, type: 'Training Materials', status: 'paid', reference: 'PF-202306-012' },
];

// Activity log
interface ActivityRecord {
  id: string;
  date: string;
  action: string;
  details: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const ACTIVITY_LOG: ActivityRecord[] = [
  { id: '1', date: '2024-12-20', action: 'Event Registration', details: 'Registered for National Leadership Summit 2025', icon: 'calendar-outline', color: '#3B82F6' },
  { id: '2', date: '2024-12-15', action: 'Resource Download', details: 'Downloaded Facilitator Onboarding Guide', icon: 'download-outline', color: '#10B981' },
  { id: '3', date: '2024-12-01', action: 'Payment Received', details: 'Annual membership fee - R1,200', icon: 'cash-outline', color: '#F59E0B' },
  { id: '4', date: '2024-11-28', action: 'ID Card Generated', details: 'Premium facilitator ID card issued', icon: 'card-outline', color: '#8B5CF6' },
  { id: '5', date: '2024-11-15', action: 'Profile Updated', details: 'Contact information updated', icon: 'create-outline', color: '#06B6D4' },
];

export default function MemberDetailScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'payments' | 'activity'>('profile');
  
  // Would fetch member by params.id in real app
  const member = MOCK_MEMBER;
  const initials = `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
  const statusColor = STATUS_COLORS[member.membership_status];

  const handleAction = (action: string) => {
    Alert.alert(action, `Perform ${action.toLowerCase()} action for ${member.first_name}?`);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount: number): string => {
    return `R ${amount.toLocaleString('en-ZA')}`;
  };

  const renderProfileTab = () => (
    <View>
      {/* Contact Info */}
      <View style={[styles.infoSection, { backgroundColor: theme.card }]}>
        <Text style={[styles.infoSectionTitle, { color: theme.text }]}>Contact Information</Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Email</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{member.email}</Text>
          </View>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={20} color={theme.textSecondary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Phone</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{member.phone}</Text>
          </View>
        </View>
        
        {member.address_line1 && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Address</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {member.address_line1}
                {member.address_line2 && `\n${member.address_line2}`}
                {'\n'}{member.city}, {member.province} {member.postal_code}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Personal Info */}
      <View style={[styles.infoSection, { backgroundColor: theme.card }]}>
        <Text style={[styles.infoSectionTitle, { color: theme.text }]}>Personal Details</Text>
        
        {member.date_of_birth && (
          <View style={styles.infoRow}>
            <Ionicons name="gift-outline" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Date of Birth</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{formatDate(member.date_of_birth)}</Text>
            </View>
          </View>
        )}
        
        {member.id_number && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>ID Number</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {member.id_number.replace(/(\d{6})(\d{4})(\d{3})/, '$1 $2 $3')}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Emergency Contact */}
      {member.emergency_contact_name && (
        <View style={[styles.infoSection, { backgroundColor: theme.card }]}>
          <Text style={[styles.infoSectionTitle, { color: theme.text }]}>Emergency Contact</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Name</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{member.emergency_contact_name}</Text>
            </View>
          </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Phone</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{member.emergency_contact_phone}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Notes */}
      {member.notes && (
        <View style={[styles.infoSection, { backgroundColor: theme.card }]}>
          <Text style={[styles.infoSectionTitle, { color: theme.text }]}>Notes</Text>
          <Text style={[styles.notesText, { color: theme.textSecondary }]}>{member.notes}</Text>
        </View>
      )}
    </View>
  );

  const renderPaymentsTab = () => (
    <View>
      {/* Summary */}
      <View style={[styles.paymentSummary, { backgroundColor: theme.card }]}>
        <View style={styles.paymentSummaryItem}>
          <Text style={[styles.paymentSummaryValue, { color: '#10B981' }]}>
            {formatCurrency(PAYMENT_HISTORY.reduce((sum, p) => sum + (p.status === 'paid' ? p.amount : 0), 0))}
          </Text>
          <Text style={[styles.paymentSummaryLabel, { color: theme.textSecondary }]}>Total Paid</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.paymentSummaryItem}>
          <Text style={[styles.paymentSummaryValue, { color: theme.text }]}>
            {PAYMENT_HISTORY.filter(p => p.status === 'paid').length}
          </Text>
          <Text style={[styles.paymentSummaryLabel, { color: theme.textSecondary }]}>Payments</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.paymentSummaryItem}>
          <Text style={[styles.paymentSummaryValue, { color: theme.text }]}>R0</Text>
          <Text style={[styles.paymentSummaryLabel, { color: theme.textSecondary }]}>Outstanding</Text>
        </View>
      </View>

      {/* Payment History */}
      {PAYMENT_HISTORY.map((payment) => (
        <View key={payment.id} style={[styles.paymentCard, { backgroundColor: theme.card }]}>
          <View style={[styles.paymentIcon, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          </View>
          <View style={styles.paymentInfo}>
            <Text style={[styles.paymentType, { color: theme.text }]}>{payment.type}</Text>
            <Text style={[styles.paymentRef, { color: theme.textSecondary }]}>
              {payment.reference} • {formatDate(payment.date)}
            </Text>
          </View>
          <Text style={[styles.paymentAmount, { color: '#10B981' }]}>
            {formatCurrency(payment.amount)}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderActivityTab = () => (
    <View>
      {ACTIVITY_LOG.map((activity, index) => (
        <View key={activity.id} style={styles.activityItem}>
          {/* Timeline connector */}
          {index < ACTIVITY_LOG.length - 1 && (
            <View style={[styles.timelineConnector, { backgroundColor: theme.border }]} />
          )}
          
          <View style={[styles.activityIcon, { backgroundColor: activity.color + '20' }]}>
            <Ionicons name={activity.icon} size={16} color={activity.color} />
          </View>
          
          <View style={[styles.activityContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.activityAction, { color: theme.text }]}>{activity.action}</Text>
            <Text style={[styles.activityDetails, { color: theme.textSecondary }]}>{activity.details}</Text>
            <Text style={[styles.activityDate, { color: theme.textSecondary }]}>{formatDate(activity.date)}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
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

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <LinearGradient
          colors={[theme.primary, theme.primary + 'CC']}
          style={styles.profileHeader}
        >
          <View style={styles.avatarContainer}>
            {member.photo_url ? (
              <Image source={{ uri: member.photo_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
          </View>
          
          <Text style={styles.profileName}>{member.first_name} {member.last_name}</Text>
          <Text style={styles.profileNumber}>{member.member_number}</Text>
          
          <View style={styles.profileBadges}>
            <View style={styles.profileBadge}>
              <Ionicons name="ribbon-outline" size={14} color="#fff" />
              <Text style={styles.profileBadgeText}>{MEMBER_TYPE_LABELS[member.member_type]}</Text>
            </View>
            <View style={styles.profileBadge}>
              <Ionicons name="star-outline" size={14} color="#fff" />
              <Text style={styles.profileBadgeText}>{MEMBERSHIP_TIER_LABELS[member.membership_tier]}</Text>
            </View>
            <View style={styles.profileBadge}>
              <Ionicons name="location-outline" size={14} color="#fff" />
              <Text style={styles.profileBadgeText}>{member.region?.name}</Text>
            </View>
          </View>
          
          <View style={styles.membershipDates}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Joined</Text>
              <Text style={styles.dateValue}>{formatDate(member.joined_date)}</Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Expires</Text>
              <Text style={styles.dateValue}>{member.expiry_date ? formatDate(member.expiry_date) : 'N/A'}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.quickAction, { backgroundColor: theme.card }]}
            onPress={() => router.push(`/screens/membership/id-card?id=${member.id}`)}
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
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'payments' && renderPaymentsTab()}
          {activeTab === 'activity' && renderActivityTab()}
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
        
        <TouchableOpacity 
          style={[styles.bottomAction, { backgroundColor: theme.primary }]}
          onPress={() => handleAction('Renew Membership')}
        >
          <Ionicons name="refresh-outline" size={20} color="#fff" />
          <Text style={[styles.bottomActionText, { color: '#fff' }]}>Renew Membership</Text>
        </TouchableOpacity>
      </View>
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
  
  // Profile Header
  profileHeader: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  profileNumber: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  profileBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  profileBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  membershipDates: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  dateItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dateLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  dateDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  
  // Quick Actions
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
  
  // Tab Bar
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
  
  // Info Section
  infoSection: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  infoSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  
  // Payment Summary
  paymentSummary: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  paymentSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  paymentSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  paymentSummaryLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  
  // Payment Card
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentType: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentRef: {
    fontSize: 11,
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Activity Timeline
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: 16,
    top: 36,
    bottom: -16,
    width: 2,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityDetails: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
  },
  activityDate: {
    fontSize: 11,
    marginTop: 6,
  },
  
  // Bottom Actions
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
});
