import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/contexts/ThemeContext';
import {
  MetricTile,
  MetricInline,
  ProgressBar,
  formatCurrency,
} from './PrincipalMetricComponents';
import { createSectionStyles } from './PrincipalDashboardV2.styles';

export interface PrincipalAdmissionsCashflowProps {
  pendingApplications: number;
  pendingRegistrations: number;
  pendingPayments: number;
  pendingPaymentsAmount?: number;
  pendingPaymentsOverdueAmount?: number;
  pendingPOPs: number;
  pendingApprovalsTotal: number;
  monthlyRevenue?: number | null;
  utilization: number;
  uniformSummary?: {
    paidCount: number;
    pendingCount: number;
    pendingUploads: number;
    totalPaid?: number;
    totalOutstanding?: number;
    pendingUploadAmount?: number;
  } | null;
  showUniformSection: boolean;
  isYoungEagles: boolean;
}

export const PrincipalAdmissionsCashflow: React.FC<PrincipalAdmissionsCashflowProps> = ({
  pendingApplications,
  pendingRegistrations,
  pendingPayments,
  pendingPaymentsAmount = 0,
  pendingPaymentsOverdueAmount = 0,
  pendingPOPs,
  pendingApprovalsTotal,
  monthlyRevenue,
  utilization,
  uniformSummary,
  showUniformSection,
  isYoungEagles,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createSectionStyles(theme), [theme]);

  return (
    <View style={styles.sectionBody}>
      <Text style={styles.sectionDescriptor}>
        {t('dashboard.section.admissions_cashflow.copy', {
          defaultValue: 'Track new-family pipeline and payment health month by month.',
        })}
      </Text>

      <View style={styles.metricGrid}>
        <MetricTile
          icon="document-text"
          label={t('dashboard.new_applications', { defaultValue: 'Applications' })}
          value={`${pendingApplications}`}
          sublabel={t('dashboard.awaiting_review', { defaultValue: 'Awaiting review' })}
          color={theme.primary}
          theme={theme}
        />
        <MetricTile
          icon="person-add"
          label={t('dashboard.pending_registrations', { defaultValue: 'Registrations' })}
          value={`${pendingRegistrations}`}
          sublabel={t('dashboard.awaiting_payment', { defaultValue: 'Awaiting payment' })}
          color={theme.warning}
          theme={theme}
        />
        <MetricTile
          icon="cash"
          label={t('dashboard.unpaid_fees', { defaultValue: 'Unpaid Fees' })}
          value={`${pendingPayments}`}
          sublabel={t('dashboard.overdue', { defaultValue: 'Overdue' })}
          color={theme.error}
          theme={theme}
        />
        <MetricTile
          icon="card"
          label={t('dashboard.payment_proofs', { defaultValue: 'POPs' })}
          value={`${pendingPOPs}`}
          sublabel={t('dashboard.to_verify', { defaultValue: 'To verify' })}
          color={theme.info}
          theme={theme}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.inlineSectionTitle}>
          {t('dashboard.money_summary', { defaultValue: 'Finance Snapshot' })}
        </Text>
        <MetricInline
          label={t('dashboard.money_received', { defaultValue: 'Collected' })}
          value={formatCurrency(monthlyRevenue)}
          theme={theme}
        />
        <MetricInline
          label={t('dashboard.money_owed', { defaultValue: 'Outstanding' })}
          value={
            pendingPaymentsAmount > 0
              ? `${formatCurrency(pendingPaymentsAmount)} • ${pendingPayments}`
              : `${pendingPayments}`
          }
          theme={theme}
        />
        <MetricInline
          label={t('dashboard.overdue', { defaultValue: 'Overdue' })}
          value={formatCurrency(pendingPaymentsOverdueAmount)}
          theme={theme}
        />
        <MetricInline
          label={t('dashboard.pending_approvals', { defaultValue: 'Pending Approvals' })}
          value={`${pendingApprovalsTotal}`}
          theme={theme}
        />
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {t('dashboard.capacity_usage', { defaultValue: 'Capacity Usage' })}
          </Text>
          <Text style={styles.progressValue}>{utilization}%</Text>
        </View>
        <ProgressBar
          progress={Math.min(Math.max(utilization / 100, 0), 1)}
          color={theme.primary}
          trackColor={theme.border}
        />
      </View>

      {showUniformSection && (
        <View style={styles.card}>
          <Text style={styles.inlineSectionTitle}>
            {t('dashboard.uniform_collections', { defaultValue: 'Uniform Collections' })}
          </Text>
          <Text style={styles.uniformNote}>
            {isYoungEagles
              ? t('dashboard.uniform_collections_note_ye', {
                  defaultValue:
                    'Young Eagles uniform payments are tracked separately from school revenue.',
                })
              : t('dashboard.uniform_collections_note', {
                  defaultValue:
                    'Uniform payments are tracked separately from school revenue.',
                })}
          </Text>
          <MetricInline
            label={t('dashboard.uniform_paid', { defaultValue: 'Paid (Uniforms)' })}
            value={formatCurrency(uniformSummary?.totalPaid || 0)}
            theme={theme}
          />
          <MetricInline
            label={t('dashboard.uniform_outstanding', { defaultValue: 'Outstanding' })}
            value={formatCurrency(uniformSummary?.totalOutstanding || 0)}
            theme={theme}
          />
          <MetricInline
            label={t('dashboard.uniform_pending_pops', { defaultValue: 'Pending POPs' })}
            value={
              uniformSummary?.pendingUploadAmount
                ? `${uniformSummary?.pendingUploads || 0} pending (${formatCurrency(uniformSummary.pendingUploadAmount)})`
                : `${uniformSummary?.pendingUploads || 0} pending`
            }
            theme={theme}
          />
        </View>
      )}
    </View>
  );
};

export default PrincipalAdmissionsCashflow;
