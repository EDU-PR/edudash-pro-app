import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlertModal } from '@/components/ui/AlertModal';
import { useBirthdayDonationData } from './useBirthdayDonationData';
import { useBirthdayDonationActions } from './useBirthdayDonationActions';
import { createStyles } from './BirthdayDonationRegister.styles';

export function useBirthdayDonations({ organizationId }: { organizationId?: string | null }) {
  const { theme } = useTheme();
  const { showAlert, AlertModalComponent } = useAlertModal();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const data = useBirthdayDonationData({ organizationId });

  const actions = useBirthdayDonationActions({
    organizationId,
    donationDate: data.donationDate,
    selectedBirthday: data.selectedBirthday,
    paymentMethod: data.paymentMethod,
    classIdForRecord: data.classIdForRecord,
    isPreschool: data.isPreschool,
    useFridayCelebration: data.useFridayCelebration,
    loadDonations: data.loadDonations,
    setSavingId: data.setSavingId,
    setError: data.setError,
    setSendingReminders: data.setSendingReminders,
    reminderUnpaidStudents: data.reminderUnpaidStudents,
    reminderParentIds: data.reminderParentIds,
    userId: data.user?.id,
    showAlert,
  });

  return { ...data, ...actions, styles, theme, showAlert, AlertModalComponent };
}
