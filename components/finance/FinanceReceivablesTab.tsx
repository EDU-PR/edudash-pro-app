import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { formatCurrency, pickSectionError } from '@/hooks/useFinanceControlCenter';
import type { FinanceControlCenterBundle } from '@/types/finance';

interface FinanceReceivablesTabProps {
  bundle: FinanceControlCenterBundle | null;
  receivables: FinanceControlCenterBundle['receivables'] | null;
  monthIso: string;
  theme: any;
  styles: any;
  renderSectionError: (message: string | null) => React.ReactNode;
}

export function FinanceReceivablesTab({
  bundle,
  receivables,
  monthIso,
  theme,
  styles,
  renderSectionError,
}: FinanceReceivablesTabProps) {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Receivables</Text>
      {renderSectionError(pickSectionError(bundle?.errors, 'receivables'))}
      {!!receivables && (
        (() => {
          const excludedInactive = Number(receivables.summary?.excluded_inactive_students || 0);
          const excludedFuture = Number(receivables.summary?.excluded_future_enrollment_students || 0);
          const excludedUnverified = Number(receivables.summary?.excluded_unverified_students || 0);
          const totalExcluded = excludedInactive + excludedFuture + excludedUnverified;
          if (totalExcluded <= 0) return null;
          return (
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>
                Excluded from receivables: {excludedFuture} not started yet, {excludedUnverified} unverified new registrations, {excludedInactive} inactive.
              </Text>
            </View>
          );
        })()
      )}
      {!receivables || receivables.students.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No pending or overdue receivables for this month.</Text>
        </View>
      ) : (
        receivables.students.map((row) => {
          const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Student';
          return (
            <TouchableOpacity
              key={row.student_id}
              style={styles.queueCard}
              onPress={() => router.push(
                `/screens/principal-student-fees?studentId=${row.student_id}&monthIso=${monthIso}&source=receivables` as any
              )}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.queueTitle}>{fullName}</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(row.outstanding_amount)}</Text>
              </View>
              <View style={styles.badgeRow}>
                {row.pending_count > 0 && (
                  <View style={[styles.statusBadge, { backgroundColor: (theme.warning || '#F59E0B') + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: theme.warning || '#F59E0B' }]}>
                      {row.pending_count} pending
                    </Text>
                  </View>
                )}
                {row.overdue_count > 0 && (
                  <View style={[styles.statusBadge, { backgroundColor: theme.error + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: theme.error }]}>
                      {row.overdue_count} overdue
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}
