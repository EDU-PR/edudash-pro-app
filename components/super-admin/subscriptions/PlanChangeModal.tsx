import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import type { SubscriptionPlan } from '@/lib/subscriptions/rpc-subscriptions';

import { createStyles } from './PlanChangeModal.styles';
import { usePlanChange } from './usePlanChange';
import { getTierDisplayInfo, getPlanPrice } from './usePlanChange.types';
import type { PlanChangeModalProps } from './usePlanChange.types';

export default function PlanChangeModal({ visible, onClose, subscription, school, onSuccess }: PlanChangeModalProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { showAlert, alertProps } = useAlertModal();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    loading, plansLoading, plans, buttonState, buttonMessage,
    selectedPlanId, billingFrequency, seatsTotal, reason,
    setBillingFrequency, setSeatsTotal, setReason,
    getCurrentPlan, getSelectedPlan, isPaymentRequired,
    handlePlanSelect, handleConfirm,
  } = usePlanChange({ subscription, school, visible, onSuccess, onClose, showAlert });

  if (!visible || !subscription || !school) return null;

  const currentPlan = getCurrentPlan();
  const newPlan = getSelectedPlan();
  const currentPrice = getPlanPrice(currentPlan, billingFrequency);
  const newPrice = getPlanPrice(newPlan, billingFrequency);

  const renderPlanOption = (plan: SubscriptionPlan) => {
    const isSelected = selectedPlanId === plan.tier || selectedPlanId === plan.id;
    const isCurrent = subscription?.plan_id === plan.tier || subscription?.plan_id === plan.id;
    const price = getPlanPrice(plan, billingFrequency);
    const tierInfo = getTierDisplayInfo(plan.tier);

    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planOption, { borderColor: theme.border },
          isSelected && { borderColor: theme.primary, backgroundColor: `${theme.primary}11` },
          isCurrent && { borderColor: '#10b981', backgroundColor: '#10b98111' },
        ]}
        onPress={() => handlePlanSelect(plan)}
      >
        <View style={styles.planHeader}>
          <View style={styles.planTitleRow}>
            <Text style={styles.planEmoji}>{tierInfo.emoji}</Text>
            <View style={styles.planTitleText}>
              <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
              <Text style={[styles.planTierLabel, { color: tierInfo.color }]}>
                {tierInfo.level} {isCurrent && '• Current Plan'}
              </Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[styles.planPrice, { color: theme.primary }]}>
              {price === 0 ? 'FREE' : `R${price}`}
            </Text>
            {price > 0 && (
              <Text style={[styles.priceFrequency, { color: theme.textTertiary }]}>
                /{billingFrequency === 'annual' ? 'year' : 'month'}
              </Text>
            )}
          </View>
        </View>
        <Text style={[styles.planDetails, { color: theme.textSecondary }]}>
          Up to {plan.max_teachers} teachers • {plan.max_students} students
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.primary }]} onPress={onClose}>
            <Text style={[styles.backButtonText, { color: theme.onPrimary }]}>
              {t('navigation.back', { defaultValue: 'Back' })}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
            {t('subscription.changePlanFor', { name: school?.name, defaultValue: 'Change Plan - {{name}}' })}
          </Text>
          <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.surface }]} onPress={onClose}>
            <Text style={[styles.closeButtonText, { color: theme.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Current Plan Summary */}
          {currentPlan && (
            <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.summaryTitle, { color: theme.text }]}>
                {t('subscription.currentPlan', { defaultValue: 'Current Plan' })}
              </Text>
              <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                {currentPlan.name} • {subscription.billing_frequency} • {subscription.seats_total} seats
              </Text>
              <Text style={[styles.summaryPrice, { color: theme.textSecondary }]}>
                R{currentPrice}/{subscription.billing_frequency === 'annual' ? t('time.year', { defaultValue: 'year' }) : t('time.month', { defaultValue: 'month' })}
              </Text>
            </View>
          )}

          {/* Plan Selection */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('subscription.selectNewPlan', { count: plans.length, defaultValue: 'Select New Plan ({{count}} available)' })}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textTertiary }]}>
            {t('subscription.planOrderHint', { defaultValue: 'Plans are ordered from lowest to highest tier' })}
          </Text>

          {plansLoading ? (
            <View style={styles.loadingContainer}>
              <EduDashSpinner size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                {t('pricing.loading', { defaultValue: 'Loading pricing plans...' })}
              </Text>
            </View>
          ) : (
            plans.map(renderPlanOption)
          )}

          {/* Billing Frequency */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('subscription.billingFrequency', { defaultValue: 'Billing Frequency' })}
          </Text>
          <View style={styles.billingRow}>
            {(['monthly', 'annual'] as const).map((freq) => (
              <TouchableOpacity
                key={freq}
                style={[
                  styles.billingOption, { borderColor: theme.border },
                  billingFrequency === freq && { borderColor: theme.primary, backgroundColor: `${theme.primary}22` },
                ]}
                onPress={() => setBillingFrequency(freq)}
              >
                <Text style={[
                  styles.billingOptionText, { color: theme.textSecondary },
                  billingFrequency === freq && { color: theme.primary, fontWeight: '700' },
                ]}>
                  {t(`subscription.billing_${freq}`, { defaultValue: freq.charAt(0).toUpperCase() + freq.slice(1) })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Seats */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('subscription.numberOfSeats', { defaultValue: 'Number of Seats' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={seatsTotal}
            onChangeText={setSeatsTotal}
            keyboardType="numeric"
            placeholder={t('subscription.enterSeats', { defaultValue: 'Enter number of seats' })}
            placeholderTextColor={theme.textTertiary}
          />

          {/* Reason (Optional) */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('subscription.reasonOptional', { defaultValue: 'Reason (Optional)' })}
          </Text>
          <TextInput
            style={[styles.reasonInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={reason}
            onChangeText={setReason}
            placeholder={t('subscription.reasonPlaceholder', { defaultValue: 'Reason for plan change...' })}
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={3}
          />

          {/* Change Summary */}
          {newPlan && (
            <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
              <View style={styles.summaryHeader}>
                <Text style={[styles.summaryTitle, { color: theme.text }]}>
                  {t('subscription.changeSummary', { defaultValue: 'Change Summary' })}
                </Text>
                {newPrice > currentPrice && (
                  <View style={[styles.upgradeBadge, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={[styles.upgradeBadgeText, { color: theme.primary }]}>
                      {t('subscription.upgrade', { defaultValue: 'UPGRADE' })}
                    </Text>
                  </View>
                )}
                {newPrice < currentPrice && (
                  <View style={[styles.downgradeBadge, { backgroundColor: '#ef444420' }]}>
                    <Text style={[styles.downgradeBadgeText, { color: '#ef4444' }]}>
                      {t('subscription.downgrade', { defaultValue: 'DOWNGRADE' })}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.changeRow}>
                <Text style={[styles.changeLabel, { color: theme.textTertiary }]}>{t('subscription.plan', { defaultValue: 'Plan' })}</Text>
                <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                  {currentPlan?.name || 'Unknown'} → {newPlan.name}
                </Text>
              </View>
              <View style={styles.changeRow}>
                <Text style={[styles.changeLabel, { color: theme.textTertiary }]}>{t('subscription.billing', { defaultValue: 'Billing' })}</Text>
                <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                  {subscription.billing_frequency} → {billingFrequency}
                </Text>
              </View>
              <View style={styles.changeRow}>
                <Text style={[styles.changeLabel, { color: theme.textTertiary }]}>{t('subscription.seatsLabel', { defaultValue: 'Seats' })}</Text>
                <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                  {subscription.seats_total} → {seatsTotal} seats
                </Text>
              </View>
              <View style={[styles.priceRow, { borderTopColor: theme.border }]}>
                <Text style={[styles.summaryPrice, { color: theme.primary }]}>
                  R{currentPrice} → R{newPrice}/{billingFrequency === 'annual' ? t('time.year', { defaultValue: 'year' }) : t('time.month', { defaultValue: 'month' })}
                </Text>
                {newPrice > currentPrice && (
                  <Text style={[styles.priceIncrease, { color: theme.primary }]}>+R{newPrice - currentPrice}</Text>
                )}
              </View>
              {isPaymentRequired() && (
                <View style={[styles.paymentNotice, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
                  <Text style={[styles.paymentIcon, { color: theme.primary }]}>💳</Text>
                  <Text style={[styles.billingNote, { color: theme.primary, flex: 1 }]}>
                    {t('subscription.paymentRequiredNotice', { defaultValue: 'Payment required - The school principal will be notified via email and push notification to complete payment via PayFast.' })}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TouchableOpacity style={[styles.cancelButton, { borderColor: theme.border }]} onPress={onClose}>
            <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.confirmButton, { backgroundColor: theme.primary },
              (loading || !selectedPlanId) && { backgroundColor: theme.border, opacity: 0.6 },
              buttonState === 'success' && { backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
              buttonState === 'error' && { backgroundColor: '#ef4444', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
            ]}
            onPress={handleConfirm}
            disabled={loading || !selectedPlanId || buttonState === 'success'}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.buttonContent}>
                <EduDashSpinner size="small" color={theme.onPrimary} style={{ marginRight: 8 }} />
                <Text style={[styles.confirmButtonText, { color: theme.onPrimary }]}>
                  {t('common.processing', { defaultValue: 'Processing...' })}
                </Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                {buttonState === 'success' && <View style={styles.successIcon}><Text style={styles.buttonIcon}>✓</Text></View>}
                {buttonState === 'error' && <View style={styles.errorIcon}><Text style={styles.buttonIcon}>⚠️</Text></View>}
                {buttonState === 'default' && (
                  <Text style={[styles.buttonIcon, { opacity: 0.8 }]}>{isPaymentRequired() ? '💳' : '✨'}</Text>
                )}
                <Text style={[styles.confirmButtonText, { color: theme.onPrimary }]}>
                  {buttonMessage || (isPaymentRequired()
                    ? t('subscription.notifySchoolToPay', { defaultValue: 'Notify School to Pay' })
                    : t('subscription.confirmChange', { defaultValue: 'Confirm Change' }))}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <AlertModal {...alertProps} />
    </Modal>
  );
}
