/**
 * K12ParentLearningHub
 *
 * Unified learning card merging Tutor Session CTA, Exam Builder,
 * and Homework Help into one cohesive section.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { GradientActionCard } from '@/components/nextgen/GradientActionCard';
import type { ThemeColors } from '@/contexts/ThemeContext';
import { styles } from './K12ParentDashboard.styles';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ROBOT_MASCOT = require('@/assets/images/robot-mascot.png');

interface K12ParentLearningHubProps {
  leadChildName: string | null;
  onOpenTutor: () => void;
  onExamBuilder: () => void;
  onHomework: () => void;
  canShowExamPrep: boolean;
  quickWinsEnabled: boolean;
  theme: ThemeColors;
}

export function K12ParentLearningHub({
  leadChildName,
  onOpenTutor,
  onExamBuilder,
  onHomework,
  canShowExamPrep,
  quickWinsEnabled,
  theme,
}: K12ParentLearningHubProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      {/* Unified Learning Hub Card */}
      <TouchableOpacity
        style={styles.learningHubCard}
        activeOpacity={0.88}
        onPress={onOpenTutor}
      >
        <LinearGradient
          colors={['#22433F', '#3C8E62', '#5A409D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.learningHubGradient}
        >
          <View style={styles.learningHubHeader}>
            <View style={styles.learningHubMascotWrap}>
              <Image source={ROBOT_MASCOT} style={styles.learningHubMascot} />
            </View>
            <View style={styles.learningHubTextWrap}>
              <Text style={styles.learningHubTitle}>
                {t('dashboard.parent.k12.ai_tools.title', { defaultValue: 'AI & Learning Tools' })}
              </Text>
              <Text style={styles.learningHubSubtitle}>
                {t('dashboard.parent.k12.current_tutor_hint', {
                  defaultValue: 'Dash Tutor is ready for {{name}} with guided one-step coaching and revision prompts.',
                  name: leadChildName || t('roles.student', { defaultValue: 'your learner' }),
                })}
              </Text>
            </View>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.learningHubActions}>
            <TouchableOpacity
              style={styles.learningHubActionButton}
              onPress={onOpenTutor}
              activeOpacity={0.7}
            >
              <Text style={styles.learningHubActionText}>
                {t('dashboard.parent.k12.tutor_cta', { defaultValue: 'Start Tutor Session' })}
              </Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.learningHubActionButton}
              onPress={onHomework}
              activeOpacity={0.7}
            >
              <Text style={styles.learningHubActionText}>
                {t('dashboard.parent.nav.homework', { defaultValue: 'Homework' })}
              </Text>
              <Ionicons name="document-text-outline" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Exam Builder Card */}
      <View style={styles.learningHubGrid}>
        <GradientActionCard
          tone="purple"
          gradientColors={quickWinsEnabled ? ['#23214D', '#5A409D'] : undefined}
          ctaBackgroundColor={quickWinsEnabled ? '#5A409D' : undefined}
          icon="document-text-outline"
          badgeLabel={t('dashboard.parent.k12.exam_badge', { defaultValue: 'Exam Builder' })}
          title={t('dashboard.parent.k12.exam_title', { defaultValue: 'Build Full Exam (Printable)' })}
          description={t('dashboard.parent.k12.exam_description', { defaultValue: 'Generate a CAPS-aligned formal test paper for review or print.' })}
          cta={t('dashboard.parent.k12.exam_cta', { defaultValue: 'Generate Formal Test Paper' })}
          onPress={onExamBuilder}
          disabled={!canShowExamPrep}
        />
      </View>
    </View>
  );
}
