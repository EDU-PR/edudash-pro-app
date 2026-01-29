import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Returns true if we can access the image library without requesting broad storage permissions.
 * Android uses the system picker; iOS still requires photo library permission.
 */
export async function ensureImageLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return true;
  }

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}
