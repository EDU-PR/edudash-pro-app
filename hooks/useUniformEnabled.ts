/**
 * useUniformEnabled — Checks school settings for uniform feature
 * 
 * Queries both preschools and organizations tables to determine
 * which schools have the uniform sizing feature enabled.
 * 
 * ≤60 lines — WARP-compliant hook.
 */

import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';

interface UniformResult {
  uniformEnabled: boolean;
  uniformSchoolIds: string[];
}

function getChildSchoolIds(child: any): string[] {
  const ids = [
    child?.organizationId,
    child?.preschoolId,
    child?.organization_id,
    child?.preschool_id,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
}

export function useUniformEnabled(children: any[]): UniformResult {
  const [uniformEnabled, setUniformEnabled] = useState(false);
  const [uniformSchoolIds, setUniformSchoolIds] = useState<string[]>([]);
  const [focusTick, setFocusTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setFocusTick((prev) => prev + 1);
      return () => {};
    }, [])
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const schoolIds = Array.from(
        new Set(children.flatMap((child) => getChildSchoolIds(child)))
      ) as string[];

      if (!schoolIds.length) {
        if (!cancelled) { setUniformEnabled(false); setUniformSchoolIds([]); }
        return;
      }

      try {
        const supabase = assertSupabase();
        const [{ data: p }, { data: o }] = await Promise.all([
          supabase.from('preschools').select('id, settings').in('id', schoolIds),
          supabase.from('organizations').select('id, settings').in('id', schoolIds),
        ]);

        const preschoolsById = new Map<string, any>(
          (p || []).map((row: any) => [String(row.id), row])
        );
        const orgsById = new Map<string, any>(
          (o || []).map((row: any) => [String(row.id), row])
        );
        const enabledIds = new Set<string>();
        schoolIds.forEach((schoolId) => {
          const preschoolValue = preschoolsById.get(schoolId)?.settings?.features?.uniforms?.enabled;
          const organizationValue = orgsById.get(schoolId)?.settings?.features?.uniforms?.enabled;
          const resolvedValue =
            typeof preschoolValue === 'boolean'
              ? preschoolValue
              : (typeof organizationValue === 'boolean' ? organizationValue : undefined);
          if (resolvedValue === true) {
            enabledIds.add(schoolId);
          }
        });

        if (!cancelled) {
          setUniformSchoolIds(Array.from(enabledIds));
          setUniformEnabled(enabledIds.size > 0);
        }
      } catch {
        if (!cancelled) { setUniformEnabled(false); setUniformSchoolIds([]); }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [children, focusTick]);

  return { uniformEnabled, uniformSchoolIds };
}

export default useUniformEnabled;
