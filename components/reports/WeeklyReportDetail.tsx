/**
 * Weekly Report Detail Component
 * 
 * Displays the full weekly learning report with all sections.
 * Features:
 * - Highlights and achievements
 * - Focus areas for improvement
 * - Attendance summary
 * - Progress metrics with visual indicators
 * - Home activities
 * - Activity breakdown chart
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressChart } from './ProgressChart';
import { HomeActivityCard } from './HomeActivityCard';

interface WeeklyReportDetailProps {
  report: {
    report_data: {
      highlights: string[];
      focusAreas: string[];
      attendanceSummary: {
        daysPresent: number;
        daysAbsent: number;
        totalDays: number;
        attendanceRate: number;
      };
      homeworkCompletion: number;
      teacherNotes: string[];
      homeActivities: string[];
      moodSummary: string;
      progressMetrics: {
        socialSkills: number;
        academicProgress: number;
        participation: number;
        behavior: number;
      };
      activityBreakdown: Record<string, number>;
    };
  };
  studentName: string;
  theme: any;
}

export function WeeklyReportDetail({ report, studentName, theme }: WeeklyReportDetailProps) {
  const data = report.report_data;

  return (
    <View>
      {/* Summary Card */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="star" size={24} color="#F59E0B" />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Weekly Summary</Text>
        </View>
        <Text style={[styles.moodText, { color: theme.textSecondary }]}>
          {data.moodSummary}
        </Text>
      </View>

      {/* Highlights */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="trophy" size={24} color="#10B981" />
          <Text style={[styles.cardTitle, { color: theme.text }]}>✨ Highlights & Achievements</Text>
        </View>
        {data.highlights.map((highlight, index) => (
          <View key={index} style={styles.listItem}>
            <View style={[styles.bulletPoint, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.listText, { color: theme.textSecondary }]}>
              {highlight}
            </Text>
          </View>
        ))}
      </View>

      {/* Focus Areas */}
      {data.focusAreas.length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="bulb" size={24} color="#F59E0B" />
            <Text style={[styles.cardTitle, { color: theme.text }]}>💡 Areas to Focus On</Text>
          </View>
          {data.focusAreas.map((area, index) => (
            <View key={index} style={styles.listItem}>
              <View style={[styles.bulletPoint, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.listText, { color: theme.textSecondary }]}>
                {area}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Attendance Summary */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="calendar" size={24} color="#3B82F6" />
          <Text style={[styles.cardTitle, { color: theme.text }]}>📅 Attendance</Text>
        </View>
        <View style={styles.attendanceGrid}>
          <View style={styles.attendanceStat}>
            <Text style={[styles.statNumber, { color: theme.success }]}>
              {data.attendanceSummary.daysPresent}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Days Present
            </Text>
          </View>
          <View style={styles.attendanceStat}>
            <Text style={[styles.statNumber, { color: theme.danger }]}>
              {data.attendanceSummary.daysAbsent}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Days Absent
            </Text>
          </View>
          <View style={styles.attendanceStat}>
            <Text style={[styles.statNumber, { color: theme.primary }]}>
              {data.attendanceSummary.attendanceRate}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Attendance Rate
            </Text>
          </View>
        </View>
      </View>

      {/* Progress Metrics */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="bar-chart" size={24} color="#8B5CF6" />
          <Text style={[styles.cardTitle, { color: theme.text }]}>📊 Progress Metrics</Text>
        </View>
        <ProgressChart metrics={data.progressMetrics} theme={theme} />
      </View>

      {/* Activity Breakdown */}
      {Object.keys(data.activityBreakdown).length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="pie-chart" size={24} color="#EC4899" />
            <Text style={[styles.cardTitle, { color: theme.text }]}>🎨 Activity Breakdown</Text>
          </View>
          <View style={styles.activityGrid}>
            {Object.entries(data.activityBreakdown).map(([activity, count]) => (
              <View key={activity} style={[styles.activityItem, { backgroundColor: theme.cardSecondary }]}>
                <Text style={[styles.activityCount, { color: theme.primary }]}>
                  {count}
                </Text>
                <Text style={[styles.activityLabel, { color: theme.textSecondary }]}>
                  {activity}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Home Activities */}
      {data.homeActivities.length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="home" size={24} color="#06B6D4" />
            <Text style={[styles.cardTitle, { color: theme.text }]}>🏠 Try These at Home</Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            Fun activities to reinforce learning at home
          </Text>
          {data.homeActivities.map((activity, index) => (
            <HomeActivityCard
              key={index}
              activity={activity}
              index={index}
              theme={theme}
            />
          ))}
        </View>
      )}

      {/* Teacher Notes */}
      {data.teacherNotes.length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="chatbox" size={24} color="#6366F1" />
            <Text style={[styles.cardTitle, { color: theme.text }]}>💬 Teacher Notes</Text>
          </View>
          {data.teacherNotes.map((note, index) => (
            <View key={index} style={[styles.noteCard, { backgroundColor: theme.cardSecondary }]}>
              <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                "{note}"
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  moodText: {
    fontSize: 16,
    lineHeight: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  bulletPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  attendanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  attendanceStat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  activityItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  activityCount: {
    fontSize: 24,
    fontWeight: '700',
  },
  activityLabel: {
    fontSize: 13,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  noteCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
