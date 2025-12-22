/**
 * Global AI configuration modal
 * @module components/super-admin/ai-quotas/GlobalConfigModal
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { GlobalQuotaConfig } from './types';

interface GlobalConfigModalProps {
  visible: boolean;
  config: GlobalQuotaConfig;
  saving: boolean;
  onConfigChange: (config: GlobalQuotaConfig) => void;
  onSave: () => void;
  onClose: () => void;
}

export function GlobalConfigModal({
  visible,
  config,
  saving,
  onConfigChange,
  onSave,
  onClose,
}: GlobalConfigModalProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Global AI Configuration</Text>
          <TouchableOpacity onPress={onSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Plan Limits Section */}
          <View style={styles.configSection}>
            <Text style={styles.configSectionTitle}>Plan Limits (tokens/month)</Text>
            
            <View style={styles.configItem}>
              <Text style={styles.configLabel}>Free Tier</Text>
              <TextInput
                style={styles.configInput}
                value={config.free_tier_limit.toString()}
                onChangeText={(text) => onConfigChange({ 
                  ...config, 
                  free_tier_limit: parseInt(text) || 0 
                })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.configItem}>
              <Text style={styles.configLabel}>Basic Tier</Text>
              <TextInput
                style={styles.configInput}
                value={config.basic_tier_limit.toString()}
                onChangeText={(text) => onConfigChange({ 
                  ...config, 
                  basic_tier_limit: parseInt(text) || 0 
                })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.configItem}>
              <Text style={styles.configLabel}>Pro Tier</Text>
              <TextInput
                style={styles.configInput}
                value={config.pro_tier_limit.toString()}
                onChangeText={(text) => onConfigChange({ 
                  ...config, 
                  pro_tier_limit: parseInt(text) || 0 
                })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.configItem}>
              <Text style={styles.configLabel}>Enterprise Tier</Text>
              <TextInput
                style={styles.configInput}
                value={config.enterprise_tier_limit.toString()}
                onChangeText={(text) => onConfigChange({ 
                  ...config, 
                  enterprise_tier_limit: parseInt(text) || 0 
                })}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Overage Settings Section */}
          <View style={styles.configSection}>
            <Text style={styles.configSectionTitle}>Overage Settings</Text>
            
            <View style={styles.configItem}>
              <Text style={styles.configLabel}>Cost per Token ($)</Text>
              <TextInput
                style={styles.configInput}
                value={config.overage_rate.toString()}
                onChangeText={(text) => onConfigChange({ 
                  ...config, 
                  overage_rate: parseFloat(text) || 0 
                })}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.configItem}>
              <Text style={styles.configLabel}>Suspension Threshold (%)</Text>
              <TextInput
                style={styles.configInput}
                value={config.suspension_threshold.toString()}
                onChangeText={(text) => onConfigChange({ 
                  ...config, 
                  suspension_threshold: parseInt(text) || 0 
                })}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* System Settings Section */}
          <View style={styles.configSection}>
            <Text style={styles.configSectionTitle}>System Settings</Text>
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Auto-reset monthly</Text>
              <Switch
                value={config.auto_reset_enabled}
                onValueChange={(value) => onConfigChange({ 
                  ...config, 
                  auto_reset_enabled: value 
                })}
                trackColor={{ false: '#374151', true: '#00f5ff40' }}
                thumbColor={config.auto_reset_enabled ? '#00f5ff' : '#9ca3af'}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Cost alerts enabled</Text>
              <Switch
                value={config.cost_alerts_enabled}
                onValueChange={(value) => onConfigChange({ 
                  ...config, 
                  cost_alerts_enabled: value 
                })}
                trackColor={{ false: '#374151', true: '#00f5ff40' }}
                thumbColor={config.cost_alerts_enabled ? '#00f5ff' : '#9ca3af'}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#00f5ff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#111827',
  },
  configSection: {
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  configSectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  configItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  configLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  configInput: {
    backgroundColor: '#374151',
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    fontSize: 14,
    minWidth: 80,
    textAlign: 'right',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});
