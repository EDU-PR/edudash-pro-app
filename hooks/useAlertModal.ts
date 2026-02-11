import { useState, useCallback } from 'react';
import type { AlertButton } from '@/components/ui/AlertModal';

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  buttons: AlertButton[];
}

const INITIAL: AlertState = { visible: false, title: '', message: '', type: 'info', buttons: [] };

export function useAlertModal() {
  const [alertState, setAlertState] = useState<AlertState>(INITIAL);

  const showAlert = useCallback(
    (
      title: string,
      message: string,
      type: 'info' | 'warning' | 'success' | 'error' = 'info',
      buttons: AlertButton[] = [{ text: 'OK', style: 'default' }],
    ) => {
      setAlertState({ visible: true, title, message, type, buttons });
    },
    [],
  );

  const hideAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, visible: false }));
  }, []);

  return { alertState, showAlert, hideAlert };
}
