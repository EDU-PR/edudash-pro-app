/**
 * Campaigns Screen (React Native)
 * 
 * Marketing campaigns management for principals.
 * Allows creating, editing, and tracking promotional campaigns.
 * Feature-flagged: Only active when campaigns_enabled is true.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
type CampaignType = 'early_bird' | 'sibling_discount' | 'referral_bonus' | 'seasonal_promo' | 'bundle_offer' | 'scholarship';
type DiscountType = 'percentage' | 'fixed_amount' | 'waive_registration' | 'first_month_free';

interface Campaign {
  id: string;
  organization_id: string;
  name: string;
  campaign_type: CampaignType;
  description?: string;
  terms_conditions?: string;
  discount_type: DiscountType;
  discount_value?: number;
  max_discount_amount?: number;
  promo_code?: string;
  max_redemptions?: number;
  current_redemptions: number;
  start_date: string;
  end_date: string;
  active: boolean;
  featured: boolean;
  views_count: number;
  conversions_count: number;
  created_at: string;
}

// Campaign type labels
const CAMPAIGN_TYPE_LABELS: Record<CampaignType, { label: string; icon: string; color: string }> = {
  early_bird: { label: 'Early Bird', icon: 'sunny', color: '#f59e0b' },
  sibling_discount: { label: 'Sibling Discount', icon: 'people', color: '#8b5cf6' },
  referral_bonus: { label: 'Referral Bonus', icon: 'share-social', color: '#22c55e' },
  seasonal_promo: { label: 'Seasonal Promo', icon: 'calendar', color: '#3b82f6' },
  bundle_offer: { label: 'Bundle Offer', icon: 'gift', color: '#ec4899' },
  scholarship: { label: 'Scholarship', icon: 'school', color: '#14b8a6' },
};

// Discount type labels
const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Percentage Off',
  fixed_amount: 'Fixed Amount Off',
  waive_registration: 'Waive Registration',
  first_month_free: 'First Month Free',
};

export default function CampaignsScreen() {
  const { theme, isDark } = useTheme();
  const flags = getFeatureFlagsSync();

  // State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<CampaignType>('early_bird');
  const [formDescription, setFormDescription] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<DiscountType>('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState('');
  const [formPromoCode, setFormPromoCode] = useState('');
  const [formMaxRedemptions, setFormMaxRedemptions] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formFeatured, setFormFeatured] = useState(false);

  // Load user's organization
  useEffect(() => {
    const loadOrganization = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('preschool_id')
          .eq('id', user.id)
          .single();

        if (profile?.preschool_id) {
          setOrganizationId(profile.preschool_id);
        }
      } catch (error) {
        console.error('Error loading organization:', error);
      }
    };

    loadOrganization();
  }, []);

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns((data as Campaign[]) || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      loadCampaigns();
    }
  }, [organizationId, loadCampaigns]);

  // Reset form
  const resetForm = () => {
    setFormName('');
    setFormType('early_bird');
    setFormDescription('');
    setFormDiscountType('percentage');
    setFormDiscountValue('');
    setFormPromoCode('');
    setFormMaxRedemptions('');
    setFormActive(true);
    setFormFeatured(false);
    setEditingCampaign(null);
  };

  // Open edit modal
  const openEditModal = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormName(campaign.name);
    setFormType(campaign.campaign_type);
    setFormDescription(campaign.description || '');
    setFormDiscountType(campaign.discount_type);
    setFormDiscountValue(campaign.discount_value?.toString() || '');
    setFormPromoCode(campaign.promo_code || '');
    setFormMaxRedemptions(campaign.max_redemptions?.toString() || '');
    setFormActive(campaign.active);
    setFormFeatured(campaign.featured);
    setShowCreateModal(true);
  };

  // Save campaign
  const saveCampaign = async () => {
    if (!formName || !organizationId) {
      Alert.alert('Error', 'Please enter a campaign name');
      return;
    }

    setSaving(true);
    try {
      const campaignData = {
        organization_id: organizationId,
        name: formName,
        campaign_type: formType,
        description: formDescription || null,
        discount_type: formDiscountType,
        discount_value: formDiscountValue ? parseFloat(formDiscountValue) : null,
        promo_code: formPromoCode || null,
        max_redemptions: formMaxRedemptions ? parseInt(formMaxRedemptions) : null,
        active: formActive,
        featured: formFeatured,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days from now
      };

      if (editingCampaign) {
        // Update existing campaign
        const { error } = await supabase
          .from('marketing_campaigns')
          .update(campaignData)
          .eq('id', editingCampaign.id);

        if (error) throw error;
        Alert.alert('Success', 'Campaign updated successfully');
      } else {
        // Create new campaign
        const { error } = await supabase
          .from('marketing_campaigns')
          .insert(campaignData);

        if (error) throw error;
        Alert.alert('Success', 'Campaign created successfully');
      }

      setShowCreateModal(false);
      resetForm();
      loadCampaigns();
    } catch (error: any) {
      console.error('Error saving campaign:', error);
      Alert.alert('Error', error.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  // Delete campaign
  const deleteCampaign = (campaign: Campaign) => {
    Alert.alert(
      'Delete Campaign',
      `Are you sure you want to delete "${campaign.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('marketing_campaigns')
                .delete()
                .eq('id', campaign.id);

              if (error) throw error;
              loadCampaigns();
            } catch (error) {
              console.error('Error deleting campaign:', error);
              Alert.alert('Error', 'Failed to delete campaign');
            }
          },
        },
      ]
    );
  };

  // Share campaign
  const shareCampaign = async (campaign: Campaign) => {
    const typeInfo = CAMPAIGN_TYPE_LABELS[campaign.campaign_type];
    let discountText = '';
    
    if (campaign.discount_type === 'percentage') {
      discountText = `${campaign.discount_value}% off`;
    } else if (campaign.discount_type === 'fixed_amount') {
      discountText = `R${campaign.discount_value} off`;
    } else if (campaign.discount_type === 'waive_registration') {
      discountText = 'Registration fee waived';
    } else if (campaign.discount_type === 'first_month_free') {
      discountText = 'First month free';
    }

    const promoText = campaign.promo_code ? `\n\n🎁 Use code: ${campaign.promo_code}` : '';
    const endDate = new Date(campaign.end_date).toLocaleDateString('en-ZA', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    const message = `🎉 ${campaign.name}\n\n` +
      `✨ ${typeInfo.label} Special\n` +
      `💰 ${discountText}${promoText}\n\n` +
      `📅 Valid until ${endDate}\n\n` +
      `${campaign.description || 'Limited time offer! Don\'t miss out!'}\n\n` +
      `📱 Enroll now via EduDash Pro!`;

    try {
      // Try native share first (mobile)
      if (Platform.OS !== 'web') {
        await Share.share({
          message,
          title: campaign.name,
        });
      } else if (navigator.share) {
        // Use Web Share API if available
        await navigator.share({
          title: campaign.name,
          text: message,
        });
      } else {
        // Fallback to clipboard copy
        await Clipboard.setStringAsync(message);
        Alert.alert(
          'Copied to Clipboard! 📋',
          'Campaign details copied. You can now paste and share via WhatsApp, email, or any other app.',
          [{ text: 'OK' }]
        );
      }
      
      // Increment views count when shared
      await supabase
        .from('marketing_campaigns')
        .update({ views_count: (campaign.views_count || 0) + 1 })
        .eq('id', campaign.id);
      
      loadCampaigns();
    } catch (error) {
      // If share was cancelled, that's ok
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing campaign:', error);
        // Fallback to clipboard on any error
        try {
          await Clipboard.setStringAsync(message);
          Alert.alert(
            'Copied to Clipboard! 📋',
            'Campaign details copied. Share via WhatsApp, email, or any app.',
            [{ text: 'OK' }]
          );
        } catch (clipError) {
          console.error('Clipboard error:', clipError);
        }
      }
    }
  };

  // Toggle campaign status
  const toggleCampaignStatus = async (campaign: Campaign) => {
    try {
      const { error } = await supabase
        .from('marketing_campaigns')
        .update({ active: !campaign.active })
        .eq('id', campaign.id);

      if (error) throw error;
      loadCampaigns();
    } catch (error) {
      console.error('Error toggling campaign:', error);
    }
  };

  // Test conversion (for demo/testing purposes)
  const testConversion = async (campaign: Campaign) => {
    Alert.alert(
      'Test Conversion',
      `Simulate a conversion for "${campaign.name}"? This will increment the conversions count.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Conversion',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('marketing_campaigns')
                .update({ 
                  conversions_count: (campaign.conversions_count || 0) + 1,
                  current_redemptions: (campaign.current_redemptions || 0) + 1
                })
                .eq('id', campaign.id);

              if (error) throw error;
              
              Alert.alert('Success! 🎉', 'Conversion recorded successfully.');
              loadCampaigns();
            } catch (error) {
              console.error('Error recording conversion:', error);
              Alert.alert('Error', 'Failed to record conversion');
            }
          },
        },
      ]
    );
  };

  // Render campaign card
  const renderCampaignCard = ({ item }: { item: Campaign }) => {
    const typeInfo = CAMPAIGN_TYPE_LABELS[item.campaign_type];
    const isExpired = new Date(item.end_date) < new Date();

    return (
      <TouchableOpacity
        style={[styles.campaignCard, { backgroundColor: theme.surface }]}
        onPress={() => openEditModal(item)}
        activeOpacity={0.8}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.typeIcon, { backgroundColor: typeInfo.color + '20' }]}>
            <Ionicons name={typeInfo.icon as any} size={20} color={typeInfo.color} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.campaignName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.campaignType, { color: typeInfo.color }]}>
              {typeInfo.label}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            {isExpired ? (
              <View style={[styles.badge, { backgroundColor: '#ef4444' }]}>
                <Text style={[styles.badgeText, { color: '#ffffff' }]}>Expired</Text>
              </View>
            ) : item.active ? (
              <View style={[styles.badge, { backgroundColor: '#22c55e' }]}>
                <Text style={[styles.badgeText, { color: '#ffffff' }]}>Active</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: isDark ? '#4b5563' : theme.muted }]}>
                <Text style={[styles.badgeText, { color: '#ffffff' }]}>Paused</Text>
              </View>
            )}
          </View>
        </View>

        {/* Discount Info */}
        <View style={styles.discountInfo}>
          <Ionicons name="pricetag" size={16} color={theme.primary} />
          <Text style={[styles.discountText, { color: theme.text }]}>
            {item.discount_type === 'percentage' && `${item.discount_value}% off`}
            {item.discount_type === 'fixed_amount' && `R${item.discount_value} off`}
            {item.discount_type === 'waive_registration' && 'Registration waived'}
            {item.discount_type === 'first_month_free' && 'First month free'}
          </Text>
          {item.promo_code && (
            <View style={[styles.promoCodeBadge, { backgroundColor: theme.primary + '20' }]}>
              <Text style={[styles.promoCodeText, { color: theme.primary }]}>
                {item.promo_code}
              </Text>
            </View>
          )}
        </View>

        {/* Stats - tap conversions to test */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="eye-outline" size={14} color={theme.muted} />
            <Text style={[styles.statText, { color: theme.muted }]}>
              {item.views_count} views
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="checkmark-circle-outline" size={14} color={item.current_redemptions > 0 ? '#22c55e' : theme.muted} />
            <Text style={[styles.statText, { color: item.current_redemptions > 0 ? '#22c55e' : theme.muted }]}>
              {item.current_redemptions}
              {item.max_redemptions ? `/${item.max_redemptions}` : ''} used
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.stat} 
            onPress={() => testConversion(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trending-up-outline" size={14} color={item.conversions_count > 0 ? '#3b82f6' : theme.muted} />
            <Text style={[styles.statText, { color: item.conversions_count > 0 ? '#3b82f6' : theme.muted }]}>
              {item.conversions_count} conversions
            </Text>
            <Ionicons name="add-circle-outline" size={12} color={theme.muted} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: theme.border }]}
            onPress={() => toggleCampaignStatus(item)}
          >
            <Ionicons
              name={item.active ? 'pause' : 'play'}
              size={16}
              color={item.active ? '#f59e0b' : '#22c55e'}
            />
            <Text style={[styles.actionButtonText, { color: item.active ? '#f59e0b' : '#22c55e' }]}>
              {item.active ? 'Pause' : 'Activate'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={() => shareCampaign(item)}
          >
            <Ionicons name="share-social" size={16} color="#3b82f6" />
            <Text style={[styles.actionButtonText, { color: '#3b82f6' }]}>
              Share
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: '#ef4444' }]}
            onPress={() => deleteCampaign(item)}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="megaphone-outline" size={64} color={theme.muted} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No Campaigns Yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
        Create your first marketing campaign to attract more enrollments
      </Text>
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: theme.primary }]}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={20} color="#ffffff" />
        <Text style={styles.createButtonText}>Create Campaign</Text>
      </TouchableOpacity>
    </View>
  );

  // Feature flag check - campaigns not enabled
  if (!flags.campaigns_enabled) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Campaigns',
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
            headerTitleStyle: { color: theme.text },
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.headerButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.disabledContainer}>
          <Ionicons name="megaphone-outline" size={64} color={theme.muted} />
          <Text style={[styles.disabledText, { color: theme.text }]}>
            Campaigns feature is not available
          </Text>
          <Text style={[styles.disabledSubtext, { color: theme.muted }]}>
            Please upgrade your subscription to access marketing campaigns.
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Marketing Campaigns',
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { color: theme.text },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              style={styles.headerButton}
            >
              <Ionicons name="add-circle" size={28} color={theme.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Header Stats */}
      <LinearGradient
        colors={isDark ? ['#1e293b', '#0f172a'] : ['#f8fafc', '#f1f5f9']}
        style={styles.header}
      >
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatValue, { color: '#6366f1' }]}>
              {campaigns.length}
            </Text>
            <Text style={[styles.headerStatLabel, { color: theme.text }]}>
              Total
            </Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatValue, { color: '#22c55e' }]}>
              {campaigns.filter((c) => c.active).length}
            </Text>
            <Text style={[styles.headerStatLabel, { color: theme.text }]}>
              Active
            </Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatValue, { color: '#f59e0b' }]}>
              {campaigns.reduce((sum, c) => sum + c.conversions_count, 0)}
            </Text>
            <Text style={[styles.headerStatLabel, { color: theme.text }]}>
              Conversions
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Campaign List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id}
          renderItem={renderCampaignCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadCampaigns();
              }}
              colors={[theme.primary]}
            />
          }
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.surface }]}>
            <TouchableOpacity
              onPress={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {editingCampaign ? 'Edit Campaign' : 'New Campaign'}
            </Text>
            <TouchableOpacity onPress={saveCampaign} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.saveButton, { color: theme.primary }]}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Campaign Name */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Campaign Name *
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
                ]}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g., Early Bird Special 2025"
                placeholderTextColor={theme.muted}
              />
            </View>

            {/* Campaign Type */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Campaign Type
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.typeScroll}
              >
                {(Object.entries(CAMPAIGN_TYPE_LABELS) as [CampaignType, { label: string; icon: string; color: string }][]).map(
                  ([type, info]) => {
                    const isSelected = formType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeChip,
                          {
                            backgroundColor: isSelected ? info.color : theme.surface,
                            borderColor: isSelected ? info.color : theme.border,
                          },
                        ]}
                        onPress={() => setFormType(type)}
                      >
                        <Ionicons
                          name={info.icon as any}
                          size={16}
                          color={isSelected ? '#ffffff' : info.color}
                        />
                        <Text
                          style={[
                            styles.typeChipText,
                            { color: isSelected ? '#ffffff' : theme.text },
                          ]}
                        >
                          {info.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </ScrollView>
            </View>

            {/* Discount Type */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Discount Type
              </Text>
              <View style={styles.discountTypeGrid}>
                {(Object.entries(DISCOUNT_TYPE_LABELS) as [DiscountType, string][]).map(
                  ([type, label]) => {
                    const isSelected = formDiscountType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.discountTypeOption,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.surface,
                            borderColor: isSelected ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => setFormDiscountType(type)}
                      >
                        <Text
                          style={[
                            styles.discountTypeText,
                            { color: isSelected ? '#ffffff' : theme.text },
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            </View>

            {/* Discount Value */}
            {(formDiscountType === 'percentage' || formDiscountType === 'fixed_amount') && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Discount Value {formDiscountType === 'percentage' ? '(%)' : '(R)'}
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
                  ]}
                  value={formDiscountValue}
                  onChangeText={setFormDiscountValue}
                  placeholder={formDiscountType === 'percentage' ? 'e.g., 20' : 'e.g., 500'}
                  placeholderTextColor={theme.muted}
                  keyboardType="numeric"
                />
              </View>
            )}

            {/* Promo Code */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Promo Code (Optional)
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
                ]}
                value={formPromoCode}
                onChangeText={(text) => setFormPromoCode(text.toUpperCase())}
                placeholder="e.g., EARLYBIRD25"
                placeholderTextColor={theme.muted}
                autoCapitalize="characters"
              />
            </View>

            {/* Max Redemptions */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Max Redemptions (Optional)
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
                ]}
                value={formMaxRedemptions}
                onChangeText={setFormMaxRedemptions}
                placeholder="Leave empty for unlimited"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Description (Optional)
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  styles.formTextarea,
                  { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
                ]}
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Describe your campaign..."
                placeholderTextColor={theme.muted}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Toggles */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleItem}>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>Active</Text>
                <Switch
                  value={formActive}
                  onValueChange={setFormActive}
                  trackColor={{ false: theme.border, true: theme.primary }}
                />
              </View>
              <View style={styles.toggleItem}>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>Featured</Text>
                <Switch
                  value={formFeatured}
                  onValueChange={setFormFeatured}
                  trackColor={{ false: theme.border, true: '#f59e0b' }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  disabledContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  disabledText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  disabledSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  headerButton: {
    marginRight: 8,
  },
  header: {
    padding: 16,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  headerStat: {
    alignItems: 'center',
    minWidth: 70,
  },
  headerStatValue: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerStatLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(128,128,128,0.3)',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  campaignCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  campaignName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  campaignType: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  statusBadge: {
    marginLeft: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  discountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  discountText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  promoCodeBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  promoCodeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
    flexWrap: 'wrap',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  shareButton: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  formTextarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeScroll: {
    paddingVertical: 4,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  discountTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  discountTypeOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  discountTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});
