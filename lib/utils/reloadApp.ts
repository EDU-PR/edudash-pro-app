import { DevSettings, Platform } from 'react-native';
import * as Updates from 'expo-updates';

export async function reloadApp(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.reload) {
      window.location.reload();
    }
    return;
  }

  try {
    if (Updates.isEnabled) {
      await Updates.reloadAsync();
      return;
    }
  } catch {
    // Fall through to DevSettings reload for development.
  }

  if (__DEV__ && DevSettings.reload) {
    DevSettings.reload();
  }
}
