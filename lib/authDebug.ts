const enabled =
  process.env.EXPO_PUBLIC_DEBUG_AUTH === 'true' ||
  process.env.EXPO_PUBLIC_DEBUG_MODE === 'true' ||
  __DEV__;

type DebugPayload = Record<string, unknown>;

export function authDebug(label: string, payload?: DebugPayload): void {
  if (!enabled) return;
  if (payload) {
    console.log(`[AUTH_FLOW] ${label}`, payload);
  } else {
    console.log(`[AUTH_FLOW] ${label}`);
  }
}

