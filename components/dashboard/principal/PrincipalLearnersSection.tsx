import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/contexts/ThemeContext';
import { StudentSummaryCard } from '@/components/dashboard/shared';
import { PendingParentLinkRequests } from '@/components/dashboard/PendingParentLinkRequests';
import { UpcomingBirthdaysCard } from '@/components/dashboard/UpcomingBirthdaysCard';
import { BirthdayDonationSummaryCard } from '@/components/dashboard/principal/BirthdayDonationSummaryCard';
import { createSectionStyles } from './PrincipalDashboardV2.styles';
import type { UpcomingBirthdaysResponse } from '@/services/BirthdayPlannerService';

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  className?: string;
  dateOfBirth?: string;
  [key: string]: any;
}

export interface PrincipalLearnersSectionProps {
  recentStudents: StudentItem[];
  studentsLoading: boolean;
  birthdays: UpcomingBirthdaysResponse | null;
  birthdaysLoading: boolean;
  organizationId: string | null;
}

export const PrincipalLearnersSection: React.FC<PrincipalLearnersSectionProps> = ({
  recentStudents,
  studentsLoading,
  birthdays,
  birthdaysLoading,
  organizationId,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createSectionStyles(theme), [theme]);

  return (
    <View style={styles.sectionBody}>
      <Text style={styles.sectionDescriptor}>
        {t('dashboard.section.learners_families.copy', {
          defaultValue: 'Review learners in focus and stay ahead of parent-facing moments.',
        })}
      </Text>

      {/* Children In Focus */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.inlineSectionTitle}>
            {t('dashboard.children_in_focus', { defaultValue: 'Children In Focus' })}
          </Text>
          <TouchableOpacity onPress={() => router.push('/screens/student-management' as any)}>
            <Text style={styles.linkText}>
              {t('common.view_all', { defaultValue: 'View All' })}
            </Text>
          </TouchableOpacity>
        </View>
        {studentsLoading ? (
          <Text style={styles.loadingText}>
            {t('common.loading', { defaultValue: 'Loading...' })}
          </Text>
        ) : (
          recentStudents.map((student) => (
            <StudentSummaryCard
              key={student.id}
              student={student}
              onPress={() => router.push(`/screens/student-detail?id=${student.id}` as any)}
              subtitle={
                student.className || t('common.noClass', { defaultValue: 'No class assigned' })
              }
            />
          ))
        )}
        {!studentsLoading && recentStudents.length === 0 && (
          <Text style={styles.emptyText}>
            {t('dashboard.no_students', { defaultValue: 'No students yet.' })}
          </Text>
        )}
      </View>

      {/* Upcoming Birthdays */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.inlineSectionTitle}>
            {t('dashboard.upcoming_birthdays', { defaultValue: 'Upcoming Birthdays' })}
          </Text>
          <TouchableOpacity onPress={() => router.push('/screens/birthday-chart' as any)}>
            <Text style={styles.linkText}>
              {t('dashboard.view_chart', { defaultValue: 'View Chart' })}
            </Text>
          </TouchableOpacity>
        </View>
        <UpcomingBirthdaysCard
          birthdays={birthdays}
          loading={birthdaysLoading}
          showHeader={false}
          maxItems={5}
          compact
          onViewAll={() => router.push('/screens/birthday-chart' as any)}
        />
      </View>

      {/* Birthday Donations */}
      <View style={styles.card}>
        <Text style={styles.inlineSectionTitle}>
          {t('dashboard.birthday_donations.title', { defaultValue: 'Birthday Donations' })}
        </Text>
        <BirthdayDonationSummaryCard organizationId={organizationId} />
      </View>

      {/* Parent Requests */}
      <View style={styles.card}>
        <Text style={styles.inlineSectionTitle}>
          {t('dashboard.parent_requests', { defaultValue: 'Parent Requests' })}
        </Text>
        <PendingParentLinkRequests />
      </View>

      {/* Learner Activity Control */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.inlineSectionTitle}>
            {t('dashboard.learner_activity_control', { defaultValue: 'Learner Activity Control' })}
          </Text>
          <TouchableOpacity onPress={() => router.push('/screens/principal-learner-activity-control' as any)}>
            <Text style={styles.linkText}>
              {t('common.open', { defaultValue: 'Open' })}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionDescriptor}>
          {t('dashboard.section.learners_families.lifecycle_hint', {
            defaultValue: 'Review at-risk learners, due-today inactivity cases, and duplicate/mismatch queues.',
          })}
        </Text>
      </View>
    </View>
  );
};

export default PrincipalLearnersSection;
