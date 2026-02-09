/**
 * Saved-state display card for a child's uniform order
 * Shows summary + edit button
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  type ChildRow, type UniformEntry,
  formatCurrency, computeChildPricing, type UniformPricing,
} from './UniformSizesSection.styles';

interface Props {
  child: ChildRow;
  entry: UniformEntry;
  pricing?: UniformPricing;
  styles: any;
  onEdit: () => void;
}

export const UniformSavedCard: React.FC<Props> = React.memo(({ child, entry, pricing, styles, onEdit }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { totalAmount, hasPricing } = computeChildPricing(entry, pricing);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.summaryHeader}>
        <Text style={styles.childName}>{child.firstName} {child.lastName}</Text>
        <View style={styles.statusPill}>
          <Ionicons name="checkmark-circle" size={14} color={theme.success} />
          <Text style={styles.statusPillText}>
            {t('dashboard.parent.uniform.status.saved', { defaultValue: 'Saved' })}
          </Text>
        </View>
      </View>
      <Text style={styles.summaryText}>
        {t('dashboard.parent.uniform.summary.details', { defaultValue: 'Size:' })} {entry.tshirtSize || '—'} •{' '}
        {t('dashboard.parent.uniform.labels.tshirts', { defaultValue: 'T-shirts' })} {entry.tshirtQuantity} •{' '}
        {t('dashboard.parent.uniform.labels.shorts', { defaultValue: 'Shorts' })} {entry.shortsQuantity}
      </Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>{t('dashboard.parent.uniform.total.label', { defaultValue: 'Total:' })}</Text>
        <Text style={styles.summaryValue}>
          {hasPricing ? formatCurrency(totalAmount) : t('dashboard.parent.uniform.total.unavailable', { defaultValue: 'Pricing not configured' })}
        </Text>
      </View>
      {entry.isReturning && entry.tshirtNumber ? (
        <Text style={styles.summaryText}>
          {t('dashboard.parent.uniform.labels.back_number', { defaultValue: 'Back number:' })} {entry.tshirtNumber}
        </Text>
      ) : null}
      {entry.updatedAt ? (
        <Text style={styles.updatedText}>
          {t('dashboard.parent.uniform.last_updated', { defaultValue: 'Last updated:' })}{' '}
          {new Date(entry.updatedAt).toLocaleString('en-ZA')}
        </Text>
      ) : null}
      <TouchableOpacity style={styles.editButton} onPress={onEdit}>
        <Text style={styles.editButtonText}>
          {t('dashboard.parent.uniform.actions.edit', { defaultValue: 'Edit order' })}
        </Text>
      </TouchableOpacity>
    </View>
  );
});
