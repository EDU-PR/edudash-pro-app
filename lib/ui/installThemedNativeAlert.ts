import { Alert, Platform, type AlertButton, type AlertOptions } from 'react-native';

type AlertFn = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) => void;

let originalAlert: AlertFn | null = null;
let isInstalled = false;
let currentIsDark = false;

export function installThemedNativeAlert(isDark: boolean): void {
  currentIsDark = Boolean(isDark);
  if (isInstalled) return;

  originalAlert = Alert.alert.bind(Alert);

  const patchedAlert: AlertFn = (title, message, buttons, options) => {
    if (!originalAlert) return;
    if (Platform.OS !== 'ios') {
      return originalAlert(title, message, buttons, options);
    }
    const mergedOptions = {
      ...(options || {}),
      userInterfaceStyle: currentIsDark ? 'dark' : 'light',
    } as Parameters<AlertFn>[3];
    return originalAlert(title, message, buttons, mergedOptions);
  };

  Alert.alert = patchedAlert;
  isInstalled = true;
}
