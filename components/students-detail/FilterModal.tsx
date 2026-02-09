/**
 * Filter Modal for students-detail screen.
 */

import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FilterOptions } from '@/lib/screen-data/students-detail.types';

const GRADE_OPTIONS = ['Grade R-A', 'Grade R-B', 'Grade 1-A', 'Grade 1-B', 'Grade 2-A'];
const STATUS_OPTIONS = ['active', 'inactive', 'pending'];

interface Props {
  visible: boolean;
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onClose: () => void;
  theme: any;
}

export function FilterModal({ visible, filters, onFiltersChange, onClose, theme }: Props) {
  const styles = createLocalStyles(theme);

  const toggleFilter = (key: 'grade' | 'status', value: string) => {
    const current = filters[key];
    onFiltersChange({
      ...filters,
      [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Filter Students</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Grade</Text>
            <View style={styles.options}>
              {GRADE_OPTIONS.map((grade) => (
                <TouchableOpacity
                  key={grade}
                  style={[styles.option, filters.grade.includes(grade) && styles.optionSelected]}
                  onPress={() => toggleFilter('grade', grade)}
                >
                  <Text style={[styles.optionText, filters.grade.includes(grade) && styles.optionTextSelected]}>
                    {grade}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.options}>
              {STATUS_OPTIONS.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.option, filters.status.includes(status) && styles.optionSelected]}
                  onPress={() => toggleFilter('status', status)}
                >
                  <Text style={[styles.optionText, filters.status.includes(status) && styles.optionTextSelected]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => onFiltersChange({ grade: [], status: ['active'], teacher: [], paymentStatus: [], search: '' })}
            >
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={onClose}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createLocalStyles = (theme: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: theme.colors.surface || '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  optionSelected: { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary },
  optionText: { fontSize: 13, color: theme.colors.text },
  optionTextSelected: { color: theme.colors.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  clearBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#f1f5f9' },
  clearBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  applyBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: theme.colors.primary },
  applyBtnText: { fontSize: 14, fontWeight: '600', color: 'white' },
});
