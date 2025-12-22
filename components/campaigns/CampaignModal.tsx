/**
 * Campaign Create/Edit Modal Component
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  CampaignFormState, 
  CampaignType, 
  DiscountType,
  CAMPAIGN_TYPE_LABELS, 
  DISCOUNT_TYPE_LABELS,
} from './types';

interface CampaignModalProps {
  visible: boolean;
  isEditing: boolean;
  formState: CampaignFormState;
  saving: boolean;
  theme: any;
  onClose: () => void;
  onSave: () => void;
  onUpdateField: <K extends keyof CampaignFormState>(field: K, value: CampaignFormState[K]) => void;
}

export function CampaignModal({
  visible,
  isEditing,
  formState,
  saving,
  theme,
  onClose,
  onSave,
  onUpdateField,
}: CampaignModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            {isEditing ? 'Edit Campaign' : 'New Campaign'}
          </Text>
          <TouchableOpacity onPress={onSave} disabled={saving}>
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
              value={formState.name}
              onChangeText={(v) => onUpdateField('name', v)}
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
                  const isSelected = formState.type === type;
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
                      onPress={() => onUpdateField('type', type)}
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
                  const isSelected = formState.discountType === type;
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
                      onPress={() => onUpdateField('discountType', type)}
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
          {(formState.discountType === 'percentage' || formState.discountType === 'fixed_amount') && (
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Discount Value {formState.discountType === 'percentage' ? '(%)' : '(R)'}
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
                ]}
                value={formState.discountValue}
                onChangeText={(v) => onUpdateField('discountValue', v)}
                placeholder={formState.discountType === 'percentage' ? 'e.g., 20' : 'e.g., 500'}
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
              value={formState.promoCode}
              onChangeText={(v) => onUpdateField('promoCode', v.toUpperCase())}
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
              value={formState.maxRedemptions}
              onChangeText={(v) => onUpdateField('maxRedemptions', v)}
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
              value={formState.description}
              onChangeText={(v) => onUpdateField('description', v)}
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
                value={formState.active}
                onValueChange={(v) => onUpdateField('active', v)}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
            <View style={styles.toggleItem}>
              <Text style={[styles.toggleLabel, { color: theme.text }]}>Featured</Text>
              <Switch
                value={formState.featured}
                onValueChange={(v) => onUpdateField('featured', v)}
                trackColor={{ false: theme.border, true: '#f59e0b' }}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
