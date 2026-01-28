import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import { BirthdayDonationsService } from '@/features/birthday-donations/services/BirthdayDonationsService';
import type {
  BirthdayDonationBirthdays,
  BirthdayDonationDay,
  BirthdayDonationEntry,
} from '@/features/birthday-donations/types/birthdayDonations.types';
import { z } from 'zod';

interface BirthdayDonationRegisterProps {
  organizationId?: string | null;
}

const AMOUNT_SCHEMA = z.coerce.number().positive();

const PAYMENT_METHODS = ['cash', 'eft', 'card', 'other'] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

const DEFAULT_AMOUNT = 25;

export const BirthdayDonationRegister: React.FC<BirthdayDonationRegisterProps> = ({ organizationId }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const todayString = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [birthdays, setBirthdays] = useState<BirthdayDonationBirthdays[]>([]);
  const [daySummary, setDaySummary] = useState<BirthdayDonationDay | null>(null);
  const [donations, setDonations] = useState<BirthdayDonationEntry[]>([]);
  const [amount, setAmount] = useState(String(DEFAULT_AMOUNT));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const birthdayCount = birthdays.length;
  const expectedAmount = daySummary?.expectedAmount ?? DEFAULT_AMOUNT;
  const totalReceived = daySummary?.totalReceived ?? 0;
  const remainingAmount = Math.max(expectedAmount - totalReceived, 0);
  const hasTooManyBirthdays = birthdayCount > 2;
  const hasNoBirthdays = birthdayCount === 0;

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [birthdaysData, summaryData, donationsData] = await Promise.all([
        BirthdayDonationsService.getTodayBirthdays(organizationId, todayString),
        BirthdayDonationsService.getDaySummary(organizationId, todayString),
        BirthdayDonationsService.getDonationsForDay(organizationId, todayString),
      ]);
      setBirthdays(birthdaysData);
      setDaySummary(summaryData);
      setDonations(donationsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load donations';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [organizationId, todayString]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRecordDonation = async () => {
    if (!organizationId) return;
    setError(null);

    if (hasNoBirthdays) {
      setError(t('dashboard.birthday_donations.no_birthdays', { defaultValue: 'No birthdays today. Donation register is closed.' }));
      return;
    }

    if (hasTooManyBirthdays) {
      setError(t('dashboard.birthday_donations.limit_warning', { defaultValue: 'More than two birthdays detected. Please contact admin to correct the roster.' }));
      return;
    }

    let amountValue: number;
    try {
      amountValue = AMOUNT_SCHEMA.parse(amount);
    } catch {
      setError(t('dashboard.birthday_donations.amount_error', { defaultValue: 'Enter a valid amount.' }));
      return;
    }

    setSaving(true);
    try {
      await BirthdayDonationsService.recordDonation(organizationId, {
        donationDate: todayString,
        amount: amountValue,
        paymentMethod,
        note: note.trim() || undefined,
      });
      setAmount(String(DEFAULT_AMOUNT));
      setNote('');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('dashboard.birthday_donations.record_error', { defaultValue: 'Failed to record donation.' });
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!organizationId) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t('dashboard.birthday_donations.title', { defaultValue: 'Birthday Donations' })}</Text>
        <Text style={styles.muted}>{t('dashboard.birthday_donations.no_org', { defaultValue: 'Connect your school profile to track donations.' })}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('dashboard.birthday_donations.title', { defaultValue: 'Birthday Donations' })}</Text>
      <Text style={styles.subtitle}>{t('dashboard.birthday_donations.subtitle', { defaultValue: 'Record today\'s R25 donation for birthday packs.' })}</Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.muted}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
        </View>
      ) : (
        <>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>{t('dashboard.birthday_donations.today_label', { defaultValue: 'Birthdays today' })}</Text>
            <Text style={styles.value}>{birthdayCount}</Text>
          </View>
          <View style={styles.birthdayList}>
            {birthdays.length === 0 ? (
              <Text style={styles.muted}>{t('dashboard.birthday_donations.none_today', { defaultValue: 'No birthdays today.' })}</Text>
            ) : (
              birthdays.map((birthday) => (
                <Text key={birthday.id} style={styles.birthdayName}>
                  • {birthday.firstName} {birthday.lastName}{birthday.className ? ` (${birthday.className})` : ''}
                </Text>
              ))
            )}
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('dashboard.birthday_donations.expected_amount', { defaultValue: 'Expected' })}</Text>
              <Text style={styles.summaryValue}>R{expectedAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('dashboard.birthday_donations.total_received', { defaultValue: 'Received' })}</Text>
              <Text style={styles.summaryValue}>R{totalReceived.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('dashboard.birthday_donations.remaining', { defaultValue: 'Remaining' })}</Text>
              <Text style={styles.summaryValue}>R{remainingAmount.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>{t('dashboard.birthday_donations.amount_label', { defaultValue: 'Donation amount' })}</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="25"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={styles.label}>{t('dashboard.birthday_donations.method_label', { defaultValue: 'Payment method' })}</Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map((method) => {
                const selected = method === paymentMethod;
                return (
                  <TouchableOpacity
                    key={method}
                    style={[styles.methodChip, selected && { backgroundColor: theme.primary }]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text style={[styles.methodText, selected && { color: '#fff' }]}>
                      {t(`dashboard.birthday_donations.methods.${method}`, { defaultValue: method.toUpperCase() })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{t('dashboard.birthday_donations.note_label', { defaultValue: 'Notes (optional)' })}</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={note}
              onChangeText={setNote}
              placeholder={t('dashboard.birthday_donations.note_placeholder', { defaultValue: 'Add any notes...' })}
              placeholderTextColor={theme.textSecondary}
              multiline
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitButton, (saving || hasNoBirthdays || hasTooManyBirthdays) && styles.submitDisabled]}
            onPress={handleRecordDonation}
            disabled={saving || hasNoBirthdays || hasTooManyBirthdays}
          >
            <Text style={styles.submitText}>
              {saving
                ? t('common.saving', { defaultValue: 'Saving...' })
                : t('dashboard.birthday_donations.record_button', { defaultValue: 'Record Donation' })}
            </Text>
          </TouchableOpacity>

          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>{t('dashboard.birthday_donations.recent_title', { defaultValue: 'Today\'s entries' })}</Text>
            {donations.length === 0 ? (
              <Text style={styles.muted}>{t('dashboard.birthday_donations.no_entries', { defaultValue: 'No donations recorded yet.' })}</Text>
            ) : (
              donations.map((entry) => (
                <View key={entry.id} style={styles.recentRow}>
                  <Text style={styles.recentAmount}>R{entry.amount.toFixed(2)}</Text>
                  <Text style={styles.recentMeta}>{entry.paymentMethod || t('dashboard.birthday_donations.methods.cash', { defaultValue: 'Cash' })}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </View>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 12,
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  muted: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  birthdayList: {
    marginBottom: 12,
  },
  birthdayName: {
    fontSize: 13,
    color: theme.text,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: theme.background,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  summaryLabel: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    marginTop: 4,
  },
  formSection: {
    marginTop: 4,
  },
  input: {
    backgroundColor: theme.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.text,
    fontSize: 14,
  },
  noteInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
  methodText: {
    fontSize: 12,
    color: theme.text,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
  },
  errorText: {
    marginTop: 8,
    color: theme.error,
    fontSize: 12,
  },
  recentSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 6,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  recentAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  recentMeta: {
    fontSize: 12,
    color: theme.textSecondary,
  },
});
