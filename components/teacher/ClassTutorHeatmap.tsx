/**
 * ClassTutorHeatmap
 *
 * Grid-based heatmap showing per-student, per-subject accuracy for a class.
 * Cells are colored green→yellow→red based on accuracy percentage.
 * Tapping a cell triggers the onStudentPress callback for drilldown.
 *
 * ≤ 400 lines (WARP.md)
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { ClassTutorAnalytics, StudentHeatmapCell } from '@/hooks/useClassTutorAnalytics';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  analytics: ClassTutorAnalytics;
  onStudentPress?: (studentId: string, studentName: string) => void;
}

// ─── Color helpers ───────────────────────────────────────────────────────────

function accuracyColor(pct: number): string {
  if (pct >= 80) return '#22c55e'; // green-500
  if (pct >= 60) return '#84cc16'; // lime-500
  if (pct >= 40) return '#eab308'; // yellow-500
  if (pct >= 20) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

function accuracyBgColor(pct: number): string {
  if (pct >= 80) return '#dcfce7'; // green-100
  if (pct >= 60) return '#ecfccb'; // lime-100
  if (pct >= 40) return '#fef9c3'; // yellow-100
  if (pct >= 20) return '#ffedd5'; // orange-100
  return '#fee2e2'; // red-100
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const HeatmapCell = React.memo(function HeatmapCell({
  accuracy,
  attempts,
  onPress,
}: {
  accuracy: number | null;
  attempts: number;
  onPress?: () => void;
}) {
  if (accuracy === null || attempts === 0) {
    return (
      <View style={[styles.cell, styles.emptyCell]}>
        <Text style={styles.emptyCellText}>—</Text>
      </View>
    );
  }

  const bg = accuracyBgColor(accuracy);
  const fg = accuracyColor(accuracy);

  return (
    <TouchableOpacity
      style={[styles.cell, { backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.cellPct, { color: fg }]}>{Math.round(accuracy)}%</Text>
      <Text style={styles.cellAttempts}>{attempts}</Text>
    </TouchableOpacity>
  );
});

const ClassSummaryBar = React.memo(function ClassSummaryBar({
  analytics,
}: {
  analytics: ClassTutorAnalytics;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.summaryBar, { backgroundColor: theme.colors.cardBackground }]}>
      <SummaryItem label="Students" value={String(analytics.totalStudentsWithData)} />
      <SummaryItem label="Subjects" value={String(analytics.subjects.length)} />
      <SummaryItem
        label="Class Avg"
        value={`${analytics.classAccuracy}%`}
        valueColor={accuracyColor(analytics.classAccuracy)}
      />
    </View>
  );
});

const SummaryItem = React.memo(function SummaryItem({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
});

// ─── Legend ───────────────────────────────────────────────────────────────────

const Legend = React.memo(function Legend() {
  const bands = [
    { label: '80%+', color: '#22c55e' },
    { label: '60-79', color: '#84cc16' },
    { label: '40-59', color: '#eab308' },
    { label: '20-39', color: '#f97316' },
    { label: '<20%', color: '#ef4444' },
  ];
  return (
    <View style={styles.legend}>
      {bands.map((b) => (
        <View key={b.label} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: b.color }]} />
          <Text style={styles.legendText}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ClassTutorHeatmap({ analytics, onStudentPress }: Props) {
  const { theme } = useTheme();
  const { heatmap, subjects } = analytics;

  // Truncate subject names for column headers
  const shortSubjects = useMemo(
    () => subjects.map((s) => (s.length > 10 ? s.slice(0, 9) + '…' : s)),
    [subjects],
  );

  if (heatmap.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.cardBackground }]}>
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          No tutor activity data yet for this class.
        </Text>
        <Text style={[styles.emptyHint, { color: theme.colors.onSurfaceVariant }]}>
          Students need to use Dash Tutor to generate analytics.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <ClassSummaryBar analytics={analytics} />
      <Legend />
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {/* Header row */}
          <View style={styles.row}>
            <View style={styles.nameCell}>
              <Text style={[styles.headerText, { color: theme.colors.text }]}>Student</Text>
            </View>
            {shortSubjects.map((subj, i) => (
              <View key={subjects[i]} style={styles.cell}>
                <Text
                  style={[styles.headerText, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {subj}
                </Text>
              </View>
            ))}
            <View style={styles.cell}>
              <Text style={[styles.headerText, { color: theme.colors.text }]}>Avg</Text>
            </View>
          </View>

          {/* Data rows */}
          {heatmap.map((student) => (
            <StudentRow
              key={student.studentId}
              student={student}
              subjects={subjects}
              onPress={onStudentPress}
              textColor={theme.colors.text}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

const StudentRow = React.memo(function StudentRow({
  student,
  subjects,
  onPress,
  textColor,
}: {
  student: StudentHeatmapCell;
  subjects: string[];
  onPress?: (id: string, name: string) => void;
  textColor: string;
}) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.nameCell}
        onPress={() => onPress?.(student.studentId, student.studentName)}
        activeOpacity={0.7}
      >
        <Text style={[styles.nameText, { color: textColor }]} numberOfLines={1}>
          {student.studentName}
        </Text>
        <Text style={styles.attemptsLabel}>{student.totalAttempts} attempts</Text>
      </TouchableOpacity>

      {subjects.map((subj) => {
        const cell = student.subjects[subj];
        return (
          <HeatmapCell
            key={subj}
            accuracy={cell ? cell.accuracy : null}
            attempts={cell ? cell.attempts : 0}
            onPress={() => onPress?.(student.studentId, student.studentName)}
          />
        );
      })}

      {/* Overall average */}
      <HeatmapCell
        accuracy={student.overallAccuracy}
        attempts={student.totalAttempts}
        onPress={() => onPress?.(student.studentId, student.studentName)}
      />
    </View>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const CELL_WIDTH = 72;
const NAME_WIDTH = 120;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  nameCell: {
    width: NAME_WIDTH,
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  attemptsLabel: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 1,
  },
  cell: {
    width: CELL_WIDTH,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#e5e7eb',
  },
  emptyCell: {
    backgroundColor: '#f9fafb',
  },
  emptyCellText: {
    color: '#d1d5db',
    fontSize: 14,
  },
  cellPct: {
    fontSize: 14,
    fontWeight: '700',
  },
  cellAttempts: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 1,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: '#6b7280',
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
});
