/**
 * useUniformEnabled — Checks school settings for uniform feature
 * 
 * Queries both preschools and organizations tables to determine
 * which schools have the uniform sizing feature enabled.
 * 
 * ≤60 lines — WARP-compliant hook.
 */

import { useState, useEffect } from 'react';
import { assertSupabase } from '@/lib/supabase';

interface UniformResult {
  uniformEnabled: boolean;
  uniformSchoolIds: string[];
}

export function useUniformEnabled(children: any[]): UniformResult {
  const [uniformEnabled, setUniformEnabled] = useState(false);
  const [uniformSchoolIds, setUniformSchoolIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const preschoolIds = Array.from(new Set(
        children.map((c) => c.preschoolId || c.preschool_id).filter(Boolean)
      )) as string[];

      if (!preschoolIds.length) {
        if (!cancelled) { setUniformEnabled(false); setUniformSchoolIds([]); }
        return;
      }

      try {
        const supabase = assertSupabase();
        const [{ data: p }, { data: o }] = await Promise.all([
          supabase.from('preschools').select('id, settings').in('id', preschoolIds),
          supabase.from('organizations').select('id, settings').in('id', preschoolIds),
        ]);

        const enabledIds = new Set<string>();
        [...(p || []), ...(o || [])].forEach((row: any) => {
          if (row?.settings?.features?.uniforms?.enabled) enabledIds.add(row.id);
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
  }, [children]);

  return { uniformEnabled, uniformSchoolIds };
}

export default useUniformEnabled;
