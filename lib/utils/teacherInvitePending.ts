import AsyncStorage from '@react-native-async-storage/async-storage';

export type PendingTeacherInvite = {
  token: string;
  email: string;
};

const PENDING_INVITE_KEY = '@pending_teacher_invite';

export async function setPendingTeacherInvite(data: PendingTeacherInvite): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(data));
  } catch {
    // Non-fatal
  }
}

export async function getPendingTeacherInvite(): Promise<PendingTeacherInvite | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_INVITE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingTeacherInvite;
    if (!parsed?.token || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingTeacherInvite(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // Non-fatal
  }
}
