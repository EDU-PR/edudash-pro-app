/**
 * fetchCandidates — Finds available teachers for the hiring hub.
 *
 * 1. Tries `rpc_find_available_teachers_near` (proximity-based).
 * 2. Falls back to a plain `profiles` query when the RPC is unavailable
 *    or the school has no coordinates.
 * 3. Enriches results with reputation ratings.
 */

import { assertSupabase } from '@/lib/supabase';
import { TeacherReputationService } from '@/lib/services/TeacherReputationService';
import type { AvailableTeacher } from '@/types/teacher-management';

export async function fetchAvailableCandidatesForSchool(
  schoolId: string,
  radiusKm: number,
  hiringSearch: string,
): Promise<AvailableTeacher[]> {
  // ---------- Try RPC first ----------
  const rpcResult = await tryRpcSearch(schoolId, radiusKm, hiringSearch);
  if (rpcResult) return rpcResult;

  // ---------- Fallback to profiles ----------
  return fallbackProfileSearch(hiringSearch);
}

// ---- RPC path ----

async function tryRpcSearch(
  schoolId: string,
  radiusKm: number,
  search: string,
): Promise<AvailableTeacher[] | null> {
  const supabase = assertSupabase();
  const { data, error } = await supabase.rpc('rpc_find_available_teachers_near', {
    school_id: schoolId,
    radius_km: radiusKm,
    subject_filter: null,
  });

  if (error || !Array.isArray(data)) return null;

  let list = data as Array<{
    user_id?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    home_city?: string | null;
    home_postal_code?: string | null;
    distance_km?: number;
  }>;

  if (search.trim()) {
    const term = search.trim().toLowerCase();
    list = list.filter(
      (x) =>
        (x.full_name || '').toLowerCase().includes(term) ||
        (x.email || '').toLowerCase().includes(term) ||
        (x.home_city || '').toLowerCase().includes(term) ||
        (x.home_postal_code || '').toLowerCase().includes(term),
    );
  }

  const userIds = list.map((x) => x.user_id).filter((id): id is string => !!id);
  const ratings = await TeacherReputationService.getRatingSummariesByTeacherIds(userIds);

  const enriched: AvailableTeacher[] = list.map((x) => {
    const s = x.user_id ? ratings[x.user_id] : undefined;
    return {
      id: x.user_id || '',
      name: x.full_name || x.email || 'Teacher',
      email: x.email || '',
      phone: x.phone,
      home_city: x.home_city,
      home_postal_code: x.home_postal_code,
      distance_km: x.distance_km,
      rating_average: s?.avg_rating ?? null,
      rating_count: s?.rating_count ?? null,
    };
  });

  return sortByRatingThenDistance(enriched);
}

// ---- Fallback path ----

async function fallbackProfileSearch(search: string): Promise<AvailableTeacher[]> {
  const supabase = assertSupabase();
  let query = supabase
    .from('profiles')
    .select('id, email, first_name, last_name, phone, city, postal_code, role, is_active, preschool_id, organization_id')
    .eq('role', 'teacher')
    .eq('is_active', true)
    .is('preschool_id', null)
    .is('organization_id', null)
    .limit(100);

  if (search.trim()) {
    const term = search.trim();
    query = query.or(
      `city.ilike.%${term}%,postal_code.ilike.%${term}%,email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  if (error) return [];

  const list = (data || []).map((u: Record<string, unknown>) => ({
    id: u.id as string,
    name: u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u.email as string) || 'Teacher',
    email: u.email as string,
    phone: u.phone as string | undefined,
    home_city: (u.city as string) || null,
    home_postal_code: (u.postal_code as string) || null,
  }));

  const userIds = list.map((u) => u.id).filter((id): id is string => !!id);
  const ratings = await TeacherReputationService.getRatingSummariesByTeacherIds(userIds);

  const enriched: AvailableTeacher[] = list.map((u) => ({
    ...u,
    rating_average: ratings[u.id]?.avg_rating ?? null,
    rating_count: ratings[u.id]?.rating_count ?? null,
  }));

  return enriched.sort((a, b) => {
    const rA = a.rating_average ?? 0;
    const rB = b.rating_average ?? 0;
    if (rA !== rB) return rB - rA;
    return a.name.localeCompare(b.name);
  });
}

// ---- Sorting ----

function sortByRatingThenDistance(list: AvailableTeacher[]): AvailableTeacher[] {
  return [...list].sort((a, b) => {
    const rA = a.rating_average ?? 0;
    const rB = b.rating_average ?? 0;
    if (rA !== rB) return rB - rA;
    const dA = a.distance_km ?? Number.MAX_VALUE;
    const dB = b.distance_km ?? Number.MAX_VALUE;
    return dA - dB;
  });
}
