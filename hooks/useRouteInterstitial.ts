import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { useAds } from '@/contexts/AdsContext';
import { isAuthLikeRoute, isNonEducationalRoute } from '@/lib/ads/routeClassifier';

export function useRouteInterstitial() {
  const { maybeShowInterstitial, ready } = useAds();
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!pathname || typeof pathname !== 'string') return;
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    if (isAuthLikeRoute(pathname)) return;
    if (!isNonEducationalRoute(pathname)) return;

    maybeShowInterstitial(`route:${pathname}`).catch(() => {});
  }, [pathname, ready, maybeShowInterstitial]);
}
