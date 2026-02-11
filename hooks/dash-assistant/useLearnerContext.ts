/**
 * Learner Context
 *
 * Effect-driven hook that resolves the learner context (age band, grade,
 * school type, language) for parent / student / staff roles and pushes
 * it into the Dash AI instance.
 *
 * @module hooks/dash-assistant/useLearnerContext
 * @max-lines 200
 */

import { useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import { calculateAge } from '@/lib/date-utils';
import { fetchParentChildren } from '@/lib/parent-children';
import { getCurrentLanguage } from '@/lib/i18n';
import { normalizeLanguageCode } from '@/lib/ai/dashSettings';
import { resolveAgeBand, type LearnerContext } from '@/lib/dash-ai/learnerContext';
import { resolveSchoolTypeFromProfile } from '@/lib/schoolTypeResolver';

interface UseLearnerContextParams {
  dashInstance: IDashAIAssistant | null;
  userId: string | undefined;
  profile: any;
  activeChildId: string | null;
  setActiveChildId: (id: string | null) => void;
  setLearnerContext: (ctx: LearnerContext | null) => void;
}

export function useLearnerContext(params: UseLearnerContextParams) {
  const { dashInstance, userId, profile, activeChildId, setActiveChildId, setLearnerContext } =
    params;

  // Load active child from storage on mount
  useEffect(() => {
    let mounted = true;
    const loadActiveChild = async () => {
      try {
        const stored = await AsyncStorage.getItem('@edudash_active_child_id');
        if (mounted) setActiveChildId(stored || null);
      } catch {
        if (mounted) setActiveChildId(null);
      }
    };
    loadActiveChild();
    return () => {
      mounted = false;
    };
  }, [setActiveChildId]);

  // Apply learner context whenever profile / dash instance changes
  useEffect(() => {
    if (!dashInstance || !userId) return;
    let cancelled = false;

    const applyLearnerContext = async () => {
      const profileAny = profile as any;
      const role = profile?.role || '';
      const schoolId = profile?.organization_id || profile?.preschool_id;
      const schoolType = resolveSchoolTypeFromProfile(profileAny);

      const setDefaultAgeBand = async (band: string | null) => {
        if (!band) return;
        try {
          const stored = await AsyncStorage.getItem('@dash_ai_age_band');
          if (!stored || stored === 'auto') {
            await AsyncStorage.setItem('@dash_ai_age_band', band);
          }
        } catch {}
      };

      const toLocale = (lang?: string | null): 'en-ZA' | 'af-ZA' | 'zu-ZA' => {
        const base = normalizeLanguageCode(lang || getCurrentLanguage?.());
        if (base === 'af') return 'af-ZA';
        if (base === 'zu') return 'zu-ZA';
        return 'en-ZA';
      };

      const personality = dashInstance.getPersonality?.();
      const uiLocale = toLocale(getCurrentLanguage?.());
      const targetLocale = personality?.response_language
        ? toLocale(personality.response_language)
        : toLocale(
            personality?.voice_settings?.language ||
              profileAny?.preferred_language ||
              uiLocale,
          );
      const shouldForceStrict =
        role === 'parent' || role === 'student' || role === 'learner';

      const needsLanguageUpdate =
        personality?.response_language !== targetLocale ||
        personality?.voice_settings?.language !== targetLocale ||
        (shouldForceStrict && personality?.strict_language_mode !== true);

      if (needsLanguageUpdate) {
        try {
          await dashInstance.savePersonality({
            response_language: targetLocale,
            strict_language_mode: shouldForceStrict
              ? true
              : personality?.strict_language_mode,
            voice_settings: {
              ...(personality?.voice_settings || {}),
              language: targetLocale,
            },
          });
        } catch (langErr) {
          console.warn('[useLearnerContext] Failed to enforce language settings:', langErr);
        }
      }

      if (role === 'parent') {
        const children = await fetchParentChildren(userId, {
          includeInactive: false,
          schoolId,
        });
        const activeChild =
          children.find((child) => child.id === activeChildId) || children[0];
        if (!activeChild) {
          const parentName = profile?.full_name || profile?.first_name || null;
          if (!cancelled)
            setLearnerContext({
              learnerName: parentName,
              grade: null,
              ageYears: null,
              ageBand: null,
              schoolType,
              role: 'parent',
            });
          dashInstance
            .updateUserContext({
              age_group: null,
              grade_levels: null,
              organization_type: schoolType || null,
              preferred_language: targetLocale,
              user_role: 'parent',
            })
            .catch(() => {});
          return;
        }

        const classData = Array.isArray(activeChild.classes)
          ? activeChild.classes[0]
          : activeChild.classes;
        const grade =
          activeChild.grade_level || activeChild.grade || classData?.grade_level || null;
        const ageYears = calculateAge(activeChild.date_of_birth);
        const ageBand = resolveAgeBand(ageYears, grade);
        const learnerName =
          `${activeChild.first_name} ${activeChild.last_name}`.trim() || null;

        if (!cancelled)
          setLearnerContext({ learnerName, grade, ageYears, ageBand, schoolType, role: 'student' });

        if (!activeChildId || activeChildId !== activeChild.id) {
          setActiveChildId(activeChild.id);
          try {
            await AsyncStorage.setItem('@edudash_active_child_id', activeChild.id);
          } catch {}
        }

        const ageGroup =
          ageBand === 'adult'
            ? 'adult'
            : ageBand === '13-15' || ageBand === '16-18'
              ? 'teen'
              : ageBand
                ? 'child'
                : null;

        dashInstance
          .updateUserContext({
            age_group: ageGroup,
            grade_levels: grade ? [String(grade)] : null,
            organization_type: schoolType || null,
            preferred_language: targetLocale,
            student_id: activeChild.id,
            student_name: learnerName,
          })
          .catch(() => {});
        await setDefaultAgeBand(ageBand);
        return;
      }

      if (role === 'student' || role === 'learner') {
        const grade = profileAny?.grade_level || null;
        const ageYears = calculateAge(profile?.date_of_birth);
        const ageBand = resolveAgeBand(ageYears, grade);
        const learnerName = profile?.full_name || profile?.first_name || null;

        if (!cancelled)
          setLearnerContext({ learnerName, grade, ageYears, ageBand, schoolType, role });

        const ageGroup =
          ageBand === 'adult'
            ? 'adult'
            : ageBand === '13-15' || ageBand === '16-18'
              ? 'teen'
              : ageBand
                ? 'child'
                : null;

        dashInstance
          .updateUserContext({
            age_group: ageGroup,
            grade_levels: grade ? [String(grade)] : null,
            organization_type: schoolType || null,
            preferred_language: targetLocale,
          })
          .catch(() => {});
        await setDefaultAgeBand(ageBand);
        return;
      }

      // Staff / other roles
      const staffName = profile?.full_name || profile?.first_name || null;
      if (!cancelled)
        setLearnerContext({
          learnerName: staffName,
          grade: null,
          ageYears: null,
          ageBand: null,
          schoolType,
          role,
        });

      dashInstance
        .updateUserContext({
          age_group: null,
          grade_levels: null,
          organization_type: schoolType || null,
          preferred_language: targetLocale,
          user_role: role || null,
        })
        .catch(() => {});
    };

    applyLearnerContext();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dashInstance,
    `${userId}|${profile?.role}|${profile?.organization_id}|${profile?.preschool_id}|${(profile as any)?.organization_membership?.school_type}|${(profile as any)?.organization_type}|${(profile as any)?.school_type}|${(profile as any)?.usage_type}|${profile?.full_name}|${profile?.first_name}|${profile?.date_of_birth}|${activeChildId}`,
  ]);
}
