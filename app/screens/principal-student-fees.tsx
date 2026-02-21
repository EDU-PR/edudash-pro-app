/**
 * Principal Student Fee Management Screen
 *
 * Allows principals to:
 * - View all student fees at a glance
 * - Waive fees (full or partial)
 * - Correct/adjust student fees
 * - Change student classes
 * - View registration vs school fees summary
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { WaiveFeeModal } from '@/components/principal/WaiveFeeModal';
import { AdjustFeeModal } from '@/components/principal/AdjustFeeModal';
import { ChangeClassModal } from '@/components/principal/ChangeClassModal';
import { useStudentFeeData, useStudentFeeActions, formatCurrency, formatDate } from '@/hooks/student-fees';
import { createStyles } from '@/lib/screen-styles/principal-student-fees.styles';
import { useFinanceAccessGuard } from '@/hooks/useFinanceAccessGuard';
import FinancePasswordPrompt from '@/components/security/FinancePasswordPrompt';

export default function StudentFeeManagementScreen() {
  const router = useRouter();
  const { studentId } = useLocalSearchParams<{ studentId?: string }>();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const financeAccess = useFinanceAccessGuard();
  const { showAlert: showAlertConfig, alertProps } = useAlertModal();
  const showAlert = useCallback(
    (
      title: string,
      message: string,
      type: 'info' | 'warning' | 'success' | 'error' = 'info',
      buttons?: any[]
    ) => {
      showAlertConfig({ title, message, type, buttons });
    },
    [showAlertConfig]
  );

  const data = useStudentFeeData(studentId);
  const actions = useStudentFeeActions({
    student: data.student,
    setStudent: data.setStudent,
    studentRef: data.studentRef,
    classes: data.classes,
    organizationId: data.organizationId,
    loadFees: data.loadFees,
    loadStudent: data.loadStudent,
    showAlert,
    router,
  });

  const styles = useMemo(() => createStyles(theme, isDark, insets), [theme, isDark, insets]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return theme.success;
      case 'pending': return theme.warning;
      case 'overdue': return theme.error;
      case 'waived': return theme.info || '#6B7280';
      default: return theme.textSecondary;
    }
  };

  if (financeAccess.needsPassword) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Fee Management' }} />
        <FinancePasswordPrompt
          visible={financeAccess.promptVisible}
          onSuccess={financeAccess.markUnlocked}
          onCancel={() => {
            financeAccess.dismissPrompt();
            try {
              router.back();
            } catch {
              router.replace('/screens/finance-control-center?tab=receivables' as any);
            }
          }}
        />
      </SafeAreaView>
    );
  }

  if (data.loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Fee Management' }} />
        <EduDashSpinner size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!data.student) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Fee Management' }} />
        <Ionicons name="person-outline" size={64} color={theme.textSecondary} />
        <Text style={styles.emptyTitle}>Student Not Found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { student } = data;
  const isStudentInactive =
    student.is_active === false || String(student.status || '').toLowerCase() === 'inactive';
  const registrationMarkedPaid =
    Boolean(student.registration_fee_paid) || Boolean(student.payment_verified);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: `${student.first_name}'s Fees` }} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={data.refreshing}
            onRefresh={data.onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Student Info Card */}
        <View style={styles.studentCard}>
          <View style={styles.studentInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {student.first_name.charAt(0)}{student.last_name.charAt(0)}
              </Text>
            </View>
            <View style={styles.studentDetails}>
              <Text style={styles.studentName}>
                {student.first_name} {student.last_name}
              </Text>
              <Text style={styles.studentMeta}>
                {student.class_name || 'No Class'} {'\u2022'} {student.parent_name || 'No Parent'}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  isStudentInactive ? styles.statusPillInactive : styles.statusPillActive,
                ]}
              >
                <Ionicons
                  name={isStudentInactive ? 'pause-circle' : 'checkmark-circle'}
                  size={12}
                  color={isStudentInactive ? theme.warning : theme.success}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    isStudentInactive ? styles.statusPillTextInactive : styles.statusPillTextActive,
                  ]}
                >
                  {isStudentInactive ? 'Inactive' : 'Active'}
                </Text>
              </View>
              {!data.hasParent && (
                <View style={styles.parentNotice}>
                  <Ionicons name="alert-circle-outline" size={14} color={theme.warning || '#f59e0b'} />
                  <Text style={styles.parentNoticeText}>Parent not linked</Text>
                  <TouchableOpacity style={styles.parentInviteButton} onPress={() => router.push('/screens/principal-parent-invite-code')}>
                    <Text style={styles.parentInviteText}>Invite Parent</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.parentInviteButton} onPress={() => router.push('/screens/principal-parent-requests')}>
                    <Text style={styles.parentInviteText}>Parent Requests</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={styles.enrollmentRow}>
            <Text style={styles.enrollmentLabel}>Start Date</Text>
            <TouchableOpacity style={styles.enrollmentButton} onPress={() => actions.setShowEnrollmentPicker(true)}>
              <Ionicons name="calendar" size={16} color={theme.primary} />
              <Text style={styles.enrollmentButtonText}>
                {student.enrollment_date ? formatDate(student.enrollment_date) : 'Set Date'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.registrationCard}>
            <View style={styles.registrationHeaderRow}>
              <View>
                <Text style={styles.registrationTitle}>Registration Fee</Text>
                <Text style={styles.registrationAmount}>
                  {formatCurrency(Number(student.registration_fee_amount || 0))}
                </Text>
              </View>
              <View
                style={[
                  styles.registrationStatusBadge,
                  registrationMarkedPaid
                    ? styles.registrationStatusBadgePaid
                    : styles.registrationStatusBadgeUnpaid,
                ]}
              >
                <Ionicons
                  name={registrationMarkedPaid ? 'checkmark-circle' : 'alert-circle'}
                  size={12}
                  color={registrationMarkedPaid ? theme.success : theme.warning}
                />
                <Text
                  style={[
                    styles.registrationStatusText,
                    registrationMarkedPaid
                      ? styles.registrationStatusTextPaid
                      : styles.registrationStatusTextUnpaid,
                  ]}
                >
                  {registrationMarkedPaid ? 'Paid' : 'Not Paid'}
                </Text>
              </View>
            </View>
            <View style={styles.registrationActionsRow}>
              <TouchableOpacity
                style={[
                  styles.registrationActionButton,
                  styles.registrationMarkPaidButton,
                  (actions.saving || actions.updatingRegistrationStatus || registrationMarkedPaid) && { opacity: 0.6 },
                ]}
                disabled={actions.saving || actions.updatingRegistrationStatus || registrationMarkedPaid}
                onPress={() => void actions.handleSetRegistrationPaidStatus(true)}
              >
                {actions.updatingRegistrationStatus && !registrationMarkedPaid ? (
                  <EduDashSpinner size="small" color={theme.success} />
                ) : (
                  <Ionicons name="checkmark-circle-outline" size={15} color={theme.success} />
                )}
                <Text style={styles.registrationMarkPaidText}>Mark Paid</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.registrationActionButton,
                  styles.registrationMarkUnpaidButton,
                  (actions.saving || actions.updatingRegistrationStatus || !registrationMarkedPaid) && { opacity: 0.6 },
                ]}
                disabled={actions.saving || actions.updatingRegistrationStatus || !registrationMarkedPaid}
                onPress={() => void actions.handleSetRegistrationPaidStatus(false)}
              >
                {actions.updatingRegistrationStatus && registrationMarkedPaid ? (
                  <EduDashSpinner size="small" color={theme.warning} />
                ) : (
                  <Ionicons name="refresh-circle-outline" size={15} color={theme.warning} />
                )}
                <Text style={styles.registrationMarkUnpaidText}>Mark Unpaid</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.changeClassButton, isStudentInactive && styles.changeClassButtonDisabled]}
            disabled={isStudentInactive}
            onPress={() => {
              if (isStudentInactive) return;
              actions.setNewClassId(student.class_id || '');
              actions.setClassRegistrationFee(Number(student.registration_fee_amount || 0).toFixed(2));
              actions.setClassFeeHint('Update class and registration fee together to fix parent-facing amount mismatches.');
              actions.setModalType('change_class');
            }}
          >
            <Ionicons name="swap-horizontal" size={18} color={theme.primary} />
            <Text style={styles.changeClassText}>Change Class</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.syncTuitionButton,
              (isStudentInactive || actions.syncingTuitionFees || actions.saving) && styles.changeClassButtonDisabled,
            ]}
            disabled={isStudentInactive || actions.syncingTuitionFees || actions.saving}
            onPress={() => void actions.handleSyncTuitionFeesToClass()}
          >
            {actions.syncingTuitionFees ? (
              <EduDashSpinner size="small" color={theme.info || theme.primary} />
            ) : (
              <Ionicons name="refresh-circle" size={18} color={theme.info || theme.primary} />
            )}
            <Text style={styles.syncTuitionText}>
              {actions.syncingTuitionFees ? 'Syncing Tuition...' : 'Sync Tuition To Class'}
            </Text>
          </TouchableOpacity>

          {!isStudentInactive ? (
            <TouchableOpacity
              style={[
                styles.markInactiveButton,
                (actions.saving || actions.deactivatingStudent) && { opacity: 0.7 },
              ]}
              onPress={actions.handleDeactivateStudent}
              disabled={actions.saving || actions.deactivatingStudent}
            >
              {actions.deactivatingStudent ? (
                <EduDashSpinner size="small" color={theme.warning} />
              ) : (
                <Ionicons name="pause-circle-outline" size={18} color={theme.warning} />
              )}
              <Text style={styles.markInactiveText}>
                {actions.deactivatingStudent ? 'Marking Inactive...' : 'Mark Inactive (30-day retention)'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.inactiveInfoBanner}>
              <Ionicons name="information-circle-outline" size={14} color={theme.warning} />
              <Text style={styles.inactiveInfoText}>
                This learner is inactive and excluded from unpaid follow-up.
              </Text>
            </View>
          )}
        </View>

        {actions.showEnrollmentPicker && (
          <DateTimePicker
            value={student.enrollment_date ? new Date(student.enrollment_date) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, selectedDate) => {
              if (Platform.OS !== 'ios') actions.setShowEnrollmentPicker(false);
              if (selectedDate) actions.handleUpdateEnrollmentDate(selectedDate);
            }}
          />
        )}

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: theme.error }]}>
            <Text style={styles.summaryLabel}>Outstanding</Text>
            <Text style={[styles.summaryValue, { color: theme.error }]}>{formatCurrency(data.totals.outstanding)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: theme.success }]}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={[styles.summaryValue, { color: theme.success }]}>{formatCurrency(data.totals.paid)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#6B7280' }]}>
            <Text style={styles.summaryLabel}>Waived</Text>
            <Text style={[styles.summaryValue, { color: '#6B7280' }]}>{formatCurrency(data.totals.waived)}</Text>
          </View>
        </View>

        {/* Fees List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fee History</Text>

          {data.displayFees.length === 0 ? (
            <View style={styles.emptyFees}>
              <Ionicons name="receipt-outline" size={48} color={theme.textSecondary} />
              <Text style={styles.emptyFeesText}>No fees recorded</Text>
              {data.feeSetupStatus === 'missing' && (
                <Text style={styles.emptyFeesHint}>No tuition fee setup found for this school yet.</Text>
              )}
              {data.feeSetupStatus === 'school_only' && (
                <Text style={styles.emptyFeesHint}>Fees are configured but haven't been generated for this student.</Text>
              )}
              {data.feeSetupStatus === 'skipped_inactive' && (
                <Text style={styles.emptyFeesHint}>Fee generation was skipped because this learner is not active.</Text>
              )}
              {data.feeSetupStatus !== 'missing' && data.feeSetupStatus !== 'skipped_inactive' && (
                <TouchableOpacity style={styles.generateFeesButton} onPress={data.handleGenerateFees} disabled={data.generatingFees}>
                  <Text style={styles.generateFeesText}>{data.generatingFees ? 'Generating...' : 'Generate Fees'}</Text>
                </TouchableOpacity>
              )}
              {(data.feeSetupStatus === 'missing' || data.feeSetupStatus === 'school_only') && (
                <TouchableOpacity style={styles.openFeeSetupButton} onPress={() => router.push('/screens/admin/fee-management')}>
                  <Text style={styles.openFeeSetupText}>Open Fee Setup</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            data.displayFees.map(fee => {
              const isMarkPaidBusy =
                actions.processingFeeId === fee.id && actions.processingFeeAction === 'mark_paid';
              const isMarkUnpaidBusy =
                actions.processingFeeId === fee.id && actions.processingFeeAction === 'mark_unpaid';
              return (
                <View key={fee.id} style={styles.feeCard}>
                  <View style={styles.feeHeader}>
                    <View>
                      <Text style={styles.feeDescription}>{fee.description || fee.fee_type}</Text>
                      <Text style={styles.feeDueDate}>Due: {formatDate(fee.due_date)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(fee.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(fee.status) }]}>
                        {fee.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.feeAmounts}>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Original:</Text>
                      <Text style={styles.amountValue}>{formatCurrency(fee.amount)}</Text>
                    </View>
                    {fee.waived_amount != null && fee.waived_amount > 0 && (
                      <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>Waived:</Text>
                        <Text style={[styles.amountValue, { color: '#6B7280' }]}>-{formatCurrency(fee.waived_amount)}</Text>
                      </View>
                    )}
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Final:</Text>
                      <Text style={[styles.amountValue, styles.finalAmount]}>{formatCurrency(fee.final_amount)}</Text>
                    </View>
                  </View>

                  {fee.waived_reason && (
                    <View style={styles.waiverNote}>
                      <Ionicons name="information-circle" size={14} color={theme.textSecondary} />
                      <Text style={styles.waiverNoteText}>Waiver: {fee.waived_reason}</Text>
                    </View>
                  )}

                  {(fee.status === 'pending' || fee.status === 'overdue' || fee.status === 'partially_paid') && (
                    <>
                      <View style={styles.feeActions}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.paidButton, (actions.saving || isMarkPaidBusy) && { opacity: 0.7 }]}
                          onPress={() => actions.handleMarkPaid(fee)}
                          disabled={actions.saving || isMarkPaidBusy}
                        >
                          {isMarkPaidBusy ? (
                            <EduDashSpinner size="small" color={theme.success} />
                          ) : (
                            <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                          )}
                          <Text style={styles.paidButtonText}>{isMarkPaidBusy ? 'Marking Paid...' : 'Mark Paid'}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.feeActions}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.waiveButton, actions.saving && { opacity: 0.7 }]}
                          disabled={actions.saving}
                          onPress={() => {
                            actions.setSelectedFee(fee);
                            actions.setWaiveType('full');
                            actions.setWaiveAmount('');
                            actions.setWaiveReason('');
                            actions.setModalType('waive');
                          }}
                        >
                          <Ionicons name="checkmark-done" size={16} color="#6B7280" />
                          <Text style={styles.waiveButtonText}>Waive</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.adjustButton, actions.saving && { opacity: 0.7 }]}
                          disabled={actions.saving}
                          onPress={() => {
                            actions.setSelectedFee(fee);
                            actions.setAdjustAmount(fee.final_amount.toString());
                            actions.setAdjustReason('');
                            actions.setModalType('adjust');
                          }}
                        >
                          <Ionicons name="create" size={16} color={theme.primary} />
                          <Text style={styles.adjustButtonText}>Adjust</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {fee.status === 'paid' && (
                    <View style={styles.feeActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.receiptButton, actions.saving && { opacity: 0.7 }]}
                        disabled={actions.saving}
                        onPress={() => actions.handleReceiptAction(fee)}
                      >
                        <Ionicons name="receipt-outline" size={16} color={theme.primary} />
                        <Text style={styles.receiptButtonText}>Receipt</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.unpaidButton,
                          (actions.saving || isMarkUnpaidBusy) && { opacity: 0.7 },
                        ]}
                        onPress={() => actions.handleMarkUnpaid(fee)}
                        disabled={actions.saving || isMarkUnpaidBusy}
                      >
                        {isMarkUnpaidBusy ? (
                          <EduDashSpinner size="small" color={theme.warning} />
                        ) : (
                          <Ionicons name="refresh" size={16} color={theme.warning} />
                        )}
                        <Text style={styles.unpaidButtonText}>
                          {isMarkUnpaidBusy ? 'Marking Unpaid...' : 'Mark Unpaid'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <WaiveFeeModal
        visible={actions.modalType === 'waive'}
        fee={actions.selectedFee}
        saving={actions.saving}
        waiveType={actions.waiveType}
        waiveAmount={actions.waiveAmount}
        waiveReason={actions.waiveReason}
        onChangeType={actions.setWaiveType}
        onChangeAmount={actions.setWaiveAmount}
        onChangeReason={actions.setWaiveReason}
        onSubmit={actions.handleWaiveFee}
        onClose={() => actions.setModalType(null)}
        styles={styles}
      />

      <AdjustFeeModal
        visible={actions.modalType === 'adjust'}
        fee={actions.selectedFee}
        saving={actions.saving}
        adjustAmount={actions.adjustAmount}
        adjustReason={actions.adjustReason}
        onChangeAmount={actions.setAdjustAmount}
        onChangeReason={actions.setAdjustReason}
        onSubmit={actions.handleAdjustFee}
        onClose={() => actions.setModalType(null)}
        styles={styles}
      />

      <ChangeClassModal
        visible={actions.modalType === 'change_class'}
        student={data.student}
        classes={data.classes}
        saving={actions.saving}
        newClassId={actions.newClassId}
        classRegistrationFee={actions.classRegistrationFee}
        classFeeHint={actions.classFeeHint}
        loadingSuggestedFee={actions.loadingSuggestedFee}
        canSubmit={actions.canSubmitClassCorrection}
        onSelectClass={(id) => {
          actions.setNewClassId(id);
          actions.setClassFeeHint('');
          void actions.prefillRegistrationFeeForClass(id);
        }}
        onChangeFee={actions.setClassRegistrationFee}
        onClearHint={() => actions.setClassFeeHint('')}
        onSubmit={actions.handleChangeClass}
        onClose={() => actions.setModalType(null)}
        styles={styles}
      />

      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}
