import type { AlertButton } from '@/components/ui/AlertModal';

export interface ParentAlertConfig {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  buttons?: AlertButton[];
}

export type ParentAlertApi = (config: ParentAlertConfig) => void;
