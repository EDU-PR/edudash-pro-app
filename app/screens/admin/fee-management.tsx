/**
 * Fee Management Screen
 * 
 * Allows principals and admins to:
 * - View all fee structures for their organization
 * - Add new fee types (registration, tuition, materials, etc.)
 * - Edit existing fee amounts
 * - Delete fee structures
 * - Manage promotional campaigns for registration
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Modal,
  RefreshControl,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';

interface FeeStructure {
  id: string;
  name: string;
  description?: string;
  amount: number;
  fee_type: 'registration' | 'tuition' | 'materials' | 'transport' | 'meals' | 'other';
  frequency: 'one_time' | 'monthly' | 'quarterly' | 'yearly';
  is_active: boolean;
}

interface PromoCampaign {
  id: string;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  applies_to_registration: boolean;
  is_active: boolean;
  start_date: string;
  end_date: string;
  max_uses?: number;
  current_uses: number;
}

const FEE_TYPES = [
  { value: 'registration', label: '📋 Registration', icon: 'document-text' },
  { value: 'tuition', label: '📚 Tuition', icon: 'school' },
  { value: 'materials', label: '🎨 Materials', icon: 'color-palette' },
  { value: 'transport', label: '🚌 Transport', icon: 'bus' },
  { value: 'meals', label: '🍽️ Meals', icon: 'restaurant' },
  { value: 'other', label: '📦 Other', icon: 'cube' },
];

const FREQUENCIES = [
  { value: 'one_time', label: 'One-time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function FeeManagementScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const organizationId = profile?.organization_id || profile?.preschool_id;

  // State
  const [fees, setFees] = useState<FeeStructure[]>([]);
  const [promos, setPromos] = useState<PromoCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Modal state
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null);
  const [editingPromo, setEditingPromo] = useState<PromoCampaign | null>(null);
  
  // Form state
  const [feeForm, setFeeForm] = useState({
    name: '',
    description: '',
    amount: '',
    fee_type: 'tuition' as FeeStructure['fee_type'],
    frequency: 'monthly' as FeeStructure['frequency'],
    is_active: true,
  });
  
  const [promoForm, setPromoForm] = useState({
    code: '',
    name: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    applies_to_registration: true,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    max_uses: '',
    is_active: true,
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const supabase = assertSupabase();
      
      // Fetch fee structures
      const { data: feesData, error: feesError } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('preschool_id', organizationId)
        .order('fee_type', { ascending: true });
      
      if (feesError) throw feesError;
      setFees(feesData || []);
      
      // Fetch promo campaigns (registration-related)
      const { data: promosData, error: promosError } = await supabase
        .from('promotional_campaigns')
        .select('*')
        .eq('applies_to_registration', true)
        .order('created_at', { ascending: false });
      
      if (promosError && promosError.code !== '42P01') {
        console.warn('Promos fetch error:', promosError);
      }
      setPromos(promosData || []);
      
    } catch (err: any) {
      console.error('Fetch error:', err);
      Alert.alert('Error', 'Failed to load fee data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Save fee structure
  const handleSaveFee = async () => {
    if (!feeForm.name.trim() || !feeForm.amount) {
      Alert.alert('Validation', 'Please fill in name and amount');
      return;
    }
    
    setSaving(true);
    try {
      const supabase = assertSupabase();
      const payload = {
        name: feeForm.name.trim(),
        description: feeForm.description.trim() || null,
        amount: parseFloat(feeForm.amount),
        fee_type: feeForm.fee_type,
        frequency: feeForm.frequency,
        is_active: feeForm.is_active,
        preschool_id: organizationId,
        created_by: profile?.id,
      };
      
      if (editingFee) {
        // Update
        const { error } = await supabase
          .from('fee_structures')
          .update(payload)
          .eq('id', editingFee.id);
        
        if (error) throw error;
        Alert.alert('Success', 'Fee updated successfully');
      } else {
        // Insert
        const { error } = await supabase
          .from('fee_structures')
          .insert(payload);
        
        if (error) throw error;
        Alert.alert('Success', 'Fee created successfully');
      }
      
      setShowFeeModal(false);
      resetFeeForm();
      fetchData();
    } catch (err: any) {
      console.error('Save fee error:', err);
      Alert.alert('Error', err.message || 'Failed to save fee');
    } finally {
      setSaving(false);
    }
  };

  // Delete fee structure
  const handleDeleteFee = (fee: FeeStructure) => {
    Alert.alert(
      'Delete Fee',
      `Are you sure you want to delete "${fee.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await assertSupabase()
                .from('fee_structures')
                .delete()
                .eq('id', fee.id);
              
              if (error) throw error;
              Alert.alert('Deleted', 'Fee structure removed');
              fetchData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  // Save promo campaign
  const handleSavePromo = async () => {
    if (!promoForm.code.trim() || !promoForm.name.trim() || !promoForm.discount_value) {
      Alert.alert('Validation', 'Please fill in code, name, and discount value');
      return;
    }
    
    setSaving(true);
    try {
      const supabase = assertSupabase();
      const payload = {
        code: promoForm.code.trim().toUpperCase(),
        name: promoForm.name.trim(),
        discount_type: promoForm.discount_type,
        discount_value: parseFloat(promoForm.discount_value),
        applies_to_registration: promoForm.applies_to_registration,
        start_date: promoForm.start_date,
        end_date: promoForm.end_date,
        max_uses: promoForm.max_uses ? parseInt(promoForm.max_uses) : null,
        is_active: promoForm.is_active,
        user_type: 'parent',
        promo_duration_months: 12,
        product_type: 'registration',
      };
      
      if (editingPromo) {
        const { error } = await supabase
          .from('promotional_campaigns')
          .update(payload)
          .eq('id', editingPromo.id);
        
        if (error) throw error;
        Alert.alert('Success', 'Promo updated successfully');
      } else {
        const { error } = await supabase
          .from('promotional_campaigns')
          .insert(payload);
        
        if (error) throw error;
        Alert.alert('Success', 'Promo created successfully');
      }
      
      setShowPromoModal(false);
      resetPromoForm();
      fetchData();
    } catch (err: any) {
      console.error('Save promo error:', err);
      Alert.alert('Error', err.message || 'Failed to save promo');
    } finally {
      setSaving(false);
    }
  };

  // Reset forms
  const resetFeeForm = () => {
    setEditingFee(null);
    setFeeForm({
      name: '',
      description: '',
      amount: '',
      fee_type: 'tuition',
      frequency: 'monthly',
      is_active: true,
    });
  };

  const resetPromoForm = () => {
    setEditingPromo(null);
    setPromoForm({
      code: '',
      name: '',
      discount_type: 'percentage',
      discount_value: '',
      applies_to_registration: true,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      max_uses: '',
      is_active: true,
    });
  };

  // Edit fee
  const openEditFee = (fee: FeeStructure) => {
    setEditingFee(fee);
    setFeeForm({
      name: fee.name,
      description: fee.description || '',
      amount: fee.amount.toString(),
      fee_type: fee.fee_type,
      frequency: fee.frequency,
      is_active: fee.is_active,
    });
    setShowFeeModal(true);
  };

  // Edit promo
  const openEditPromo = (promo: PromoCampaign) => {
    setEditingPromo(promo);
    setPromoForm({
      code: promo.code,
      name: promo.name,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value.toString(),
      applies_to_registration: promo.applies_to_registration,
      start_date: promo.start_date?.split('T')[0] || '',
      end_date: promo.end_date?.split('T')[0] || '',
      max_uses: promo.max_uses?.toString() || '',
      is_active: promo.is_active,
    });
    setShowPromoModal(true);
  };

  // Permission check
  const canManage = profile?.role === 'principal' || profile?.role === 'admin' || profile?.role === 'super_admin';

  if (!canManage) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Fee Management' }} />
        <View style={styles.centerContent}>
          <Ionicons name="lock-closed" size={64} color={theme.textSecondary} />
          <Text style={[styles.errorText, { color: theme.text }]}>Access Denied</Text>
          <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 8 }}>
            Only principals and admins can manage fees.
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Fee Management' }} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.textSecondary, marginTop: 16 }}>Loading fee data...</Text>
        </View>
      </View>
    );
  }

  const styles = createStyles(theme);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Fee Management', headerShown: false }} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Fee Management</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
      >
        {/* Fee Structures Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Fee Structures</Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={() => { resetFeeForm(); setShowFeeModal(true); }}
            >
              <Ionicons name="add" size={20} color={theme.onPrimary} />
              <Text style={[styles.addButtonText, { color: theme.onPrimary }]}>Add Fee</Text>
            </TouchableOpacity>
          </View>
          
          {fees.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
              <Ionicons name="receipt-outline" size={48} color={theme.textSecondary} />
              <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No fee structures yet</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Tap "Add Fee" to create one</Text>
            </View>
          ) : (
            fees.map((fee) => (
              <TouchableOpacity
                key={fee.id}
                style={[styles.feeCard, { backgroundColor: theme.surface }]}
                onPress={() => openEditFee(fee)}
              >
                <View style={styles.feeCardLeft}>
                  <View style={[styles.feeTypeIcon, { backgroundColor: theme.primary + '20' }]}>
                    <Ionicons 
                      name={FEE_TYPES.find(t => t.value === fee.fee_type)?.icon as any || 'cube'} 
                      size={20} 
                      color={theme.primary} 
                    />
                  </View>
                  <View style={styles.feeInfo}>
                    <Text style={[styles.feeName, { color: theme.text }]}>{fee.name}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                      {fee.frequency.replace('_', '-')} • {fee.is_active ? '✅ Active' : '❌ Inactive'}
                    </Text>
                  </View>
                </View>
                <View style={styles.feeCardRight}>
                  <Text style={[styles.feeAmount, { color: theme.primary }]}>R {fee.amount.toFixed(2)}</Text>
                  <TouchableOpacity onPress={() => handleDeleteFee(fee)}>
                    <Ionicons name="trash-outline" size={18} color={theme.error} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Promo Campaigns Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Promo Codes</Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.secondary || '#10b981' }]}
              onPress={() => { resetPromoForm(); setShowPromoModal(true); }}
            >
              <Ionicons name="pricetag" size={18} color="#fff" />
              <Text style={[styles.addButtonText, { color: '#fff' }]}>Add Promo</Text>
            </TouchableOpacity>
          </View>
          
          {promos.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
              <Ionicons name="pricetags-outline" size={48} color={theme.textSecondary} />
              <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No promo codes yet</Text>
            </View>
          ) : (
            promos.map((promo) => (
              <TouchableOpacity
                key={promo.id}
                style={[styles.promoCard, { backgroundColor: theme.surface, borderColor: promo.is_active ? '#10b981' : theme.border }]}
                onPress={() => openEditPromo(promo)}
              >
                <View style={styles.promoHeader}>
                  <Text style={[styles.promoCode, { color: theme.primary }]}>{promo.code}</Text>
                  <View style={[styles.promoBadge, { backgroundColor: promo.is_active ? '#10b98120' : theme.error + '20' }]}>
                    <Text style={{ color: promo.is_active ? '#10b981' : theme.error, fontSize: 10, fontWeight: '600' }}>
                      {promo.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: theme.text, marginTop: 4 }}>{promo.name}</Text>
                <View style={styles.promoStats}>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    {promo.discount_type === 'percentage' ? `${promo.discount_value}% off` : `R${promo.discount_value} off`}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    Used: {promo.current_uses}{promo.max_uses ? `/${promo.max_uses}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Fee Modal */}
      <Modal visible={showFeeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingFee ? 'Edit Fee' : 'Add New Fee'}
              </Text>
              <TouchableOpacity onPress={() => setShowFeeModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.label, { color: theme.text }]}>Fee Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                value={feeForm.name}
                onChangeText={(v) => setFeeForm({ ...feeForm, name: v })}
                placeholder="e.g. Monthly Tuition"
                placeholderTextColor={theme.textSecondary}
              />
              
              <Text style={[styles.label, { color: theme.text }]}>Amount (R) *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                value={feeForm.amount}
                onChangeText={(v) => setFeeForm({ ...feeForm, amount: v.replace(/[^0-9.]/g, '') })}
                placeholder="e.g. 680.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
              
              <Text style={[styles.label, { color: theme.text }]}>Fee Type *</Text>
              <View style={styles.buttonGroup}>
                {FEE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeButton,
                      { backgroundColor: feeForm.fee_type === type.value ? theme.primary : theme.surface, borderColor: theme.border }
                    ]}
                    onPress={() => setFeeForm({ ...feeForm, fee_type: type.value as any })}
                  >
                    <Text style={{ color: feeForm.fee_type === type.value ? theme.onPrimary : theme.text, fontSize: 12 }}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={[styles.label, { color: theme.text }]}>Frequency *</Text>
              <View style={styles.buttonGroup}>
                {FREQUENCIES.map((freq) => (
                  <TouchableOpacity
                    key={freq.value}
                    style={[
                      styles.typeButton,
                      { backgroundColor: feeForm.frequency === freq.value ? theme.primary : theme.surface, borderColor: theme.border }
                    ]}
                    onPress={() => setFeeForm({ ...feeForm, frequency: freq.value as any })}
                  >
                    <Text style={{ color: feeForm.frequency === freq.value ? theme.onPrimary : theme.text, fontSize: 12 }}>
                      {freq.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={[styles.label, { color: theme.text }]}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                value={feeForm.description}
                onChangeText={(v) => setFeeForm({ ...feeForm, description: v })}
                placeholder="Brief description of this fee"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
              />
              
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setFeeForm({ ...feeForm, is_active: !feeForm.is_active })}
              >
                <Ionicons 
                  name={feeForm.is_active ? 'checkbox' : 'square-outline'} 
                  size={24} 
                  color={feeForm.is_active ? theme.primary : theme.textSecondary} 
                />
                <Text style={{ color: theme.text, marginLeft: 8 }}>Active</Text>
              </TouchableOpacity>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.surface }]}
                onPress={() => setShowFeeModal(false)}
              >
                <Text style={{ color: theme.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleSaveFee}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={theme.onPrimary} size="small" />
                ) : (
                  <Text style={{ color: theme.onPrimary, fontWeight: '600' }}>
                    {editingFee ? 'Update' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Promo Modal */}
      <Modal visible={showPromoModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingPromo ? 'Edit Promo' : 'Add New Promo'}
              </Text>
              <TouchableOpacity onPress={() => setShowPromoModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.label, { color: theme.text }]}>Promo Code *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                value={promoForm.code}
                onChangeText={(v) => setPromoForm({ ...promoForm, code: v.toUpperCase() })}
                placeholder="e.g. WELCOME2026"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
              />
              
              <Text style={[styles.label, { color: theme.text }]}>Campaign Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                value={promoForm.name}
                onChangeText={(v) => setPromoForm({ ...promoForm, name: v })}
                placeholder="e.g. New Year Registration Special"
                placeholderTextColor={theme.textSecondary}
              />
              
              <Text style={[styles.label, { color: theme.text }]}>Discount Type *</Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[
                    styles.typeButton, { flex: 1 },
                    { backgroundColor: promoForm.discount_type === 'percentage' ? theme.primary : theme.surface, borderColor: theme.border }
                  ]}
                  onPress={() => setPromoForm({ ...promoForm, discount_type: 'percentage' })}
                >
                  <Text style={{ color: promoForm.discount_type === 'percentage' ? theme.onPrimary : theme.text }}>
                    % Percentage
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton, { flex: 1 },
                    { backgroundColor: promoForm.discount_type === 'fixed' ? theme.primary : theme.surface, borderColor: theme.border }
                  ]}
                  onPress={() => setPromoForm({ ...promoForm, discount_type: 'fixed' })}
                >
                  <Text style={{ color: promoForm.discount_type === 'fixed' ? theme.onPrimary : theme.text }}>
                    R Fixed Amount
                  </Text>
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.label, { color: theme.text }]}>
                Discount Value ({promoForm.discount_type === 'percentage' ? '%' : 'R'}) *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                value={promoForm.discount_value}
                onChangeText={(v) => setPromoForm({ ...promoForm, discount_value: v.replace(/[^0-9.]/g, '') })}
                placeholder={promoForm.discount_type === 'percentage' ? 'e.g. 50' : 'e.g. 200'}
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
              
              <Text style={[styles.label, { color: theme.text }]}>Max Uses (optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                value={promoForm.max_uses}
                onChangeText={(v) => setPromoForm({ ...promoForm, max_uses: v.replace(/[^0-9]/g, '') })}
                placeholder="Leave empty for unlimited"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
              />
              
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setPromoForm({ ...promoForm, is_active: !promoForm.is_active })}
              >
                <Ionicons 
                  name={promoForm.is_active ? 'checkbox' : 'square-outline'} 
                  size={24} 
                  color={promoForm.is_active ? theme.primary : theme.textSecondary} 
                />
                <Text style={{ color: theme.text, marginLeft: 8 }}>Active</Text>
              </TouchableOpacity>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.surface }]}
                onPress={() => setShowPromoModal(false)}
              >
                <Text style={{ color: theme.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#10b981' }]}
                onPress={handleSavePromo}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {editingPromo ? 'Update' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scrollView: { flex: 1 },
  section: { padding: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: { fontWeight: '600', fontSize: 14 },
  emptyCard: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  feeCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  feeTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  feeInfo: { flex: 1 },
  feeName: { fontSize: 16, fontWeight: '600' },
  feeCardRight: { alignItems: 'flex-end', gap: 8 },
  feeAmount: { fontSize: 18, fontWeight: '800' },
  promoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
  },
  promoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  promoCode: { fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  promoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  promoStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBody: { padding: 16 },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  buttonGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
});
