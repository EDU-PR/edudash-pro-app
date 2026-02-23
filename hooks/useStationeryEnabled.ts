import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';

interface StationeryEnabledResult {
  stationeryEnabled: boolean;
  stationerySchoolIds: string[];
}

function getCurrentAcademicYear(): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-ZA', {
        timeZone: 'Africa/Johannesburg',
        year: 'numeric',
      }).format(new Date()),
    );
  } catch {
    return new Date().getFullYear();
  }
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

export function useStationeryEnabled(children: any[]): StationeryEnabledResult {
  const [stationeryEnabled, setStationeryEnabled] = useState(false);
  const [stationerySchoolIds, setStationerySchoolIds] = useState<string[]>([]);
  const [focusTick, setFocusTick] = useState(0);
  const academicYear = getCurrentAcademicYear();

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
          children.flatMap((child) => getChildSchoolIds(child))
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
        const [{ data: preschoolRows }, { data: orgRows }, { data: publishedLists }] = await Promise.all([
          supabase.from('preschools').select('id, settings').in('id', schoolIds),
          supabase.from('organizations').select('id, settings').in('id', schoolIds),
          supabase
            .from('stationery_lists')
            .select('school_id')
            .in('school_id', schoolIds)
            .eq('academic_year', academicYear)
            .eq('is_visible', true)
            .eq('is_published', true),
        ]);

        const preschoolsById = new Map<string, any>(
          (preschoolRows || []).map((row: any) => [String(row.id), row])
        );
        const organizationsById = new Map<string, any>(
          (orgRows || []).map((row: any) => [String(row.id), row])
        );
        const publishedBySchoolId = new Set<string>(
          (publishedLists || [])
            .map((row: any) => String(row?.school_id || '').trim())
            .filter(Boolean)
        );

        const enabledIds = new Set<string>();
        schoolIds.forEach((schoolId) => {
          const preschoolValue = preschoolsById.get(schoolId)?.settings?.features?.stationery?.enabled;
          const organizationValue = organizationsById.get(schoolId)?.settings?.features?.stationery?.enabled;
          const resolvedValue =
            typeof preschoolValue === 'boolean'
              ? preschoolValue
              : (typeof organizationValue === 'boolean' ? organizationValue : undefined);

          if (resolvedValue === true) {
            enabledIds.add(schoolId);
            return;
          }
          if (resolvedValue === false) {
            return;
          }
          if (publishedBySchoolId.has(schoolId)) {
            enabledIds.add(schoolId);
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
  }, [academicYear, children, focusTick]);

  return { stationeryEnabled, stationerySchoolIds };
}

export default useStationeryEnabled;
