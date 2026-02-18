/**
 * Search Route — Compatibility Alias
 *
 * Redirects legacy `/screens/search` to the canonical `/screens/app-search`.
 * Protects older deep links and bookmarks.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SearchRedirect() {
  const params = useLocalSearchParams();
  const query = typeof params.q === 'string' ? params.q : '';
  const scope = typeof params.scope === 'string' ? params.scope : 'all';

  return (
    <Redirect
      href={{
        pathname: '/screens/app-search',
        params: { q: query, scope },
      }}
    />
  );
}
