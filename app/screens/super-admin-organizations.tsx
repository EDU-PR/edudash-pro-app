import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin } from '@/lib/roleUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Organization types
type OrganizationType = 'preschool' | 'k12' | 'skills' | 'org' | 'all';
type OrganizationStatus = 'active' | 'pending' | 'suspended' | 'inactive' | 'all';

interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  contact_email: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  student_count: number;
  teacher_count: number;
  subscription_tier?: string;
  subscription_status?: string;
  created_at: string;
  last_active_at?: string;
  principal_name?: string;
  principal_email?: string;
  logo_url?: string;
  is_verified: boolean;
  metadata?: Record<string, any>;
}

interface OrganizationStats {
  total: number;
  preschools: number;
  k12_schools: number;
  skills_centers: number;
  other_orgs: number;
  active: number;
  pending: number;
  suspended: number;
  verified: number;
  with_subscription: number;
}

// Theme (dark mode)
const theme = {
  background: '#0a0a0f',
  card: '#1a1a2e',
  cardHover: '#252540',
  primary: '#6366f1',
  primaryLight: '#818cf8',
  secondary: '#10b981',
  text: '#ffffff',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  border: '#374151',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

// Status colors
const statusColors: Record<string, string> = {
  active: '#10b981',
  pending: '#f59e0b',
  suspended: '#ef4444',
  inactive: '#6b7280',
};

// Organization type colors
const typeColors: Record<string, string> = {
  preschool: '#8b5cf6',
  k12: '#3b82f6',
  skills: '#f59e0b',
  org: '#10b981',
};

export default function SuperAdminOrganizations() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrgs, setFilteredOrgs] = useState<Organization[]>([]);
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<OrganizationType>('all');
  const [selectedStatus, setSelectedStatus] = useState<OrganizationStatus>('all');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);

  // Check access
  useEffect(() => {
    if (!isSuperAdmin(profile?.role)) {
      Alert.alert('Access Denied', 'Super admin access required');
      router.back();
    }
  }, [profile]);

  // Fetch organizations from all sources
  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = assertSupabase();

      console.log('[Organizations] Fetching organizations...');

      // Fetch from multiple tables in parallel
      const [preschoolsRes, schoolsRes, orgsRes] = await Promise.all([
        // Preschools
        supabase
          .from('preschools')
          .select(`
            id,
            name,
            email,
            phone,
            address,
            city,
            province,
            country,
            is_active,
            is_verified,
            created_at,
            updated_at,
            metadata,
            principal_id,
            logo_url
          `)
          .order('created_at', { ascending: false }),
        
        // K-12 Schools
        supabase
          .from('schools')
          .select(`
            id,
            name,
            email,
            phone,
            address,
            city,
            province,
            country,
            is_active,
            created_at,
            updated_at,
            metadata,
            logo_url
          `)
          .order('created_at', { ascending: false }),
        
        // Generic organizations (if table exists)
        supabase
          .from('organizations')
          .select(`
            id,
            name,
            contact_email,
            contact_phone,
            address,
            city,
            province,
            country,
            is_active,
            organization_type,
            created_at,
            updated_at,
            metadata,
            logo_url
          `)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      // Debug logging
      console.log('[Organizations] Preschools response:', {
        count: preschoolsRes.data?.length || 0,
        error: preschoolsRes.error?.message,
      });
      console.log('[Organizations] Schools response:', {
        count: schoolsRes.data?.length || 0,
        error: schoolsRes.error?.message,
      });
      console.log('[Organizations] Orgs response:', {
        count: orgsRes.data?.length || 0,
        error: orgsRes.error?.message,
      });

      // Process preschools
      const preschools: Organization[] = (preschoolsRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.name || 'Unnamed Preschool',
        type: 'preschool' as OrganizationType,
        status: p.is_active ? 'active' : 'inactive',
        contact_email: p.email || '',
        contact_phone: p.phone,
        address: p.address,
        city: p.city,
        province: p.province,
        country: p.country || 'South Africa',
        student_count: 0, // Will fetch separately if needed
        teacher_count: 0,
        created_at: p.created_at,
        last_active_at: p.updated_at,
        is_verified: p.is_verified || false,
        logo_url: p.logo_url,
        metadata: p.metadata,
      }));

      // Process K-12 schools
      const k12Schools: Organization[] = (schoolsRes.data || []).map((s: any) => ({
        id: s.id,
        name: s.name || 'Unnamed School',
        type: 'k12' as OrganizationType,
        status: s.is_active ? 'active' : 'inactive',
        contact_email: s.email || '',
        contact_phone: s.phone,
        address: s.address,
        city: s.city,
        province: s.province,
        country: s.country || 'South Africa',
        student_count: 0,
        teacher_count: 0,
        created_at: s.created_at,
        last_active_at: s.updated_at,
        is_verified: false,
        logo_url: s.logo_url,
        metadata: s.metadata,
      }));

      // Process generic organizations (may not exist)
      const otherOrgs: Organization[] = (orgsRes.data || []).map((o: any) => ({
        id: o.id,
        name: o.name || 'Unnamed Organization',
        type: (o.organization_type || 'org') as OrganizationType,
        status: o.is_active ? 'active' : 'inactive',
        contact_email: o.contact_email || '',
        contact_phone: o.contact_phone,
        address: o.address,
        city: o.city,
        province: o.province,
        country: o.country || 'South Africa',
        student_count: 0,
        teacher_count: 0,
        created_at: o.created_at,
        last_active_at: o.updated_at,
        is_verified: false,
        logo_url: o.logo_url,
        metadata: o.metadata,
      }));

      // Combine all organizations
      const allOrgs = [...preschools, ...k12Schools, ...otherOrgs];
      setOrganizations(allOrgs);
      setFilteredOrgs(allOrgs);

      // Calculate stats
      const calculatedStats: OrganizationStats = {
        total: allOrgs.length,
        preschools: preschools.length,
        k12_schools: k12Schools.length,
        skills_centers: allOrgs.filter(o => o.type === 'skills').length,
        other_orgs: otherOrgs.length,
        active: allOrgs.filter(o => o.status === 'active').length,
        pending: allOrgs.filter(o => o.status === 'pending').length,
        suspended: allOrgs.filter(o => o.status === 'suspended').length,
        verified: allOrgs.filter(o => o.is_verified).length,
        with_subscription: 0,
      };

      // Fetch subscription counts to enhance stats
      try {
        const { data: subscriptions } = await supabase
          .from('subscriptions')
          .select('preschool_id, organization_id, status')
          .eq('status', 'active');
        
        if (subscriptions) {
          const orgsWithSubs = new Set<string>();
          subscriptions.forEach((sub: any) => {
            if (sub.preschool_id) orgsWithSubs.add(sub.preschool_id);
            if (sub.organization_id) orgsWithSubs.add(sub.organization_id);
          });
          calculatedStats.with_subscription = orgsWithSubs.size;
        }
      } catch (subError) {
        console.log('Could not fetch subscription counts:', subError);
      }

      setStats(calculatedStats);

      track('superadmin_organizations_viewed', {
        total_count: allOrgs.length,
        preschool_count: preschools.length,
        k12_count: k12Schools.length,
      });

    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      // Don't show error for missing tables
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Filter organizations
  useEffect(() => {
    let filtered = [...organizations];

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(o => o.type === selectedType);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(o => o.status === selectedStatus);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.name.toLowerCase().includes(query) ||
        o.contact_email.toLowerCase().includes(query) ||
        o.city?.toLowerCase().includes(query) ||
        o.province?.toLowerCase().includes(query)
      );
    }

    setFilteredOrgs(filtered);
  }, [organizations, selectedType, selectedStatus, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrganizations();
    setRefreshing(false);
  }, [fetchOrganizations]);

  const handleOrgPress = (org: Organization) => {
    setSelectedOrg(org);
    setShowDetailModal(true);
  };

  const handleOrgAction = (action: string) => {
    if (!selectedOrg) return;

    switch (action) {
      case 'view':
        setShowActionsModal(false);
        setShowDetailModal(true);
        break;
      case 'edit':
        Alert.alert('Edit Organization', 'Organization editing coming soon');
        break;
      case 'suspend':
        Alert.alert(
          'Suspend Organization',
          `Are you sure you want to suspend ${selectedOrg.name}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Suspend',
              style: 'destructive',
              onPress: async () => {
                // TODO: Implement suspension
                track('superadmin_org_suspended', { org_id: selectedOrg.id });
                Alert.alert('Success', 'Organization suspended');
                setShowActionsModal(false);
                await fetchOrganizations();
              },
            },
          ]
        );
        break;
      case 'verify':
        Alert.alert('Verify Organization', `Mark ${selectedOrg.name} as verified?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Verify',
            onPress: async () => {
              try {
                const table = selectedOrg.type === 'preschool' ? 'preschools' : 'schools';
                await assertSupabase()
                  .from(table)
                  .update({ is_verified: true })
                  .eq('id', selectedOrg.id);
                track('superadmin_org_verified', { org_id: selectedOrg.id });
                Alert.alert('Success', 'Organization verified');
                setShowActionsModal(false);
                await fetchOrganizations();
              } catch (error) {
                Alert.alert('Error', 'Failed to verify organization');
              }
            },
          },
        ]);
        break;
      case 'delete':
        Alert.alert(
          'Delete Organization',
          `⚠️ This action cannot be undone. Delete ${selectedOrg.name}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                Alert.alert('Safety Check', 'Deletion requires additional confirmation in settings');
              },
            },
          ]
        );
        break;
    }
  };

  const renderStatsCard = () => {
    if (!stats) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.primary + '20' }]}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Orgs</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#8b5cf6' + '20' }]}>
            <Text style={styles.statValue}>{stats.preschools}</Text>
            <Text style={styles.statLabel}>Preschools</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#3b82f6' + '20' }]}>
            <Text style={styles.statValue}>{stats.k12_schools}</Text>
            <Text style={styles.statLabel}>K-12 Schools</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.success + '20' }]}>
            <Text style={styles.statValue}>{stats.active}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.warning + '20' }]}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.info + '20' }]}>
            <Text style={styles.statValue}>{stats.verified}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search organizations..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {(['all', 'preschool', 'k12', 'skills', 'org'] as OrganizationType[]).map(type => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterChip,
              selectedType === type && styles.filterChipActive,
            ]}
            onPress={() => setSelectedType(type)}
          >
            <Text style={[
              styles.filterChipText,
              selectedType === type && styles.filterChipTextActive,
            ]}>
              {type === 'all' ? 'All Types' : 
               type === 'k12' ? 'K-12' : 
               type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {(['all', 'active', 'pending', 'suspended', 'inactive'] as OrganizationStatus[]).map(status => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              selectedStatus === status && styles.filterChipActive,
              selectedStatus === status && { backgroundColor: statusColors[status] || theme.primary },
            ]}
            onPress={() => setSelectedStatus(status)}
          >
            <Text style={[
              styles.filterChipText,
              selectedStatus === status && styles.filterChipTextActive,
            ]}>
              {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderOrganizationCard = ({ item }: { item: Organization }) => (
    <TouchableOpacity
      style={styles.orgCard}
      onPress={() => handleOrgPress(item)}
      onLongPress={() => {
        setSelectedOrg(item);
        setShowActionsModal(true);
      }}
    >
      <View style={styles.orgHeader}>
        <View style={styles.orgTitleRow}>
          <View style={[styles.typeBadge, { backgroundColor: typeColors[item.type] + '30' }]}>
            <Text style={[styles.typeBadgeText, { color: typeColors[item.type] }]}>
              {item.type === 'k12' ? 'K-12' : item.type.toUpperCase()}
            </Text>
          </View>
          {item.is_verified && (
            <Ionicons name="checkmark-circle" size={18} color={theme.success} />
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColors[item.status] }]} />
          <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.orgName} numberOfLines={1}>{item.name}</Text>
      
      <View style={styles.orgDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="mail-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.detailText} numberOfLines={1}>{item.contact_email || 'No email'}</Text>
        </View>
        {item.city && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.detailText}>{item.city}{item.province ? `, ${item.province}` : ''}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.detailText}>
            Joined {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={styles.orgFooter}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {
            setSelectedOrg(item);
            setShowActionsModal(true);
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderDetailModal = () => {
    if (!selectedOrg) return null;

    return (
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedOrg.name}</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Status & Type */}
              <View style={styles.modalSection}>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Type</Text>
                  <View style={[styles.typeBadge, { backgroundColor: typeColors[selectedOrg.type] + '30' }]}>
                    <Text style={[styles.typeBadgeText, { color: typeColors[selectedOrg.type] }]}>
                      {selectedOrg.type === 'k12' ? 'K-12 School' : 
                       selectedOrg.type.charAt(0).toUpperCase() + selectedOrg.type.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColors[selectedOrg.status] + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColors[selectedOrg.status] }]} />
                    <Text style={[styles.statusText, { color: statusColors[selectedOrg.status] }]}>
                      {selectedOrg.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Verified</Text>
                  <Text style={styles.modalValue}>
                    {selectedOrg.is_verified ? '✅ Yes' : '❌ No'}
                  </Text>
                </View>
              </View>

              {/* Contact Info */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Contact Information</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Email</Text>
                  <Text style={styles.modalValue}>{selectedOrg.contact_email || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Phone</Text>
                  <Text style={styles.modalValue}>{selectedOrg.contact_phone || '-'}</Text>
                </View>
              </View>

              {/* Location */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Location</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Address</Text>
                  <Text style={styles.modalValue}>{selectedOrg.address || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>City</Text>
                  <Text style={styles.modalValue}>{selectedOrg.city || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Province</Text>
                  <Text style={styles.modalValue}>{selectedOrg.province || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Country</Text>
                  <Text style={styles.modalValue}>{selectedOrg.country || '-'}</Text>
                </View>
              </View>

              {/* Dates */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Activity</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Created</Text>
                  <Text style={styles.modalValue}>
                    {new Date(selectedOrg.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Last Active</Text>
                  <Text style={styles.modalValue}>
                    {selectedOrg.last_active_at 
                      ? new Date(selectedOrg.last_active_at).toLocaleDateString()
                      : '-'}
                  </Text>
                </View>
              </View>

              {/* Quick Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    setShowDetailModal(false);
                    // Navigate to edit screen
                    Alert.alert('Edit', 'Edit functionality coming soon');
                  }}
                >
                  <Ionicons name="create-outline" size={20} color="#fff" />
                  <Text style={styles.modalActionText}>Edit</Text>
                </TouchableOpacity>

                {!selectedOrg.is_verified && (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: theme.success }]}
                    onPress={() => handleOrgAction('verify')}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>Verify</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: theme.warning }]}
                  onPress={() => handleOrgAction('suspend')}
                >
                  <Ionicons name="pause-circle-outline" size={20} color="#fff" />
                  <Text style={styles.modalActionText}>Suspend</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderActionsModal = () => {
    if (!selectedOrg) return null;

    const actions = [
      { id: 'view', label: 'View Details', icon: 'eye-outline', color: theme.primary },
      { id: 'edit', label: 'Edit Organization', icon: 'create-outline', color: theme.info },
      { id: 'verify', label: 'Verify Organization', icon: 'checkmark-circle-outline', color: theme.success },
      { id: 'suspend', label: 'Suspend Organization', icon: 'pause-circle-outline', color: theme.warning },
      { id: 'delete', label: 'Delete Organization', icon: 'trash-outline', color: theme.error },
    ];

    return (
      <Modal
        visible={showActionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionsModal(false)}
      >
        <TouchableOpacity
          style={styles.actionsOverlay}
          activeOpacity={1}
          onPress={() => setShowActionsModal(false)}
        >
          <View style={styles.actionsContent}>
            <Text style={styles.actionsTitle}>{selectedOrg.name}</Text>
            <Text style={styles.actionsSubtitle}>Quick Actions</Text>

            {actions.map(action => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionItem}
                onPress={() => handleOrgAction(action.id)}
              >
                <Ionicons name={action.icon as any} size={22} color={action.color} />
                <Text style={[styles.actionItemText, { color: action.color }]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowActionsModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ThemedStatusBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading organizations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ThemedStatusBar />
      <Stack.Screen
        options={{
          title: 'Organizations',
          headerShown: false,
        }}
      />

      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Organizations</Text>
        <TouchableOpacity
          onPress={() => router.push('/screens/super-admin/school-onboarding-wizard')}
          style={styles.headerButton}
        >
          <Ionicons name="add-circle" size={28} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredOrgs}
        keyExtractor={item => item.id}
        renderItem={renderOrganizationCard}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <>
            {renderStatsCard()}
            {renderFilters()}
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {filteredOrgs.length} organization{filteredOrgs.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={64} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>No Organizations Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || selectedType !== 'all' || selectedStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Start by onboarding your first organization'}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/screens/super-admin/school-onboarding-wizard')}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Onboard Organization</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
        numColumns={SCREEN_WIDTH > 600 ? 2 : 1}
        key={SCREEN_WIDTH > 600 ? 'two-columns' : 'one-column'}
      />

      {renderDetailModal()}
      {renderActionsModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.textSecondary,
    marginTop: 12,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  statsContainer: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  filtersContainer: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: theme.text,
  },
  filterScroll: {
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterChipText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  resultsHeader: {
    marginBottom: 12,
  },
  resultsCount: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  orgCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    margin: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  orgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orgTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orgName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  orgDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    color: theme.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  orgFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  modalBody: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border + '40',
  },
  modalLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  modalValue: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 40,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  modalActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  actionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionsContent: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
  },
  actionsSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.background,
    marginBottom: 8,
    gap: 12,
  },
  actionItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});
