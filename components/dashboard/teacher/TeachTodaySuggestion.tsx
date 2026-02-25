/**
 * TeachTodaySuggestion — "What to Teach Today" AI suggestion card
 *
 * Sits between the Daily Program card and the Metrics section on the
 * teacher dashboard.  Shows contextual AI-generated prompts based on
 * whether the teacher already has a routine/theme for today.
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { track } from '@/lib/analytics';

export interface TeachTodaySuggestionProps {
  todayRoutine?: {
    title?: string;
    nextBlockTitle?: string;
    weekStartDate?: string;
    termId?: string;
    themeId?: string;
    themeName?: string;
  } | null;
  classNames?: string[];
  onOpenTutor: () => void;
  onOpenPlanner: () => void;
}

interface SuggestionChip {
  label: string;
  prompt: string;
}

export function TeachTodaySuggestion({
  todayRoutine,
  classNames,
  onOpenTutor,
  onOpenPlanner,
}: TeachTodaySuggestionProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const hasRoutine = !!todayRoutine;
  const themeName = todayRoutine?.themeName || todayRoutine?.title;

  const chips: SuggestionChip[] = useMemo(() => {
    if (hasRoutine && themeName) {
      return [
        {
          label: `📖 ${t('teacher.suggestion_continue_theme', { defaultValue: 'Continue {{theme}}', theme: themeName })}`,
          prompt: t('teacher.suggestion_continue_prompt', {
            defaultValue: 'Help me continue teaching the theme "{{theme}}" to my class today.',
            theme: themeName,
          }),
        },
        {
          label: `✏️ ${t('teacher.suggestion_worksheet', { defaultValue: 'Create worksheet' })}`,
          prompt: t('teacher.suggestion_worksheet_prompt', {
            defaultValue: 'Create a worksheet for the theme "{{theme}}".',
            theme: themeName,
          }),
        },
        {
          label: `📊 ${t('teacher.suggestion_check_understanding', { defaultValue: 'Check understanding' })}`,
          prompt: t('teacher.suggestion_check_prompt', {
            defaultValue: 'Create a quick comprehension check for the theme "{{theme}}".',
            theme: themeName,
          }),
        },
      ];
    }

    return [
      {
        label: `🚀 ${t('teacher.suggestion_generate_plan', { defaultValue: 'Generate lesson plan' })}`,
        prompt: t('teacher.suggestion_generate_prompt', {
          defaultValue: 'Generate a lesson plan for my class today.',
        }),
      },
      {
        label: `📝 ${t('teacher.suggestion_quick_activity', { defaultValue: 'Quick activity' })}`,
        prompt: t('teacher.suggestion_activity_prompt', {
          defaultValue: 'Suggest a quick 10-minute classroom activity for today.',
        }),
      },
      {
        label: `🎯 ${t('teacher.suggestion_learning_goals', { defaultValue: 'Set learning goals' })}`,
        prompt: t('teacher.suggestion_goals_prompt', {
          defaultValue: 'Help me set clear learning goals for this week.',
        }),
      },
    ];
  }, [hasRoutine, themeName, t]);

  const handleChipPress = useCallback(
    (chip: SuggestionChip) => {
      track('teacher.dashboard.teach_today_chip', {
        chip_label: chip.label,
        has_routine: hasRoutine,
      });
      router.push({
        pathname: '/screens/dash-assistant',
        params: { initialMessage: chip.prompt },
      } as never);
    },
    [hasRoutine],
  );

  const classContext =
    classNames && classNames.length > 0
      ? classNames.slice(0, 2).join(', ')
      : null;

  const styles = getStyles(theme);

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['#1A6B6A', '#1E4F8A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>
            {t('teacher.teach_today_title', { defaultValue: '📋 Today\'s Teaching Focus' })}
          </Text>
          <Ionicons name="bulb-outline" size={18} color="rgba(234,240,255,0.72)" />
        </View>

        {hasRoutine && themeName ? (
          <View style={styles.themeRow}>
            <View style={styles.themeBadge}>
              <Text style={styles.themeBadgeText}>
                {t('teacher.teach_today_theme', { defaultValue: 'Theme: {{name}}', name: themeName })}
              </Text>
            </View>
            {todayRoutine?.nextBlockTitle && (
              <Text style={styles.nextBlock}>
                {t('teacher.teach_today_next', {
                  defaultValue: 'Up next: {{block}}',
                  block: todayRoutine.nextBlockTitle,
                })}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.emptyHint}>
            {t('teacher.teach_today_empty', {
              defaultValue: 'No lesson plan for today. Dash AI can help you create one in seconds.',
            })}
          </Text>
        )}

        {classContext && (
          <Text style={styles.classContext}>
            {t('teacher.teach_today_classes', {
              defaultValue: 'For: {{classes}}',
              classes: classContext,
            })}
          </Text>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {chips.map((chip) => (
            <TouchableOpacity
              key={chip.label}
              style={styles.chip}
              onPress={() => handleChipPress(chip)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={chip.label}
            >
              <Text style={styles.chipText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const getStyles = (_theme: { primary: string; text: string }) =>
  StyleSheet.create({
    card: {
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 },
      elevation: 10,
    },
    gradient: {
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 10,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      color: '#EAF0FF',
      fontSize: 15,
      fontWeight: '700',
    },
    themeRow: {
      gap: 4,
    },
    themeBadge: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    themeBadgeText: {
      color: '#EAF0FF',
      fontSize: 13,
      fontWeight: '600',
    },
    nextBlock: {
      color: 'rgba(234,240,255,0.82)',
      fontSize: 13,
      fontWeight: '500',
      marginTop: 2,
    },
    emptyHint: {
      color: 'rgba(234,240,255,0.82)',
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '500',
    },
    classContext: {
      color: 'rgba(234,240,255,0.60)',
      fontSize: 12,
      fontWeight: '500',
    },
    chipsRow: {
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 2,
    },
    chip: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    chipText: {
      color: '#EAF0FF',
      fontSize: 13,
      fontWeight: '600',
    },
  });
