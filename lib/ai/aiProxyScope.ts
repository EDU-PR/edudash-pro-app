export type AIProxyScope = 'teacher' | 'principal' | 'parent' | 'student' | 'admin' | 'guest';

/**
 * ai-proxy validates scope against a strict enum. Some app roles (for example
 * "super_admin") must be mapped to a compatible ai-proxy scope to avoid 400s.
 */
export function resolveAIProxyScopeFromRole(role?: string | null): AIProxyScope {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'teacher') return 'teacher';
  if (normalized === 'principal' || normalized === 'principal_admin') return 'principal';
  if (normalized === 'student' || normalized === 'learner') return 'student';
  if (normalized === 'admin' || normalized === 'superadmin' || normalized === 'super_admin') return 'admin';
  if (normalized === 'guest') return 'guest';
  return 'parent';
}

