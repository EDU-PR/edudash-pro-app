/**
 * useSpotlightTarget
 *
 * Convenience hook for registering a View ref as a spotlight tour target.
 * Returns a ref you attach to the element that should be highlighted.
 *
 * @example
 * const menuRef = useSpotlightTarget('parent-menu-tile');
 * <View ref={menuRef} collapsable={false}>...</View>
 *
 * @module hooks/useSpotlightTarget
 */

import { useEffect, useRef } from 'react';
import { useSpotlightTour } from '@/contexts/SpotlightTourContext';

export function useSpotlightTarget(targetKey: string) {
  const ref = useRef<any>(null);
  const { registerTarget, unregisterTarget } = useSpotlightTour();

  useEffect(() => {
    registerTarget(targetKey, ref);
    return () => unregisterTarget(targetKey);
  }, [targetKey, registerTarget, unregisterTarget]);

  return ref;
}

export default useSpotlightTarget;
