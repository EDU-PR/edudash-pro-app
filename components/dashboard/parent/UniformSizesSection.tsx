import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { getUniformItemType, isUniformFee } from '@/lib/utils/feeUtils';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';

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

const getAgeYears = (dob?: string | null): string => {
  if (!dob) return '';
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return '';
  const age = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  return age > 0 ? String(age) : '';
};

export const UniformSizesSection: React.FC<UniformSizesSectionProps> = ({ children, schoolName }) => {
  const { theme } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, alertProps } = useAlertModal();
  const [entries, setEntries] = useState<Record<string, UniformEntry>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uniformPricing, setUniformPricing] = useState<Record<string, { tshirtAmount?: number; shortsAmount?: number; fallbackAmount?: number }>>({});

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

        if (data) {
          setEntries((prev) => {
            const next = { ...prev };
            data.forEach((row: any) => {
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
                message: 'Saved',
                updatedAt: row.updated_at || null,
                isEditing: false,
              };
            });
            return next;
          });
        }
      } catch (error: any) {
        setLoadError(error?.message || 'Unable to load uniform sizes.');
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
        const pricingMap: Record<string, { tshirtAmount?: number; shortsAmount?: number; fallbackAmount?: number }> = {};

        for (const preschoolId of preschoolIds) {
          const pricing: { tshirtAmount?: number; shortsAmount?: number; fallbackAmount?: number } = {};

          const applyFee = (
            amount: number,
            feeType?: string | null,
            name?: string | null,
            description?: string | null
          ) => {
            if (!Number.isFinite(amount)) return;
            const itemType = getUniformItemType(feeType, name, description);
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
      } catch (error) {
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
      updateEntry(childId, { status: 'error', message: 'Please enter the child name.' });
      return;
    }
    if (!entry.tshirtSize) {
      updateEntry(childId, { status: 'error', message: 'Select a T-shirt size.' });
      return;
    }
    if (!Number.isFinite(ageValue) || ageValue < 1 || ageValue > 18) {
      updateEntry(childId, { status: 'error', message: 'Enter a valid age (1-18).' });
      return;
    }
    if (entry.isReturning && !tshirtNumber) {
      updateEntry(childId, { status: 'error', message: 'Enter the returning T-shirt number.' });
      return;
    }
    if (entry.isReturning && tshirtNumber && !/^\d{1,6}$/.test(tshirtNumber)) {
      updateEntry(childId, { status: 'error', message: 'T-shirt number must be 1-6 digits.' });
      return;
    }
    if (!Number.isFinite(tshirtQty) || tshirtQty < 1 || tshirtQty > 20) {
      updateEntry(childId, { status: 'error', message: 'Enter a valid number of T-shirts (1-20).' });
      return;
    }
    if (!Number.isFinite(shortsQty) || shortsQty < 0 || shortsQty > 20) {
      updateEntry(childId, { status: 'error', message: 'Enter a valid number of shorts (0-20).' });
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
          message: 'Saved',
          updatedAt: data?.updated_at || new Date().toISOString(),
          isEditing: false,
        },
      }));
    } catch (error: any) {
      setEntries((prev) => ({
        ...prev,
        [childId]: { ...prev[childId], status: 'error', message: error?.message || 'Save failed' },
      }));
    }
  };

  const handlePayNow = (child: ChildRow, entry: UniformEntry) => {
    const preschoolId = child.preschoolId || null;
    if (!preschoolId) {
      showAlert({
        title: 'School not found',
        message: 'We could not find the school for this child.',
        type: 'error',
      });
      return;
    }

    if (!entry.tshirtSize) {
      showAlert({
        title: 'Missing size',
        message: 'Please select a T-shirt size before paying.',
        type: 'warning',
      });
      return;
    }

    const tshirtQty = parseInt(entry.tshirtQuantity, 10);
    const shortsQty = parseInt(entry.shortsQuantity, 10);
    const totalItems = (Number.isFinite(tshirtQty) ? tshirtQty : 0) + (Number.isFinite(shortsQty) ? shortsQty : 0);

    if (!totalItems || totalItems <= 0) {
      showAlert({
        title: 'Missing quantities',
        message: 'Enter the number of T-shirts and shorts before paying.',
        type: 'warning',
      });
      return;
    }

    const pricing = uniformPricing[preschoolId];
    const tshirtPrice = pricing?.tshirtAmount ?? pricing?.fallbackAmount ?? 0;
    const shortsPrice = pricing?.shortsAmount ?? pricing?.fallbackAmount ?? 0;
    const totalAmount = (tshirtPrice * tshirtQty) + (shortsPrice * shortsQty);

    if (!pricing || (tshirtPrice <= 0 && shortsPrice <= 0)) {
      showAlert({
        title: 'Uniform pricing not set',
        message: 'Uniform pricing is not configured yet. We will still generate a reference for you.',
        type: 'warning',
      });
    } else if ((tshirtQty > 0 && tshirtPrice <= 0) || (shortsQty > 0 && shortsPrice <= 0)) {
      showAlert({
        title: 'Uniform pricing incomplete',
        message: 'Some uniform items do not have a price yet. We will still generate a reference for you.',
        type: 'warning',
      });
    }

    const descriptionParts = [
      'Uniform order',
      entry.tshirtSize ? `Size ${entry.tshirtSize}` : null,
      `T-shirts ${tshirtQty}`,
      `Shorts ${shortsQty}`,
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
          <Text style={styles.emptyText}>Add a child to submit uniform sizes.</Text>
        </View>
        <AlertModal {...alertProps} />
      </>
    );
  }

  return (
    <>
      <View>
        <View style={styles.header}>
          <Text style={styles.title}>Uniform Sizes</Text>
          <Text style={styles.subtitle}>Select sizes, quantities, and add a returning number if needed.</Text>
        </View>

        {loading && (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.mutedText}>Loading existing submissions...</Text>
          </View>
        )}
        {loadError && <Text style={styles.errorText}>{loadError}</Text>}

        {children.map((child) => {
          const entry = entries[child.id];
          if (!entry) return null;

          if (entry.status === 'saved' && !entry.isEditing) {
            return (
              <View key={child.id} style={[styles.card, { backgroundColor: theme.surface }]}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.childName}>{child.firstName} {child.lastName}</Text>
                  <View style={styles.statusPill}>
                    <Ionicons name="checkmark-circle" size={14} color={theme.success} />
                    <Text style={styles.statusPillText}>Confirmed</Text>
                  </View>
                </View>
                <Text style={styles.summaryText}>
                  Size: {entry.tshirtSize || '—'} • T-shirts: {entry.tshirtQuantity} • Shorts: {entry.shortsQuantity}
                </Text>
                {entry.isReturning && entry.tshirtNumber ? (
                  <Text style={styles.summaryText}>Back number: {entry.tshirtNumber}</Text>
                ) : null}
                {entry.updatedAt ? (
                  <Text style={styles.updatedText}>Last updated: {new Date(entry.updatedAt).toLocaleString('en-ZA')}</Text>
                ) : null}
                <TouchableOpacity style={styles.editButton} onPress={() => setEditing(child.id, true)}>
                  <Text style={styles.editButtonText}>Edit Order</Text>
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <View key={child.id} style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={styles.childName}>{child.firstName} {child.lastName}</Text>

            <Text style={styles.label}>Child Name</Text>
            <TextInput
              style={styles.input}
              value={entry.childName}
              onChangeText={(text) => updateEntry(child.id, { childName: text })}
              placeholder="Child name"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={styles.label}>Age (years)</Text>
            <TextInput
              style={styles.input}
              value={entry.ageYears}
              onChangeText={(text) => updateEntry(child.id, { ageYears: text })}
              placeholder="Age"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>T-shirt Size</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={entry.tshirtSize}
                onValueChange={(value) => updateEntry(child.id, { tshirtSize: value })}
                style={styles.picker}
              >
                <Picker.Item label="Select size" value="" />
                {SIZE_OPTIONS.map((size) => (
                  <Picker.Item key={size} label={size} value={size} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Number of T-shirts</Text>
            <TextInput
              style={styles.input}
              value={entry.tshirtQuantity}
              onChangeText={(text) => updateEntry(child.id, { tshirtQuantity: text })}
              placeholder="e.g. 1"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={2}
            />

            <Text style={styles.label}>Number of Shorts</Text>
            <TextInput
              style={styles.input}
              value={entry.shortsQuantity}
              onChangeText={(text) => updateEntry(child.id, { shortsQuantity: text })}
              placeholder="e.g. 1"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={2}
            />

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Sample supplied?</Text>
              <Switch
                value={entry.sampleSupplied}
                onValueChange={(value) => updateEntry(child.id, { sampleSupplied: value })}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={entry.sampleSupplied ? '#fff' : theme.textSecondary}
              />
            </View>
            <Text style={styles.helperText}>Turn this on if you sent a sample T-shirt for sizing.</Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Returning student?</Text>
              <Switch
                value={entry.isReturning}
                onValueChange={(value) => updateEntry(child.id, { isReturning: value, tshirtNumber: value ? entry.tshirtNumber : '' })}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={entry.isReturning ? '#fff' : theme.textSecondary}
              />
            </View>
            <Text style={styles.helperText}>Turn this on if your child is returning and already has a back number.</Text>

            {entry.isReturning ? (
              <>
                <Text style={styles.label}>T-shirt Number</Text>
                <TextInput
                  style={styles.input}
                  value={entry.tshirtNumber}
                  onChangeText={(text) => updateEntry(child.id, { tshirtNumber: text })}
                  placeholder="e.g. 08"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Text style={styles.helperText}>Use the number that should appear on the back.</Text>
              </>
            ) : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={() => saveEntry(child.id)}
                disabled={entry.status === 'saving'}
              >
                <Text style={styles.saveButtonText}>
                  {entry.status === 'saving' ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.payButton, { borderColor: theme.primary }]}
                onPress={() => handlePayNow(child, entry)}
              >
                <Text style={[styles.payButtonText, { color: theme.primary }]}>Pay Now</Text>
              </TouchableOpacity>
              {entry.status === 'saved' && (
                <View style={styles.statusRow}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                  <Text style={[styles.statusText, { color: theme.success }]}>Saved</Text>
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
                Last updated: {new Date(entry.updatedAt).toLocaleString('en-ZA')}
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

const createStyles = (theme: any) => StyleSheet.create({
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
    marginBottom: 10,
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
  editButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.primary + '15',
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
