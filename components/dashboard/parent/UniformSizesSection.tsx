import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';

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
  isReturning: boolean;
  tshirtNumber: string;
  sampleSupplied: boolean;
  status: EntryStatus;
  message?: string | null;
  updatedAt?: string | null;
}

interface ChildRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
}

interface UniformSizesSectionProps {
  children: ChildRow[];
}

const getAgeYears = (dob?: string | null): string => {
  if (!dob) return '';
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return '';
  const age = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  return age > 0 ? String(age) : '';
};

export const UniformSizesSection: React.FC<UniformSizesSectionProps> = ({ children }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [entries, setEntries] = useState<Record<string, UniformEntry>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        isReturning: false,
        tshirtNumber: '',
        sampleSupplied: false,
        status: 'idle',
        message: null,
        updatedAt: null,
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
          .select('student_id, child_name, age_years, tshirt_size, is_returning, tshirt_number, sample_supplied, updated_at')
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
                isReturning,
                tshirtNumber: isReturning ? row.tshirt_number || next[row.student_id]?.tshirtNumber || '' : '',
                sampleSupplied,
                status: 'saved',
                message: 'Saved',
                updatedAt: row.updated_at || null,
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

  const updateEntry = (childId: string, patch: Partial<UniformEntry>) => {
    setEntries((prev) => ({
      ...prev,
      [childId]: { ...prev[childId], ...patch, status: 'idle', message: null },
    }));
  };

  const saveEntry = async (childId: string) => {
    const entry = entries[childId];
    if (!entry) return;

    const childName = entry.childName.trim();
    const ageValue = parseInt(entry.ageYears, 10);
    const tshirtNumber = entry.tshirtNumber.trim();

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
        },
      }));
    } catch (error: any) {
      setEntries((prev) => ({
        ...prev,
        [childId]: { ...prev[childId], status: 'error', message: error?.message || 'Save failed' },
      }));
    }
  };

  if (!children.length) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <Text style={styles.emptyText}>Add a child to submit uniform sizes.</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Uniform Sizes</Text>
        <Text style={styles.subtitle}>T-shirt size will also be used for shorts. Add a returning number if needed.</Text>
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
