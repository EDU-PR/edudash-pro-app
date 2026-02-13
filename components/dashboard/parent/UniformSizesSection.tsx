/**
 * UniformSizesSection
 *
 * Orchestrates uniform size selection, pricing and payment for each child.
 * Logic lives in useUniformSizes hook; rendering split across sub-components.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { AlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { useUniformSizes } from '@/hooks/useUniformSizes';
import { type UniformSizesSectionProps, computeChildPricing, createUniformStyles } from './UniformSizesSection.styles';
import { UniformSavedCard } from './UniformSavedCard';
import { UniformEditCard } from './UniformEditCard';

export const UniformSizesSection: React.FC<UniformSizesSectionProps> = ({ children }) => {
  const { theme } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createUniformStyles(theme), [theme]);

  const {
    entries, loading, loadError, uniformPricing, alertProps,
    updateEntry, canPayNow, setFullSetQty, setEditing, saveEntry, handlePayAction,
    terminology, t,
  } = useUniformSizes(children);

  const memberLabel = terminology.member;
  const memberLabelLower = memberLabel.toLowerCase();
  const nameLabel = `${memberLabel} ${t('common.name', { defaultValue: 'Name' })}`;
  const namePlaceholder = `${memberLabelLower} ${t('common.name', { defaultValue: 'name' }).toLowerCase()}`;

  if (!children.length) {
    return (
      <>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={styles.emptyText}>
            {t('dashboard.parent.uniform.empty', { defaultValue: 'Add a child to submit uniform sizes.' })}
          </Text>
        </View>
        <AlertModal {...alertProps} />
      </>
    );
  }

  return (
    <>
      <View>
        {/* Section header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t('dashboard.parent.uniform.title', { defaultValue: 'Uniform Sizes' })}</Text>
              <Text style={styles.subtitle}>{t('dashboard.parent.uniform.subtitle', { defaultValue: 'Select sizes, quantities, and choose whether your child has a previous back number.' })}</Text>
            </View>
            <TouchableOpacity style={styles.paymentsButton} onPress={() => router.push('/screens/parent-uniform-payments')}>
              <Ionicons name="receipt-outline" size={14} color={theme.primary} />
              <Text style={styles.paymentsButtonText}>Payments</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading && (
          <View style={styles.inlineRow}>
            <EduDashSpinner size="small" color={theme.primary} />
            <Text style={styles.mutedText}>{t('dashboard.parent.uniform.loading', { defaultValue: 'Loading existing submissions...' })}</Text>
          </View>
        )}
        {loadError && <Text style={styles.errorText}>{loadError}</Text>}

        {children.map((child) => {
          const entry = entries[child.id];
          if (!entry) return null;

          const pricing = child.preschoolId ? uniformPricing[child.preschoolId] : undefined;
          const { hasPricing } = computeChildPricing(entry, pricing);

          // Saved summary view
          if (entry.status === 'saved' && !entry.isEditing) {
            return (
              <UniformSavedCard
                key={child.id}
                child={child}
                entry={entry}
                pricing={pricing}
                styles={styles}
                onEdit={() => setEditing(child.id, true)}
              />
            );
          }

          // Editing form view
          return (
            <UniformEditCard
              key={child.id}
              child={child}
              entry={entry}
              pricing={pricing}
              styles={styles}
              nameLabel={nameLabel}
              namePlaceholder={namePlaceholder}
              onUpdate={(patch) => updateEntry(child.id, patch)}
              onSetFullQty={(v) => setFullSetQty(child.id, v)}
              onSave={() => saveEntry(child.id)}
              onPayNow={() => handlePayAction(child, entry, 'pay')}
              onUploadPOP={() => handlePayAction(child, entry, 'upload')}
              canPay={canPayNow(entry, hasPricing)}
            />
          );
        })}
      </View>
      <AlertModal {...alertProps} />
    </>
  );
};
