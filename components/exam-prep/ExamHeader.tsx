/**
 * ExamHeader Component
 *
 * Displays exam title, marks, CAPS badge, elapsed timer,
 * and question-progress dots.
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ExamHeaderProps {
  title: string;
  currentIndex: number;
  totalQuestions: number;
  totalMarks: number;
  earnedMarks: number;
  hasAnswered: boolean;
  answeredSet: Set<number>;
  startedAt: string;
  onExit: () => void;
  theme: Record<string, string>;
}

export function ExamHeader({
  title,
  currentIndex,
  totalQuestions,
  totalMarks,
  earnedMarks,
  hasAnswered,
  answeredSet,
  startedAt,
  onExit,
  theme,
}: ExamHeaderProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt]);

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const seconds = String(elapsed % 60).padStart(2, '0');

  return (
    <View style={[styles.header, { backgroundColor: theme.surface }]}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onExit} style={styles.exitButton}>
          <Ionicons name="close" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.examTitle, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.subtitleRow}>
            <Text style={[styles.examSubtitle, { color: theme.textSecondary }]}>
              Question {currentIndex + 1} of {totalQuestions}
            </Text>
            <View style={[styles.capsBadge, { backgroundColor: theme.primary + '18' }]}>
              <Ionicons name="ribbon" size={10} color={theme.primary} />
              <Text style={[styles.capsBadgeText, { color: theme.primary }]}>CAPS</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Text style={[styles.marksText, { color: theme.textSecondary }]}>
            {hasAnswered ? `${earnedMarks}/${totalMarks}` : `${totalMarks} marks`}
          </Text>
          <View style={styles.timerRow}>
            <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
            <Text style={[styles.timerText, { color: theme.textSecondary }]}>
              {minutes}:{seconds}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress dots */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dotsContainer}
      >
        {Array.from({ length: totalQuestions }, (_, i) => {
          const isAnswered = answeredSet.has(i);
          const isCurrent = i === currentIndex;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: isAnswered
                    ? theme.primary
                    : isCurrent
                    ? theme.primary + '50'
                    : theme.border,
                },
                isCurrent && styles.dotCurrent,
              ]}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exitButton: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  examTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  examSubtitle: {
    fontSize: 13,
  },
  capsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  capsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  marksText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotCurrent: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
