import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';

interface StationeryEnabledResult {
  stationeryEnabled: boolean;
  stationerySchoolIds: string[];
}

export function useStationeryEnabled(children: any[]): StationeryEnabledResult {
  const [stationeryEnabled, setStationeryEnabled] = useState(false);
  const [stationerySchoolIds, setStationerySchoolIds] = useState<string[]>([]);
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
        new Set(
          children
            .map(
              (child) =>
                child.preschoolId ||
                child.preschool_id ||
                child.organizationId ||
                child.organization_id
            )
            .filter(Boolean)
        )
      ) as string[];

      if (!schoolIds.length) {
        if (!cancelled) {
          setStationeryEnabled(false);
          setStationerySchoolIds([]);
        }
        return;
      }

      try {
        const supabase = assertSupabase();
        const [{ data: preschoolRows }, { data: orgRows }] = await Promise.all([
          supabase.from('preschools').select('id, settings').in('id', schoolIds),
          supabase.from('organizations').select('id, settings').in('id', schoolIds),
        ]);

        const enabledIds = new Set<string>();
        [...(preschoolRows || []), ...(orgRows || [])].forEach((row: any) => {
          if (row?.settings?.features?.stationery?.enabled) {
            enabledIds.add(String(row.id));
          }
        });

        if (!cancelled) {
          const ids = Array.from(enabledIds);
          setStationerySchoolIds(ids);
          setStationeryEnabled(ids.length > 0);
        }
      } catch {
        if (!cancelled) {
          setStationeryEnabled(false);
          setStationerySchoolIds([]);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [children, focusTick]);

  return { stationeryEnabled, stationerySchoolIds };
}

export default useStationeryEnabled;
