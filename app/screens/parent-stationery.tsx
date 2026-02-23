import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SubPageHeader } from '@/components/SubPageHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { StationeryChecklistSection } from '@/components/dashboard/parent/StationeryChecklistSection';

type ChildRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  preschool_id?: string | null;
  organization_id?: string | null;
};

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

function getChildSchoolIds(child: ChildRow): string[] {
  const ids = [
    child.organization_id,
    child.preschool_id,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
}

export default function ParentStationeryScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const supabase = useMemo(() => assertSupabase(), []);
  const academicYear = useMemo(() => getCurrentAcademicYear(), []);

  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureEnabledSchoolIds, setFeatureEnabledSchoolIds] = useState<string[]>([]);

  const parentId = (profile as any)?.id || user?.id || null;

  const load = useCallback(async () => {
    if (!parentId) {
      setChildren([]);
      setFeatureEnabledSchoolIds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const parentFilters = [`parent_id.eq.${parentId}`, `guardian_id.eq.${parentId}`];
      if (user?.id && user.id !== parentId) {
        parentFilters.push(`parent_id.eq.${user.id}`, `guardian_id.eq.${user.id}`);
      }

      const { data, error: childrenError } = await supabase
        .from('students')
        .select('id, first_name, last_name, date_of_birth, preschool_id, organization_id')
        .or(parentFilters.join(','))
        .eq('is_active', true)
        .order('first_name', { ascending: true });

      if (childrenError) throw childrenError;

      const rows = (data || []) as ChildRow[];
      setChildren(rows);

      const schoolIds = Array.from(
        new Set(rows.flatMap((child) => getChildSchoolIds(child)))
      ) as string[];
      if (!schoolIds.length) {
        setFeatureEnabledSchoolIds([]);
        return;
      }

      const [{ data: preschools }, { data: orgs }, { data: publishedLists }] = await Promise.all([
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
        (preschools || []).map((row: any) => [String(row.id), row])
      );
      const organizationsById = new Map<string, any>(
        (orgs || []).map((row: any) => [String(row.id), row])
      );
      const publishedBySchoolId = new Set<string>(
        (publishedLists || [])
          .map((row: any) => String(row?.school_id || '').trim())
          .filter(Boolean)
      );

      const enabled = new Set<string>();
      schoolIds.forEach((schoolId) => {
        const preschoolValue = preschoolsById.get(schoolId)?.settings?.features?.stationery?.enabled;
        const organizationValue = organizationsById.get(schoolId)?.settings?.features?.stationery?.enabled;
        const resolvedValue =
          typeof preschoolValue === 'boolean'
            ? preschoolValue
            : (typeof organizationValue === 'boolean' ? organizationValue : undefined);

        if (resolvedValue === true) {
          enabled.add(schoolId);
          return;
        }
        if (resolvedValue === false) return;
        if (publishedBySchoolId.has(schoolId)) {
          enabled.add(schoolId);
        }
      });
      setFeatureEnabledSchoolIds(Array.from(enabled));
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load stationery checklist');
      setChildren([]);
      setFeatureEnabledSchoolIds([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [academicYear, parentId, supabase, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const eligibleChildren = useMemo(
    () =>
      children.filter((child) => {
        const schoolIds = getChildSchoolIds(child);
        return schoolIds.some((schoolId) => featureEnabledSchoolIds.includes(schoolId));
      }),
    [children, featureEnabledSchoolIds]
  );

  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubPageHeader title="Stationery Checklist" />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={styles.muted}>Loading checklist...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <Ionicons name="checkbox-outline" size={22} color={theme.primary} />
                <Text style={styles.heroTitle}>Track Stationery Per Child</Text>
              </View>
              <Text style={styles.heroSubtitle}>
                Mark bought items, upload optional proof photos, and add notes about what is still needed.
              </Text>
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => { setRefreshing(true); void load(); }}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!error && children.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={24} color={theme.textSecondary} />
                <Text style={styles.muted}>No linked children found yet.</Text>
              </View>
            ) : null}

            {!error && children.length > 0 && eligibleChildren.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="settings-outline" size={24} color={theme.textSecondary} />
                <Text style={styles.muted}>
                  Stationery tracking is currently disabled by your school. Ask the principal/admin to enable it in school settings.
                </Text>
              </View>
            ) : null}

            {!error && eligibleChildren.length > 0 ? (
              <StationeryChecklistSection children={eligibleChildren as any} />
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    keyboardContainer: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 28,
      gap: 14,
    },
    centerBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    heroCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 14,
      backgroundColor: theme.surface,
      gap: 8,
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    heroTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    heroSubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    muted: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
    emptyCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 16,
      backgroundColor: theme.surface,
      gap: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorCard: {
      borderWidth: 1,
      borderColor: '#ef4444',
      borderRadius: 14,
      padding: 14,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      gap: 10,
    },
    errorText: {
      color: '#ef4444',
      fontSize: 13,
      fontWeight: '600',
    },
    retryBtn: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: '#ef4444',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    retryText: {
      color: '#ef4444',
      fontWeight: '700',
      fontSize: 12,
    },
  });
