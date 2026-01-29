import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { getUniformItemType, isUniformFee } from '@/lib/utils/feeUtils';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { useOrganizationTerminology } from '@/lib/hooks/useOrganizationTerminology';
import { useTranslation } from 'react-i18next';

const SIZE_OPTIONS = [
  '2-3',
  '3-4',
  '4-5',
  '5-6',
  '6-7',
  '7-8',
  '8-9',
  '9-10',
  '10-11',
  '11-12',
  '12-13',
  'XS',
  'S',
  'M',
  'L',
  'XL',
];

type EntryStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UniformEntry {
  childName: string;
  ageYears: string;
  tshirtSize: string;
  tshirtQuantity: string;
  shortsQuantity: string;
  isReturning: boolean;
  tshirtNumber: string;
  sampleSupplied: boolean;
  status: EntryStatus;
  message?: string | null;
  updatedAt?: string | null;
  isEditing?: boolean;
}

interface ChildRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  studentCode?: string | null;
  preschoolId?: string | null;
}

interface UniformSizesSectionProps {
  children: ChildRow[];
  schoolName?: string;
}

interface UniformFeeRow {
  amount: number;
  fee_type?: string | null;
  name?: string | null;
  description?: string | null;
  effective_from?: string | null;
  created_at?: string | null;
}

interface SchoolUniformFeeRow {
  amount_cents: number;
  fee_category?: string | null;
  name?: string | null;
  description?: string | null;
  created_at?: string | null;
}

interface UniformPricing {
  setAmount?: number;
  tshirtAmount?: number;
  shortsAmount?: number;
  fallbackAmount?: number;
}

interface UniformRequestRow {
  student_id: string;
  child_name?: string | null;
  age_years?: number | null;
  tshirt_size?: string | null;
  tshirt_quantity?: number | null;
  shorts_quantity?: number | null;
  is_returning?: boolean | null;
  tshirt_number?: string | null;
  sample_supplied?: boolean | null;
  updated_at?: string | null;
}

const getAgeYears = (dob?: string | null): string => {
  if (!dob) return '';
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return '';
  const age = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  return age > 0 ? String(age) : '';
};

