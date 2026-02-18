/**
 * useBottomInset – shared safe-area bottom inset hook.
 *
 * Provides a consistent minimum bottom padding that accounts for
 * gesture-navigation bars on modern Android/iOS devices.
 *
 * Usage:
 *   const bottom = useBottomInset();          // default min 8
 *   const bottom = useBottomInset(16);        // custom min 16
 *   // For absolute-positioned bars:   { bottom: bottomInset }
 *   // For scroll content:             { paddingBottom: bottomInset + 40 }
 *   // For modal footers:              { paddingBottom: bottomInset + 16 }
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DEFAULT_MIN = 8;

/**
 * Returns `Math.max(insets.bottom, min)`.
 *
 * @param min – minimum pixel value when the device has no gesture bar (default 8).
 */
export function useBottomInset(min: number = DEFAULT_MIN): number {
  const { bottom } = useSafeAreaInsets();
  return Math.max(bottom, min);
}
