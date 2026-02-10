import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import type { TeacherStudentSummary } from '@/hooks/useTeacherStudents';
import { BirthdayDonationsService } from '@/features/birthday-donations/services/BirthdayDonationsService';
import type { BirthdayDonationEntry } from '@/features/birthday-donations/types/birthdayDonations.types';
import { notifyBirthdayDonationPaid, notifyBirthdayDonationReminder } from '@/lib/notify';
import { assertSupabase } from '@/lib/supabase';
import { DEFAULT_AMOUNT } from './types';
import type { PaymentMethod, UpcomingBirthday } from './types';

interface UseBirthdayDonationActionsParams {
  organizationId?: string | null;
  donationDate: string | null;
  selectedBirthday: UpcomingBirthday | null;
  paymentMethod: PaymentMethod;
  classIdForRecord?: string;
  isPreschool: boolean;
  useFridayCelebration: boolean;
  loadDonations: () => Promise<void>;
  setSavingId: (id: string | null) => void;
  setError: (error: string | null) => void;
  setSendingReminders: (sending: boolean) => void;
  reminderUnpaidStudents: TeacherStudentSummary[];
  reminderParentIds: string[];
  userId?: string;
  showAlert: (opts: any) => void;
}

export function useBirthdayDonationActions(params: UseBirthdayDonationActionsParams) {
  const { t } = useTranslation();
  const {
    organizationId, donationDate, selectedBirthday, paymentMethod,
    classIdForRecord, isPreschool, useFridayCelebration,
    loadDonations, setSavingId, setError, setSendingReminders,
    reminderUnpaidStudents, reminderParentIds, userId, showAlert,
  } = params;

  const handleMarkPaid = useCallback(async (student: TeacherStudentSummary) => {
    if (!organizationId || !donationDate || !selectedBirthday) return;
    setSavingId(student.id);
    setError(null);
    try {
      await BirthdayDonationsService.recordDonation(organizationId, {
        donationDate, amount: DEFAULT_AMOUNT, paymentMethod,
        payerStudentId: student.id, birthdayStudentId: selectedBirthday.student.id,
        classId: classIdForRecord, celebrationMode: isPreschool && useFridayCelebration,
      });
      const parentId = student.parentId || student.guardianId || null;
      if (parentId) {
        const payerName = `${student.firstName} ${student.lastName}`.trim();
        const bdayName = `${selectedBirthday.student.firstName} ${selectedBirthday.student.lastName}`.trim();
        await notifyBirthdayDonationPaid(parentId, {
          payer_child_name: payerName, birthday_child_name: bdayName,
          donation_amount: DEFAULT_AMOUNT, donation_date: donationDate,
        });
        try {
          await assertSupabase().from('in_app_notifications').insert({
            user_id: parentId,
            title: t('dashboard.birthday_donations.paid_title', { defaultValue: 'Birthday donation received' }),
            message: t('dashboard.birthday_donations.paid_message', {
              defaultValue: '{{payer}} contributed for {{birthday}} (R{{amount}}).',
              payer: payerName, birthday: bdayName, amount: DEFAULT_AMOUNT.toFixed(2),
            }),
            type: 'birthday_donation_paid',
            data: {
              donation_date: donationDate, donation_amount: DEFAULT_AMOUNT,
              payer_student_id: student.id, birthday_student_id: selectedBirthday.student.id,
            },
          });
        } catch (notifyError) {
          if (__DEV__) console.warn('[BirthdayDonations] Failed to insert in-app notification:', notifyError);
        }
      }
      await loadDonations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record donation.');
    } finally {
      setSavingId(null);
    }
  }, [organizationId, donationDate, selectedBirthday, paymentMethod, classIdForRecord, isPreschool, useFridayCelebration, loadDonations, setSavingId, setError, t]);

  const handleMarkUnpaid = useCallback(async (student: TeacherStudentSummary, donationEntry: BirthdayDonationEntry) => {
    if (!organizationId || !donationEntry) return;
    setSavingId(student.id);
    setError(null);
    try {
      await BirthdayDonationsService.unrecordDonation(organizationId, donationEntry.id);
      await loadDonations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove donation.');
    } finally {
      setSavingId(null);
    }
  }, [organizationId, loadDonations, setSavingId, setError]);

  const handleSendReminders = useCallback(async () => {
    if (!organizationId || !selectedBirthday || !donationDate || reminderParentIds.length === 0) return;
    setSendingReminders(true);
    setError(null);
    try {
      await notifyBirthdayDonationReminder(reminderParentIds, {
        child_name: `${selectedBirthday.student.firstName} ${selectedBirthday.student.lastName}`.trim(),
        days_until: selectedBirthday.daysUntil >= 0 ? selectedBirthday.daysUntil : undefined,
        donation_amount: DEFAULT_AMOUNT, donation_date: donationDate,
      });
      let reminderLogError: string | null = null;
      try {
        const rows = reminderUnpaidStudents.flatMap((s) => {
          const recipients = [s.parentId, s.guardianId].filter(Boolean) as string[];
          return recipients.map((rid) => ({
            donationDate, birthdayStudentId: selectedBirthday.student.id,
            payerStudentId: s.id, classId: s.classId ?? null,
            recipientUserId: rid, sentBy: userId ?? null,
          }));
        });
        await BirthdayDonationsService.recordDonationReminders(organizationId, rows);
      } catch (logErr) {
        reminderLogError = logErr instanceof Error ? logErr.message : 'Reminder tracking failed.';
      }
      const successMsg = reminderLogError
        ? t('dashboard.birthday_donations.reminder_sent_tracking_error', { defaultValue: 'Reminders sent, but tracking failed. Please try again.' })
        : t('dashboard.birthday_donations.reminder_sent_message', { defaultValue: 'Sent birthday donation reminders to {{count}} parent(s).', count: reminderParentIds.length });
      showAlert({
        title: t('dashboard.birthday_donations.reminder_sent_title', { defaultValue: 'Reminders sent' }),
        message: successMsg, type: reminderLogError ? 'warning' : 'success',
        buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
      });
      if (reminderLogError) setError(reminderLogError);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send reminders.';
      setError(msg);
      showAlert({
        title: t('dashboard.birthday_donations.reminder_failed_title', { defaultValue: 'Reminder failed' }),
        message: msg, type: 'error', buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
      });
    } finally {
      setSendingReminders(false);
    }
  }, [donationDate, selectedBirthday, reminderParentIds, reminderUnpaidStudents, organizationId, showAlert, t, userId, setSendingReminders, setError]);

  const handleSendReminderPress = useCallback(() => {
    if (!selectedBirthday || !donationDate) return;
    if (reminderUnpaidStudents.length === 0) {
      showAlert({
        title: t('dashboard.birthday_donations.reminder_none_title', { defaultValue: 'No reminders needed' }),
        message: t('dashboard.birthday_donations.reminder_none_message', { defaultValue: 'All parents have already paid for this birthday.' }),
        type: 'info', buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
      });
      return;
    }
    if (reminderParentIds.length === 0) {
      showAlert({
        title: t('dashboard.birthday_donations.reminder_no_contacts_title', { defaultValue: 'No contacts found' }),
        message: t('dashboard.birthday_donations.reminder_no_contacts_message', { defaultValue: 'Add parent or guardian details to send reminders.' }),
        type: 'warning', buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
      });
      return;
    }
    showAlert({
      title: t('dashboard.birthday_donations.reminder_confirm_title', { defaultValue: 'Send reminders?' }),
      message: t('dashboard.birthday_donations.reminder_confirm_message', {
        defaultValue: 'Send a birthday donation reminder to {{count}} parent(s) who have not paid yet?',
        count: reminderParentIds.length,
      }),
      type: 'warning',
      buttons: [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        { text: t('dashboard.birthday_donations.reminder_confirm_cta', { defaultValue: 'Send' }), onPress: () => void handleSendReminders() },
      ],
    });
  }, [donationDate, selectedBirthday, reminderUnpaidStudents.length, reminderParentIds.length, showAlert, t, handleSendReminders]);

  const handleOpenMemories = useCallback(() => {
    if (!organizationId || !selectedBirthday || !donationDate) return;
    router.push({
      pathname: '/screens/birthday-memories',
      params: { organizationId, birthdayStudentId: selectedBirthday.student.id, eventDate: donationDate },
    } as any);
  }, [organizationId, selectedBirthday, donationDate]);

  return { handleMarkPaid, handleMarkUnpaid, handleSendReminderPress, handleOpenMemories };
}
