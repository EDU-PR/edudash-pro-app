import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { UniformRegisterSummary } from '@/hooks/useUniformRegister';

interface Props {
  summary: UniformRegisterSummary;
}

const CARDS: { key: keyof UniformRegisterSummary; label: string; color: string; prefix?: string }[] = [
  { key: 'total_students', label: 'Total Students', color: '#1e40af' },
  { key: 'forms_filled', label: 'Forms Filled', color: '#059669' },
  { key: 'forms_pending', label: 'Forms Pending', color: '#d97706' },
  { key: 'total_paid', label: 'Fully Paid', color: '#16a34a' },
  { key: 'total_partial', label: 'Partial', color: '#f59e0b' },
  { key: 'total_unpaid', label: 'Unpaid', color: '#dc2626' },
  { key: 'total_revenue', label: 'Collected', color: '#059669', prefix: 'R' },
  { key: 'total_outstanding', label: 'Outstanding', color: '#dc2626', prefix: 'R' },
];

export default function UniformSummaryCards({ summary }: Props) {
  return (
    <View style={styles.grid}>
      {CARDS.map((c) => {
        const val = summary[c.key];
        const display = c.prefix ? `${c.prefix}${Number(val).toFixed(2)}` : String(val);
        return (
          <View key={c.key} style={[styles.card, { borderLeftColor: c.color }]}>
            <Text style={[styles.value, { color: c.color }]}>{display}</Text>
            <Text style={styles.label}>{c.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12,
    borderLeftWidth: 4, minWidth: '47%', flex: 1,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  value: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