const formatCurrency = (value: number) => `R ${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
};

export const UniformSizesSection: React.FC<UniformSizesSectionProps> = ({ children, schoolName }) => {
  const { theme } = useTheme();
  const { terminology } = useOrganizationTerminology();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, alertProps } = useAlertModal();
  const memberLabel = terminology.member;
  const memberLabelLower = memberLabel.toLowerCase();
  const institutionLabel = terminology.institution;
  const nameLabel = `${memberLabel} ${t('common.name', { defaultValue: 'Name' })}`;
  const namePlaceholder = `${memberLabelLower} ${t('common.name', { defaultValue: 'name' }).toLowerCase()}`;
  const [entries, setEntries] = useState<Record<string, UniformEntry>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uniformPricing, setUniformPricing] = useState<Record<string, UniformPricing>>({});

  useEffect(() => {
    if (!children.length) {
      setEntries({});
      return;
    }

    const defaults: Record<string, UniformEntry> = {};
    children.forEach((child) => {
      defaults[child.id] = {
        childName: `${child.firstName} ${child.lastName}`.trim(),
        ageYears: getAgeYears(child.dateOfBirth),
        tshirtSize: '',
        tshirtQuantity: '1',
        shortsQuantity: '1',
        isReturning: false,
        tshirtNumber: '',
        sampleSupplied: false,
        status: 'idle',
        message: null,
        updatedAt: null,
        isEditing: true,
      };
    });

    setEntries((prev) => {
      const merged: Record<string, UniformEntry> = { ...defaults };
      Object.entries(prev).forEach(([id, entry]) => {
        merged[id] = { ...merged[id], ...entry };
      });
      return merged;
    });
  }, [children]);

  useEffect(() => {
    const loadExisting = async () => {
      if (!children.length) return;
      setLoading(true);
      setLoadError(null);
      try {
        const supabase = assertSupabase();
        const childIds = children.map((child) => child.id);
        const { data, error } = await supabase
          .from('uniform_requests')
          .select('student_id, child_name, age_years, tshirt_size, tshirt_quantity, shorts_quantity, is_returning, tshirt_number, sample_supplied, updated_at')
          .in('student_id', childIds);

        if (error) throw error;

        const uniformRows: UniformRequestRow[] = Array.isArray(data) ? data : [];
        if (uniformRows.length) {
          setEntries((prev) => {
            const next = { ...prev };
            uniformRows.forEach((row) => {
              const isReturning = row.is_returning ?? next[row.student_id]?.isReturning ?? false;
              const sampleSupplied = row.sample_supplied ?? next[row.student_id]?.sampleSupplied ?? false;
              next[row.student_id] = {
                ...(next[row.student_id] || {}),
                childName: row.child_name || next[row.student_id]?.childName || '',
                ageYears: row.age_years ? String(row.age_years) : next[row.student_id]?.ageYears || '',
                tshirtSize: row.tshirt_size || next[row.student_id]?.tshirtSize || '',
                tshirtQuantity: row.tshirt_quantity ? String(row.tshirt_quantity) : next[row.student_id]?.tshirtQuantity || '1',
                shortsQuantity: row.shorts_quantity ? String(row.shorts_quantity) : next[row.student_id]?.shortsQuantity || '1',
                isReturning,
                tshirtNumber: isReturning ? row.tshirt_number || next[row.student_id]?.tshirtNumber || '' : '',
                sampleSupplied,
                status: 'saved',
                message: t('dashboard.parent.uniform.status.saved', { defaultValue: 'Saved' }),
                updatedAt: row.updated_at || null,
                isEditing: false,
              };
            });
            return next;
          });
        }
      } catch (error: unknown) {
        setLoadError(getErrorMessage(
          error,
          t('dashboard.parent.uniform.errors.load_existing', { defaultValue: 'Unable to load uniform sizes.' })
        ));
      } finally {
        setLoading(false);
      }
    };

    loadExisting();
  }, [children]);

  useEffect(() => {
    const loadUniformPricing = async () => {
      const preschoolIds = Array.from(new Set(children.map((child) => child.preschoolId).filter(Boolean))) as string[];
      if (!preschoolIds.length) return;

      try {
        const supabase = assertSupabase();
        const pricingMap: Record<string, UniformPricing> = {};

        for (const preschoolId of preschoolIds) {
          const pricing: UniformPricing = {};

          const applyFee = (
            amount: number,
            feeType?: string | null,
            name?: string | null,
            description?: string | null
          ) => {
            if (!Number.isFinite(amount)) return;
            const itemType = getUniformItemType(feeType, name, description);
            if (itemType === 'set' && pricing.setAmount == null) {
              pricing.setAmount = amount;
              return;
            }
            if (itemType === 'tshirt' && pricing.tshirtAmount == null) {
              pricing.tshirtAmount = amount;
              return;
            }
            if (itemType === 'shorts' && pricing.shortsAmount == null) {
              pricing.shortsAmount = amount;
              return;
            }
            if (pricing.fallbackAmount == null) {
              pricing.fallbackAmount = amount;
            }
          };

          const { data: feeStructures } = await supabase
            .from('fee_structures')
            .select('amount, fee_type, name, description, effective_from, created_at')
            .eq('preschool_id', preschoolId)
            .eq('is_active', true)
            .order('effective_from', { ascending: false })
            .order('created_at', { ascending: false });

          const uniformFees = (feeStructures || []).filter((fee: UniformFeeRow) =>
            isUniformFee(fee.fee_type, fee.name, fee.description)
          );

          uniformFees.forEach((fee) => {
            applyFee(fee.amount, fee.fee_type, fee.name, fee.description);
          });

          const { data: schoolFees } = await supabase
            .from('school_fee_structures')
            .select('amount_cents, fee_category, name, description, created_at')
            .eq('preschool_id', preschoolId)
            .eq('is_active', true);

          const uniformSchoolFees = (schoolFees || []).filter((fee: SchoolUniformFeeRow) =>
            isUniformFee(fee.fee_category, fee.name, fee.description)
          );

          uniformSchoolFees.forEach((fee) => {
            applyFee(fee.amount_cents / 100, fee.fee_category, fee.name, fee.description);
          });

          if (pricing.tshirtAmount || pricing.shortsAmount || pricing.fallbackAmount) {
            pricingMap[preschoolId] = pricing;
          }
        }

        if (Object.keys(pricingMap).length > 0) {
          setUniformPricing((prev) => ({ ...prev, ...pricingMap }));
        }
      } catch (error: unknown) {
        console.warn('[UniformSizes] Failed to load uniform pricing:', error);
      }
    };

    loadUniformPricing();
  }, [children]);

  const updateEntry = (childId: string, patch: Partial<UniformEntry>) => {
    setEntries((prev) => ({
      ...prev,
      [childId]: { ...prev[childId], ...patch, status: 'idle', message: null },
    }));
  };

  const canPayNow = (entry: UniformEntry) => {
    const tshirtQty = parseInt(entry.tshirtQuantity, 10);
    const shortsQty = parseInt(entry.shortsQuantity, 10);
    const totalItems = (Number.isFinite(tshirtQty) ? tshirtQty : 0) + (Number.isFinite(shortsQty) ? shortsQty : 0);
    return Boolean(entry.tshirtSize) && totalItems > 0;
  };

  const setFullSetQuantity = (childId: string, value: string) => {
    if (value.trim() === '') {
      updateEntry(childId, { tshirtQuantity: '', shortsQuantity: '' });
      return;
    }
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(Math.max(parsed, 0), 20);
    updateEntry(childId, { tshirtQuantity: String(clamped), shortsQuantity: String(clamped) });
  };

  const setEditing = (childId: string, isEditing: boolean) => {
    setEntries((prev) => ({
      ...prev,
      [childId]: { ...prev[childId], isEditing },
    }));
  };

  const saveEntry = async (childId: string) => {
    const entry = entries[childId];
    if (!entry) return;

    const childName = entry.childName.trim();
    const ageValue = parseInt(entry.ageYears, 10);
    const tshirtNumber = entry.tshirtNumber.trim();
    const tshirtQty = parseInt(entry.tshirtQuantity, 10);
    const shortsQty = parseInt(entry.shortsQuantity, 10);

    if (!childName) {
      updateEntry(childId, {
        status: 'error',
        message: t('dashboard.parent.uniform.validation.child_name', { defaultValue: 'Please enter the child name.' }),
      });
      return;
    }
    if (!entry.tshirtSize) {
      updateEntry(childId, {
        status: 'error',
        message: t('dashboard.parent.uniform.validation.tshirt_size', { defaultValue: 'Select a T-shirt size.' }),
      });
      return;
    }
    if (!Number.isFinite(ageValue) || ageValue < 1 || ageValue > 18) {
      updateEntry(childId, {
        status: 'error',
        message: t('dashboard.parent.uniform.validation.age', { defaultValue: 'Enter a valid age (1-18).' }),
      });
      return;
    }
    if (entry.isReturning && !tshirtNumber) {
      updateEntry(childId, {
        status: 'error',
        message: t('dashboard.parent.uniform.validation.tshirt_number', { defaultValue: 'Enter the returning T-shirt number.' }),
      });
      return;
    }
    if (entry.isReturning && tshirtNumber && !/^\d{1,6}$/.test(tshirtNumber)) {
      updateEntry(childId, {
        status: 'error',
        message: t('dashboard.parent.uniform.validation.tshirt_number_format', { defaultValue: 'T-shirt number must be 1-6 digits.' }),
      });
      return;
    }
    if (!Number.isFinite(tshirtQty) || tshirtQty < 1 || tshirtQty > 20) {
      updateEntry(childId, {
        status: 'error',
        message: t('dashboard.parent.uniform.validation.tshirt_qty', { defaultValue: 'Enter a valid number of T-shirts (1-20).' }),
      });
      return;
    }
    if (!Number.isFinite(shortsQty) || shortsQty < 0 || shortsQty > 20) {
      updateEntry(childId, {
        status: 'error',
        message: t('dashboard.parent.uniform.validation.shorts_qty', { defaultValue: 'Enter a valid number of shorts (0-20).' }),
      });
      return;
    }

    setEntries((prev) => ({
      ...prev,
      [childId]: { ...prev[childId], status: 'saving', message: null },
    }));

    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('uniform_requests')
        .upsert(
          {
            student_id: childId,
            child_name: childName,
            age_years: ageValue,
            tshirt_size: entry.tshirtSize,
            tshirt_quantity: tshirtQty,
            shorts_quantity: shortsQty,
            is_returning: entry.isReturning,
            tshirt_number: entry.isReturning ? tshirtNumber || null : null,
            sample_supplied: entry.sampleSupplied,
          },
          { onConflict: 'student_id' }
        )
        .select('updated_at')
        .single();

      if (error) throw error;

      setEntries((prev) => ({
        ...prev,
        [childId]: {
          ...prev[childId],
          status: 'saved',
          message: t('dashboard.parent.uniform.status.saved', { defaultValue: 'Saved' }),
          updatedAt: data?.updated_at || new Date().toISOString(),
          isEditing: false,
        },
      }));
    } catch (error: unknown) {
      setEntries((prev) => ({
        ...prev,
        [childId]: {
          ...prev[childId],
          status: 'error',
          message: getErrorMessage(
            error,
            t('dashboard.parent.uniform.errors.save_failed', { defaultValue: 'Save failed' })
          ),
        },
      }));
    }
  };

  const handlePayNow = (child: ChildRow, entry: UniformEntry) => {
    const preschoolId = child.preschoolId || null;
    if (!preschoolId) {
      showAlert({
        title: t('dashboard.parent.uniform.alerts.institution_missing.title', {
          defaultValue: '{{institution}} not found',
          institution: institutionLabel,
        }),
        message: t('dashboard.parent.uniform.alerts.institution_missing.message', {
          defaultValue: 'We could not find the {{institution}} for this {{member}}.',
          institution: institutionLabel.toLowerCase(),
          member: memberLabelLower,
        }),
        type: 'error',
      });
      return;
    }

    if (!entry.tshirtSize) {
      showAlert({
        title: t('dashboard.parent.uniform.alerts.missing_size.title', { defaultValue: 'Missing size' }),
        message: t('dashboard.parent.uniform.alerts.missing_size.message', { defaultValue: 'Please select a T-shirt size before paying.' }),
        type: 'warning',
      });
      return;
    }

    const tshirtQty = parseInt(entry.tshirtQuantity, 10);
    const shortsQty = parseInt(entry.shortsQuantity, 10);
    const resolvedTshirtQty = Number.isFinite(tshirtQty) ? tshirtQty : 0;
    const resolvedShortsQty = Number.isFinite(shortsQty) ? shortsQty : 0;
    const totalItems = resolvedTshirtQty + resolvedShortsQty;

    if (!totalItems || totalItems <= 0) {
      showAlert({
        title: t('dashboard.parent.uniform.alerts.missing_quantities.title', { defaultValue: 'Missing quantities' }),
        message: t('dashboard.parent.uniform.alerts.missing_quantities.message', { defaultValue: 'Enter the number of T-shirts and shorts before paying.' }),
        type: 'warning',
      });
      return;
    }

    const pricing = uniformPricing[preschoolId];
    const setPrice = pricing?.setAmount ?? pricing?.fallbackAmount ?? 0;
    const tshirtPrice = pricing?.tshirtAmount ?? 0;
    const shortsPrice = pricing?.shortsAmount ?? 0;
    const setQty = setPrice > 0 ? Math.min(resolvedTshirtQty, resolvedShortsQty) : 0;
    const remainingTshirts = Math.max(resolvedTshirtQty - setQty, 0);
    const remainingShorts = Math.max(resolvedShortsQty - setQty, 0);
    const totalAmount = (setPrice * setQty) + (tshirtPrice * remainingTshirts) + (shortsPrice * remainingShorts);

    const hasAnyPricing = Boolean(pricing && (setPrice > 0 || tshirtPrice > 0 || shortsPrice > 0));

    if (!hasAnyPricing) {
      showAlert({
        title: t('dashboard.parent.uniform.alerts.pricing_missing.title', { defaultValue: 'Uniform pricing not set' }),
        message: t('dashboard.parent.uniform.alerts.pricing_missing.message', {
          defaultValue: 'Uniform pricing is not configured yet. We will still generate a reference for you.',
        }),
        type: 'warning',
      });
    } else if ((remainingTshirts > 0 && tshirtPrice <= 0) || (remainingShorts > 0 && shortsPrice <= 0)) {
      showAlert({
        title: t('dashboard.parent.uniform.alerts.pricing_incomplete.title', { defaultValue: 'Uniform pricing incomplete' }),
        message: t('dashboard.parent.uniform.alerts.pricing_incomplete.message', {
          defaultValue: 'Some uniform items do not have a price yet. We will still generate a reference for you.',
        }),
        type: 'warning',
      });
    }

    const descriptionParts = [
      t('dashboard.parent.uniform.payment.description', {
        defaultValue: 'Uniform order • Size {{size}} • T-shirts {{tshirts}} • Shorts {{shorts}}',
        size: entry.tshirtSize || '-',
        tshirts: tshirtQty,
        shorts: shortsQty,
      }),
    ].filter(Boolean);

    const referenceCode = child.studentCode || `UNIFORM-${child.id.slice(0, 6).toUpperCase()}`;

    router.push({
      pathname: '/screens/payment-flow',
      params: {
        feeDescription: descriptionParts.join(' • '),
        feeAmount: totalAmount.toFixed(2),
        childId: child.id,
        childName: `${child.firstName} ${child.lastName}`.trim(),
        studentCode: referenceCode,
        preschoolId,
        preschoolName: schoolName || '',
      },
    });
  };

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
        <View style={styles.header}>
          <Text style={styles.title}>{t('dashboard.parent.uniform.title', { defaultValue: 'Uniform Sizes' })}</Text>
          <Text style={styles.subtitle}>{t('dashboard.parent.uniform.subtitle', { defaultValue: 'Select sizes, quantities, and add a returning number if needed.' })}</Text>
        </View>

        {loading && (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.mutedText}>{t('dashboard.parent.uniform.loading', { defaultValue: 'Loading existing submissions...' })}</Text>
          </View>
        )}
        {loadError && <Text style={styles.errorText}>{loadError}</Text>}

        {children.map((child) => {
          const entry = entries[child.id];
          if (!entry) return null;
          const preschoolId = child.preschoolId || '';
          const pricing = preschoolId ? uniformPricing[preschoolId] : undefined;
          const tshirtQty = Number.isFinite(Number(entry.tshirtQuantity)) ? Number(entry.tshirtQuantity) : 0;
          const shortsQty = Number.isFinite(Number(entry.shortsQuantity)) ? Number(entry.shortsQuantity) : 0;
          const setPrice = pricing?.setAmount ?? pricing?.fallbackAmount ?? 0;
          const tshirtPrice = pricing?.tshirtAmount ?? 0;
          const shortsPrice = pricing?.shortsAmount ?? 0;
          const impliedSetQty = Math.min(tshirtQty, shortsQty);
          const billableSetQty = setPrice > 0 ? impliedSetQty : 0;
          const remainingTshirts = Math.max(tshirtQty - billableSetQty, 0);
          const remainingShorts = Math.max(shortsQty - billableSetQty, 0);
          const orderExtraTshirts = Math.max(tshirtQty - impliedSetQty, 0);
          const orderExtraShorts = Math.max(shortsQty - impliedSetQty, 0);
          const totalAmount = (setPrice * billableSetQty) + (tshirtPrice * remainingTshirts) + (shortsPrice * remainingShorts);
          const hasPricing = Boolean(pricing && (setPrice > 0 || tshirtPrice > 0 || shortsPrice > 0));

          if (entry.status === 'saved' && !entry.isEditing) {
            return (
              <View key={child.id} style={[styles.card, { backgroundColor: theme.surface }]}>
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
                    {hasPricing
                      ? formatCurrency(totalAmount)
                      : t('dashboard.parent.uniform.total.unavailable', { defaultValue: 'Pricing not configured' })}
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
                <TouchableOpacity style={styles.editButton} onPress={() => setEditing(child.id, true)}>
                  <Text style={styles.editButtonText}>{t('dashboard.parent.uniform.actions.edit', { defaultValue: 'Edit order' })}</Text>
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <View key={child.id} style={[styles.card, { backgroundColor: theme.surface }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{child.firstName.charAt(0)}{child.lastName.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.childName}>{child.firstName} {child.lastName}</Text>
                    <Text style={styles.helperText}>
                      {t('dashboard.parent.uniform.helper.complete_form', { defaultValue: 'Complete the uniform form below.' })}
                    </Text>
                  </View>
                </View>
                {entry.status === 'saved' && (
                  <View style={styles.statusPill}>
                    <Ionicons name="checkmark-circle" size={14} color={theme.success} />
                    <Text style={styles.statusPillText}>
                      {t('dashboard.parent.uniform.status.saved', { defaultValue: 'Saved' })}
                    </Text>
                  </View>
                )}
              </View>

            <Text style={styles.sectionTitle}>
              {t('dashboard.parent.uniform.sections.details', { defaultValue: 'Details & Sizes' })}
            </Text>
            <Text style={styles.label}>{nameLabel}</Text>
            <TextInput
              style={styles.input}
              value={entry.childName}
              onChangeText={(text) => updateEntry(child.id, { childName: text })}
              placeholder={namePlaceholder}
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={styles.label}>{t('dashboard.parent.uniform.labels.age', { defaultValue: 'Age (years)' })}</Text>
            <TextInput
              style={styles.input}
              value={entry.ageYears}
              onChangeText={(text) => updateEntry(child.id, { ageYears: text })}
              placeholder={t('dashboard.parent.uniform.placeholders.age', { defaultValue: 'Age' })}
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
            />

            <Text style={styles.sectionTitle}>
              {t('dashboard.parent.uniform.sections.sizes', { defaultValue: 'Sizes & Quantities' })}
            </Text>
            <Text style={styles.label}>{t('dashboard.parent.uniform.labels.tshirt_size', { defaultValue: 'T-shirt Size' })}</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={entry.tshirtSize}
                onValueChange={(value) => updateEntry(child.id, { tshirtSize: value })}
                style={styles.picker}
              >
                <Picker.Item label={t('dashboard.parent.uniform.placeholders.select_size', { defaultValue: 'Select size' })} value="" />
                {SIZE_OPTIONS.map((size) => (
                  <Picker.Item key={size} label={size} value={size} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>{t('dashboard.parent.uniform.labels.tshirts', { defaultValue: 'T-shirts' })}</Text>
            <TextInput
              style={styles.input}
              value={entry.tshirtQuantity}
              onChangeText={(text) => updateEntry(child.id, { tshirtQuantity: text })}
              placeholder={t('dashboard.parent.uniform.placeholders.default_one', { defaultValue: '1' })}
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={2}
            />

            <Text style={styles.label}>{t('dashboard.parent.uniform.labels.shorts', { defaultValue: 'Shorts' })}</Text>
            <TextInput
              style={styles.input}
              value={entry.shortsQuantity}
              onChangeText={(text) => updateEntry(child.id, { shortsQuantity: text })}
              placeholder={t('dashboard.parent.uniform.placeholders.default_one', { defaultValue: '1' })}
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={2}
            />

            <Text style={styles.label}>
              {t('dashboard.parent.uniform.labels.full_sets', { defaultValue: 'Full sets (1 set = 1 T-shirt + 1 shorts)' })}
            </Text>
            <View style={styles.setRow}>
              <TextInput
                style={[styles.input, styles.setInput]}
                value={impliedSetQty ? String(impliedSetQty) : ''}
                onChangeText={(text) => setFullSetQuantity(child.id, text)}
                placeholder={t('dashboard.parent.uniform.placeholders.default_one', { defaultValue: '1' })}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TouchableOpacity
                style={[styles.matchButton, { borderColor: theme.primary }]}
                onPress={() => setFullSetQuantity(child.id, entry.tshirtQuantity)}
              >
                <Text style={[styles.matchButtonText, { color: theme.primary }]}>
                  {t('dashboard.parent.uniform.actions.match_tshirt', { defaultValue: 'Match to T-shirt qty' })}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              {t('dashboard.parent.uniform.helper.full_sets', { defaultValue: 'This sets both quantities to the same value. You can still edit them separately above.' })}
            </Text>

            <View style={styles.pricingCard}>
              <Text style={styles.pricingTitle}>{t('dashboard.parent.uniform.pricing.title', { defaultValue: 'Pricing summary' })}</Text>
              <Text style={styles.pricingText}>
                {(setPrice > 0
                  ? t('dashboard.parent.uniform.pricing.full_set', { defaultValue: 'Full set {{amount}}', amount: formatCurrency(setPrice) })
                  : t('dashboard.parent.uniform.pricing.full_set_unset', { defaultValue: 'Full set —' })
                )} • {(tshirtPrice > 0
                  ? t('dashboard.parent.uniform.pricing.tshirt', { defaultValue: 'T-shirt {{amount}}', amount: formatCurrency(tshirtPrice) })
                  : t('dashboard.parent.uniform.pricing.tshirt_unset', { defaultValue: 'T-shirt —' })
                )} • {(shortsPrice > 0
                  ? t('dashboard.parent.uniform.pricing.shorts', { defaultValue: 'Shorts {{amount}}', amount: formatCurrency(shortsPrice) })
                  : t('dashboard.parent.uniform.pricing.shorts_unset', { defaultValue: 'Shorts —' })
                )}
              </Text>
              <Text style={styles.pricingText}>
                {t('dashboard.parent.uniform.order.sets', { defaultValue: '{{count}} set(s)', count: impliedSetQty })} •{' '}
                {t('dashboard.parent.uniform.order.extra_tshirts', { defaultValue: '{{count}} extra T-shirts', count: orderExtraTshirts })} •{' '}
                {t('dashboard.parent.uniform.order.extra_shorts', { defaultValue: '{{count}} extra shorts', count: orderExtraShorts })}
              </Text>
              <Text style={styles.pricingTotal}>
                {t('dashboard.parent.uniform.total.label', { defaultValue: 'Total:' })}{' '}
                {hasPricing
                  ? formatCurrency(totalAmount)
                  : t('dashboard.parent.uniform.total.unavailable', { defaultValue: 'Pricing not configured' })}
              </Text>
              {!hasPricing ? (
                <Text style={styles.pricingHint}>
                  {t('dashboard.parent.uniform.total.note', { defaultValue: 'Pricing is not set yet. We will still generate a payment reference.' })}
                </Text>
              ) : null}
            </View>

            <Text style={styles.sectionTitle}>
              {t('dashboard.parent.uniform.sections.notes', { defaultValue: 'Notes' })}
            </Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>
                {t('dashboard.parent.uniform.labels.sample_supplied', { defaultValue: 'Sample supplied?' })}
              </Text>
              <Switch
                value={entry.sampleSupplied}
                onValueChange={(value) => updateEntry(child.id, { sampleSupplied: value })}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={entry.sampleSupplied ? '#fff' : theme.textSecondary}
              />
            </View>
            <Text style={styles.helperText}>
              {t('dashboard.parent.uniform.helper.sample_supplied', { defaultValue: 'Turn this on if you sent a sample T-shirt for sizing.' })}
            </Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>
                {t('dashboard.parent.uniform.labels.returning_student', { defaultValue: 'Returning student?' })}
              </Text>
              <Switch
                value={entry.isReturning}
                onValueChange={(value) => updateEntry(child.id, { isReturning: value, tshirtNumber: value ? entry.tshirtNumber : '' })}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={entry.isReturning ? '#fff' : theme.textSecondary}
              />
            </View>
            <Text style={styles.helperText}>
              {t('dashboard.parent.uniform.helper.returning_student', { defaultValue: 'Turn this on if your child is returning and already has a back number.' })}
            </Text>

            {entry.isReturning ? (
              <>
                <Text style={styles.label}>
                  {t('dashboard.parent.uniform.labels.tshirt_number', { defaultValue: 'T-shirt Number' })}
                </Text>
                <TextInput
                  style={styles.input}
                  value={entry.tshirtNumber}
                  onChangeText={(text) => updateEntry(child.id, { tshirtNumber: text })}
                  placeholder={t('dashboard.parent.uniform.placeholders.tshirt_number', { defaultValue: 'e.g. 08' })}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Text style={styles.helperText}>
                  {t('dashboard.parent.uniform.helper.back_number', { defaultValue: 'Use the number that should appear on the back.' })}
                </Text>
              </>
            ) : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={() => saveEntry(child.id)}
                disabled={entry.status === 'saving'}
              >
                <Text style={styles.saveButtonText}>
                  {entry.status === 'saving'
                    ? t('dashboard.parent.uniform.status.saving', { defaultValue: 'Saving...' })
                    : t('dashboard.parent.uniform.actions.save', { defaultValue: 'Save' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.payButton,
                  { borderColor: theme.primary, opacity: canPayNow(entry) ? 1 : 0.5 },
                ]}
                onPress={() => handlePayNow(child, entry)}
                disabled={!canPayNow(entry)}
              >
                <Text style={[styles.payButtonText, { color: theme.primary }]}>
                  {t('dashboard.parent.uniform.actions.pay_now', { defaultValue: 'Pay Now' })}
                </Text>
              </TouchableOpacity>
              {entry.status === 'saved' && (
                <View style={styles.statusRow}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                  <Text style={[styles.statusText, { color: theme.success }]}>
                    {t('dashboard.parent.uniform.status.saved', { defaultValue: 'Saved' })}
                  </Text>
                </View>
              )}
              {entry.status === 'error' && (
                <View style={styles.statusRow}>
                  <Ionicons name="alert-circle" size={16} color={theme.error} />
                  <Text style={[styles.statusText, { color: theme.error }]}>{entry.message}</Text>
                </View>
              )}
            </View>

            {entry.updatedAt && (
              <Text style={styles.updatedText}>
                {t('dashboard.parent.uniform.last_updated', { defaultValue: 'Last updated:' })}{' '}
                {new Date(entry.updatedAt).toLocaleString('en-ZA')}
              </Text>
            )}
          </View>
        );
        })}
      </View>
      <AlertModal {...alertProps} />
    </>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  subtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  childName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.success + '20',
  },
  statusPillText: {
    color: theme.success,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  summaryLabel: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
  },
  editButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.primary + '15',
    cursor: 'pointer',
  },
  editButtonText: {
    color: theme.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
    marginTop: 4,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.text,
    backgroundColor: theme.elevated,
    marginBottom: 10,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: theme.elevated,
    marginBottom: 10,
  },
  picker: {
    color: theme.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    cursor: 'pointer',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  payButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    cursor: 'pointer',
  },
  payButtonText: {
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statusText: {
    fontSize: 12,
  },
  updatedText: {
    marginTop: 8,
    fontSize: 11,
    color: theme.textSecondary,
  },
  helperText: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: 10,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  setInput: {
    flex: 1,
  },
  matchButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    cursor: 'pointer',
  },
  matchButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pricingCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 10,
    marginBottom: 12,
    backgroundColor: theme.surface,
  },
  pricingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  pricingText: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: 2,
  },
  pricingTotal: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
    marginTop: 4,
  },
  pricingHint: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 6,
  },
  emptyText: {
    color: theme.textSecondary,
    textAlign: 'center',
  },
  mutedText: {
    color: theme.textSecondary,
    fontSize: 12,
  },
  errorText: {
    color: theme.error,
    fontSize: 12,
    marginBottom: 8,
  },
});
