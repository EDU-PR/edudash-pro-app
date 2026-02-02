/**
 * PettyCashActions Component
 * 
 * Quick action buttons for petty cash operations
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface Props {
  onAddExpense: () => void;
  onReplenish: () => void;
  onWithdraw: () => void;
  onReset: () => void;
  theme?: any;
}

export function PettyCashActions({ onAddExpense, onReplenish, onWithdraw, onReset, theme }: Props) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const handleReconcile = () => {
    try {
      const { safeRouter } = require('@/lib/navigation/safeRouter');
      safeRouter.push('/screens/petty-cash-reconcile');
    } catch {
      router.push('/screens/petty-cash-reconcile');
    }
  };

  return (
    <View style={styles.actionsCard}>
      <Text style={styles.actionsTitle}>{t('petty_cash.quick_actions')}</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={styles.actionButton} onPress={onAddExpense}>
          <Ionicons name="remove-circle" size={24} color="#EF4444" />
          <Text style={styles.actionText}>{t('petty_cash.add_expense')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={onReplenish}>
          <Ionicons name="add-circle" size={24} color="#10B981" />
          <Text style={styles.actionText}>{t('petty_cash.replenish_cash')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={onWithdraw}>
          <Ionicons name="arrow-down-circle" size={24} color="#F59E0B" />
          <Text style={styles.actionText}>{t('petty_cash.withdraw_cash')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleReconcile}>
          <Ionicons name="calculator" size={24} color="#8B5CF6" />
          <Text style={styles.actionText}>{t('petty_cash.reconcile')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resetSection}>
        <TouchableOpacity style={styles.resetButton} onPress={onReset}>
          <Ionicons name="refresh-circle" size={22} color="#DC2626" />
          <Text style={styles.resetText}>
            {t('petty_cash.reset_cash', { defaultValue: 'Reset Cash to Zero' })}
          </Text>
        </TouchableOpacity>
        <Text style={styles.resetHint}>
          {t('petty_cash.reset_hint', { defaultValue: 'Creates an adjustment entry so the balance starts fresh.' })}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  actionsCard: {
    margin: 16,
    backgroundColor: theme?.cardBackground || '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme?.surfaceVariant || '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
  },
  actionText: {
    fontSize: 12,
    color: theme?.text || '#333',
    marginTop: 8,
    textAlign: 'center',
  },
  resetSection: {
    marginTop: 8,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  resetText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#B91C1C',
  },
  resetHint: {
    marginTop: 6,
    fontSize: 11,
    color: theme?.textSecondary || '#6B7280',
    textAlign: 'center',
  },
});

export default PettyCashActions;
