/**
 * Hook for managing campaigns state and operations
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Campaign, 
  CampaignFormState, 
  CampaignType, 
  DiscountType,
  CAMPAIGN_TYPE_LABELS,
  INITIAL_FORM_STATE,
} from './types';

export function useCampaigns() {
  const { user, profile, profileLoading, loading: authLoading } = useAuth();
  
  // Guard against React StrictMode double-invoke in development
  const navigationAttempted = useRef(false);

  // Handle both organization_id (new RBAC) and preschool_id (legacy) fields
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;
  
  // Wait for auth and profile to finish loading before making routing decisions
  const isStillLoading = authLoading || profileLoading;

  // Campaigns state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formState, setFormState] = useState<CampaignFormState>(INITIAL_FORM_STATE);

  // CONSOLIDATED NAVIGATION EFFECT
  useEffect(() => {
    if (isStillLoading) return;
    if (navigationAttempted.current) return;
    
    if (!user) {
      navigationAttempted.current = true;
      try { 
        router.replace('/(auth)/sign-in'); 
      } catch (e) {
        try { router.replace('/sign-in'); } catch { /* Intentional: non-fatal */ }
      }
      return;
    }
    
    if (!orgId) {
      navigationAttempted.current = true;
      console.log('Campaigns: No school found, redirecting to onboarding');
      try { 
        router.replace('/screens/principal-onboarding'); 
      } catch (e) {
        console.debug('Redirect to onboarding failed', e);
      }
      return;
    }
  }, [isStillLoading, user, orgId, profile]);

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    if (!orgId) return;

    try {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns((data as Campaign[]) || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  // Load campaigns when org is available
  useEffect(() => {
    if (orgId) {
      loadCampaigns();
    }
  }, [orgId, loadCampaigns]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormState(INITIAL_FORM_STATE);
    setEditingCampaign(null);
  }, []);

  // Open create modal
  const openCreateModal = useCallback(() => {
    resetForm();
    setShowCreateModal(true);
  }, [resetForm]);

  // Close modal
  const closeModal = useCallback(() => {
    setShowCreateModal(false);
    resetForm();
  }, [resetForm]);

  // Open edit modal
  const openEditModal = useCallback((campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormState({
      name: campaign.name,
      type: campaign.campaign_type,
      description: campaign.description || '',
      discountType: campaign.discount_type,
      discountValue: campaign.discount_value?.toString() || '',
      promoCode: campaign.promo_code || '',
      maxRedemptions: campaign.max_redemptions?.toString() || '',
      active: campaign.active,
      featured: campaign.featured,
    });
    setShowCreateModal(true);
  }, []);

  // Update form field
  const updateFormField = useCallback(<K extends keyof CampaignFormState>(
    field: K, 
    value: CampaignFormState[K]
  ) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  }, []);

  // Save campaign
  const saveCampaign = useCallback(async () => {
    if (!formState.name || !orgId) {
      Alert.alert('Error', 'Please enter a campaign name');
      return;
    }

    setSaving(true);
    try {
      const campaignData = {
        organization_id: orgId,
        name: formState.name,
        campaign_type: formState.type,
        description: formState.description || null,
        discount_type: formState.discountType,
        discount_value: formState.discountValue ? parseFloat(formState.discountValue) : null,
        promo_code: formState.promoCode || null,
        max_redemptions: formState.maxRedemptions ? parseInt(formState.maxRedemptions) : null,
        active: formState.active,
        featured: formState.featured,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      };

      if (editingCampaign) {
        const { error } = await supabase
          .from('marketing_campaigns')
          .update(campaignData)
          .eq('id', editingCampaign.id);

        if (error) throw error;
        Alert.alert('Success', 'Campaign updated successfully');
      } else {
        const { error } = await supabase
          .from('marketing_campaigns')
          .insert(campaignData);

        if (error) throw error;
        Alert.alert('Success', 'Campaign created successfully');
      }

      closeModal();
      loadCampaigns();
    } catch (error: any) {
      console.error('Error saving campaign:', error);
      Alert.alert('Error', error.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  }, [formState, orgId, editingCampaign, closeModal, loadCampaigns]);

  // Delete campaign
  const deleteCampaign = useCallback((campaign: Campaign) => {
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
  }, [loadCampaigns]);

  // Share campaign
  const shareCampaign = useCallback(async (campaign: Campaign) => {
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
      if (Platform.OS !== 'web') {
        await Share.share({ message, title: campaign.name });
      } else if (navigator.share) {
        await navigator.share({ title: campaign.name, text: message });
      } else {
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
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing campaign:', error);
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
  }, [loadCampaigns]);

  // Toggle campaign status
  const toggleCampaignStatus = useCallback(async (campaign: Campaign) => {
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
  }, [loadCampaigns]);

  // Test conversion (for demo/testing purposes)
  const testConversion = useCallback((campaign: Campaign) => {
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
  }, [loadCampaigns]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCampaigns();
  }, [loadCampaigns]);

  return {
    // State
    campaigns,
    loading,
    refreshing,
    saving,
    showCreateModal,
    editingCampaign,
    formState,
    orgId,
    isStillLoading,
    
    // Computed
    activeCampaignsCount: campaigns.filter((c) => c.active).length,
    totalConversions: campaigns.reduce((sum, c) => sum + c.conversions_count, 0),
    
    // Actions
    openCreateModal,
    closeModal,
    openEditModal,
    updateFormField,
    saveCampaign,
    deleteCampaign,
    shareCampaign,
    toggleCampaignStatus,
    testConversion,
    onRefresh,
  };
}
