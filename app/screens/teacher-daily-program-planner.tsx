import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTeacherDashboard } from '@/hooks/useDashboardData';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

const formatRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return 'Time not set';
  if (start && end) return `${start} - ${end}`;
  return start || end || 'Time not set';
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export default function TeacherDailyProgramPlannerScreen() {
  const { theme } = useTheme();
  const { data, loading, refresh } = useTeacherDashboard();
  const routine = data?.todayRoutine || null;
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Daily Routine</Text>
          <Text style={styles.headerSubtitle}>Teacher view only: routine is managed by principal/admin.</Text>
        </View>
      </View>

      {loading && !routine ? (
        <View style={styles.loadingWrap}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading today's routine...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {routine ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{routine.title || 'Published school routine'}</Text>
                <Text style={styles.cardMeta}>
                  {formatDate(routine.weekStartDate)} - {formatDate(routine.weekEndDate)} • {routine.blockCount} blocks
                </Text>
                {routine.nextBlockTitle ? (
                  <View style={styles.nextBlockPill}>
                    <Ionicons name="time-outline" size={14} color="#fff" />
                    <Text style={styles.nextBlockText}>
                      Next: {routine.nextBlockTitle}
                      {routine.nextBlockStart ? ` at ${routine.nextBlockStart}` : ''}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.blockListCard}>
                <Text style={styles.sectionTitle}>Today's blocks</Text>
                {routine.blocks.map((block, index) => (
                  <View key={block.id} style={styles.blockRow}>
                    <View style={styles.blockIndex}>
                      <Text style={styles.blockIndexText}>{index + 1}</Text>
                    </View>
                    <View style={styles.blockBody}>
                      <Text style={styles.blockTitle}>{block.title}</Text>
                      <Text style={styles.blockMeta}>
                        {formatRange(block.startTime, block.endTime)} • {block.blockType}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No published routine yet</Text>
              <Text style={styles.cardMeta}>
                Ask your principal/admin to publish the daily routine. It will appear here automatically.
              </Text>
            </View>
          )}

          <View style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Lesson tools</Text>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/screens/teacher-lessons')}>
              <Ionicons name="book-outline" size={18} color="#fff" />
              <Text style={styles.actionText}>Open lesson plans</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/screens/assign-lesson')}>
              <Ionicons name="link-outline" size={18} color="#fff" />
              <Text style={styles.actionText}>Assign lessons to today's blocks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/screens/room-display-connect')}>
              <Ionicons name="tv-outline" size={18} color={theme.text} />
              <Text style={styles.secondaryText}>Open Room Display link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.refreshButton} onPress={refresh}>
              <Ionicons name="refresh-outline" size={16} color={theme.primary} />
              <Text style={styles.refreshText}>Refresh routine</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTextWrap: {
      flex: 1,
    },
    headerTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '800',
    },
    headerSubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      marginTop: 3,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    scrollContent: {
      padding: 16,
      gap: 14,
      paddingBottom: 36,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 8,
    },
    cardTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
    },
    cardMeta: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    nextBlockPill: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.primary,
      borderRadius: 999,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    nextBlockText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    blockListCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 10,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    blockRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 10,
      backgroundColor: theme.background,
    },
    blockIndex: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
    },
    blockIndexText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
    },
    blockBody: {
      flex: 1,
      gap: 2,
    },
    blockTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    blockMeta: {
      color: theme.textSecondary,
      fontSize: 12,
      textTransform: 'capitalize',
    },
    actionsCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 10,
    },
    actionButton: {
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: theme.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
    },
    actionText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    secondaryButton: {
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
    },
    secondaryText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    refreshButton: {
      marginTop: 4,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    refreshText: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: '700',
    },
  });
