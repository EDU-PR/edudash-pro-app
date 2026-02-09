import type { AlertButton } from '@/components/ui/AlertModal';
import type { WhatsAppConnection, WhatsAppTemplate, WhatsAppMetrics } from '@/lib/screen-styles/super-admin-whatsapp.styles';

export interface ShowAlertConfig {
  title: string;
  message?: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  buttons?: AlertButton[];
}

export interface ConfigData {
  webhook_url: string;
  verify_token: string;
  app_id: string;
  app_secret: string;
  business_account_id: string;
  phone_number_id: string;
  access_token: string;
}

export const INITIAL_CONFIG: ConfigData = {
  webhook_url: '',
  verify_token: '',
  app_id: '',
  app_secret: '',
  business_account_id: '',
  phone_number_id: '',
  access_token: '',
};

export type { WhatsAppConnection, WhatsAppTemplate, WhatsAppMetrics };
