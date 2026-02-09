import type { AlertButton } from '@/components/ui/AlertModal';
import type { AdminUser } from '@/lib/screen-styles/super-admin-admin-management.styles';

export interface ShowAlertConfig {
  title: string;
  message?: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  buttons?: AlertButton[];
}

export interface FormData {
  email: string;
  full_name: string;
  role: AdminUser['role'];
  department: string;
  is_active: boolean;
  schools_assigned: string[];
}

export const INITIAL_FORM_DATA: FormData = {
  email: '',
  full_name: '',
  role: 'admin',
  department: 'customer_success',
  is_active: true,
  schools_assigned: [],
};
