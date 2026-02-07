/**
 * Comprehensive Student Management System
 * Age-appropriate for preschools vs K-12 schools
 * 
 * Features:
 * - Student list with filtering by age groups
 * - Age-appropriate grouping (preschool vs primary/secondary)
 * - Student details with proper context
 * - Real database integration
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, RefreshControl, Modal, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { assertSupabase } from '@/lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import ClassPlacementService from '@/lib/services/ClassPlacementService';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface Student {
  id: string;
  student_id?: string | null;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  date_of_birth: string | null;
  age_months: number;
  age_years: number;
  preschool_id: string;
  class_id: string | null;
  parent_id: string | null;
  guardian_id: string | null;
  is_active: boolean;
  status: string;
  age_group_name?: string;
  class_name?: string;
  parent_name?: string;
}

interface SchoolInfo {
  id: string;
  name: string;
  school_type: 'preschool' | 'primary' | 'secondary' | 'combined';
  grade_levels: string[];
}

interface AgeGroup {
  id: string;
  name: string;
  min_age_months: number;
  max_age_months: number;
  age_min: number;
  age_max: number;
  school_type: string;
  description: string;
}

interface FilterOptions {
  searchTerm: string;
  ageGroup: string;
  status: string;
  classId: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getStudentInitials(student: Pick<Student, 'first_name' | 'last_name'>): string {
  return `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase() || 'ST';
}

function buildPrintableStudentIdCardsHtml(params: {
  schoolName?: string | null;
  schoolType?: string | null;
  students: Student[];
}): string {
  const { schoolName, schoolType, students } = params;
  const safeSchool = escapeHtml(schoolName?.trim() || 'EduDash Pro School');
  const safeType = escapeHtml((schoolType || 'school').toUpperCase());
  const generatedAt = new Date().toLocaleString();

  const cards = students.map((student) => {
    const fullName = escapeHtml(`${student.first_name} ${student.last_name}`.trim());
    const studentCode = escapeHtml((student.student_id || student.id || '').toUpperCase().slice(0, 18));
    const className = escapeHtml(student.class_name || student.age_group_name || 'Unassigned');
    const parentName = escapeHtml(student.parent_name || 'Not linked');
    const ageText = `${student.age_years}y`;
    const initials = escapeHtml(getStudentInitials(student));
    const avatarUrl = student.avatar_url ? escapeHtml(student.avatar_url) : '';
    const status = escapeHtml((student.status || 'active').toUpperCase());

    return `
      <article class="card">
        <div class="hole"></div>
        <div class="ribbon"></div>
        <header class="card-top">
          <div class="school">${safeSchool}</div>
          <div class="type">${safeType}</div>
        </header>
        <div class="body">
          <div class="avatar-wrap">
            ${
              avatarUrl
                ? `<img class="avatar" src="${avatarUrl}" alt="${fullName}" />`
                : `<div class="avatar-fallback">${initials}</div>`
            }
          </div>
          <div class="meta">
            <div class="name">${fullName}</div>
            <div class="row">ID: <strong>${studentCode || 'N/A'}</strong></div>
            <div class="row">Class: <strong>${className}</strong></div>
            <div class="row">Age: <strong>${escapeHtml(ageText)}</strong></div>
            <div class="row">Guardian: <strong>${parentName}</strong></div>
          </div>
        </div>
        <footer class="footer">
          <span class="status">${status}</span>
          <span class="serial">#${escapeHtml(student.id.slice(0, 8).toUpperCase())}</span>
        </footer>
      </article>
    `;
  }).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Student ID Cards</title>
        <style>
          :root {
            --card-w: 85.6mm;
            --card-h: 54mm;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Avenir Next", "Segoe UI", sans-serif;
            background: #eef3ff;
            color: #0f172a;
          }
          .page {
            padding: 10mm;
          }
          .page-header {
            margin-bottom: 8mm;
          }
          .title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.02em;
          }
          .subtitle {
            color: #334155;
            font-size: 12px;
            margin-top: 4px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(var(--card-w), 1fr));
            gap: 6mm;
          }
          .card {
            width: var(--card-w);
            min-height: var(--card-h);
            border-radius: 14px;
            background: linear-gradient(135deg, #0b1730 0%, #1e3a8a 65%, #1d4ed8 100%);
            color: #f8fafc;
            padding: 10px 10px 8px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 10px 22px rgba(2, 6, 23, 0.35);
          }
          .hole {
            position: absolute;
            right: 10px;
            top: 9px;
            width: 12px;
            height: 12px;
            border-radius: 999px;
            border: 2px solid rgba(255,255,255,0.35);
            background: rgba(2, 6, 23, 0.45);
          }
          .ribbon {
            position: absolute;
            right: -24px;
            top: -16px;
            width: 92px;
            height: 92px;
            border-radius: 999px;
            background: radial-gradient(circle at center, rgba(250,204,21,0.24), rgba(250,204,21,0) 70%);
          }
          .card-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            gap: 8px;
          }
          .school {
            font-size: 10px;
            font-weight: 700;
            line-height: 1.2;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            max-width: 70%;
          }
          .type {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.03em;
            background: rgba(59,130,246,0.35);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 999px;
            padding: 2px 6px;
            white-space: nowrap;
          }
          .body {
            display: flex;
            gap: 8px;
          }
          .avatar-wrap {
            width: 56px;
            min-width: 56px;
            height: 56px;
            border-radius: 12px;
            background: rgba(255,255,255,0.16);
            border: 1px solid rgba(255,255,255,0.3);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .avatar {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .avatar-fallback {
            font-size: 18px;
            font-weight: 800;
            color: #e2e8f0;
          }
          .meta {
            flex: 1;
            min-width: 0;
          }
          .name {
            font-size: 12px;
            font-weight: 800;
            margin-bottom: 3px;
            line-height: 1.2;
          }
          .row {
            font-size: 9.5px;
            line-height: 1.25;
            opacity: 0.95;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .footer {
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px solid rgba(255,255,255,0.28);
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            font-size: 9px;
          }
          .status {
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.25);
            background: rgba(5,150,105,0.25);
          }
          .serial {
            letter-spacing: 0.08em;
            font-weight: 700;
            opacity: 0.9;
          }
          @media print {
            body {
              background: #fff;
            }
            .page {
              padding: 0;
            }
            .page-header {
              margin: 0 0 6mm 0;
            }
            .title {
              font-size: 16px;
            }
            .subtitle {
              font-size: 10px;
            }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="page-header">
            <div class="title">Student ID Tags</div>
            <div class="subtitle">${safeSchool} • ${students.length} cards • Generated ${escapeHtml(generatedAt)}</div>
          </header>
          <section class="grid">${cards}</section>
        </main>
      </body>
    </html>
  `;
}

export default function StudentManagementScreen() {
  const { user, profile, profileLoading, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Guard against React StrictMode double-invoke in development
  const navigationAttempted = useRef(false);

  // Handle organization id from enhanced profile, membership fallback, and legacy metadata.
  const orgId =
    profile?.organization_id ||
    (profile as any)?.preschool_id ||
    (profile as any)?.organization_membership?.organization_id ||
    (profile as any)?.organization_membership?.preschool_id ||
    (user?.user_metadata as any)?.organization_id ||
    (user?.user_metadata as any)?.preschool_id ||
    null;
  
  // Wait for auth and profile to finish loading before making routing decisions
  const isStillLoading = authLoading || profileLoading;

  const [students, setStudents] = useState<Student[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [, setAgeGroups] = useState<AgeGroup[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    searchTerm: '',
    ageGroup: '',
    status: '',
    classId: '',
  });

  // CONSOLIDATED NAVIGATION EFFECT: Single source of truth for all routing decisions
  useEffect(() => {
    // Skip if still loading data
    if (isStillLoading) return;
    
    // Guard against double navigation (React StrictMode in dev)
    if (navigationAttempted.current) return;
    
    // Decision 1: No user -> sign in
    if (!user) {
      navigationAttempted.current = true;
      try { 
        router.replace('/(auth)/sign-in'); 
      } catch (e) {
        try { router.replace('/sign-in'); } catch { /* Intentional: non-fatal */ }
      }
      return;
    }
    
    // Decision 2: User exists but no organization -> onboarding
    if (!orgId) {
      navigationAttempted.current = true;
      console.log('Student Management: No school found, redirecting to onboarding', {
        profile,
        organization_id: profile?.organization_id,
        preschool_id: (profile as any)?.preschool_id,
      });
      try { 
        router.replace('/screens/principal-onboarding'); 
      } catch (e) {
        console.debug('Redirect to onboarding failed', e);
      }
      return;
    }
    
    // Decision 3: All good, stay on screen (no navigation needed)
  }, [isStillLoading, user, orgId, profile]);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    
    try {
      setLoading(true);

      // Use orgId from profile (already resolved)
      const preschoolId = orgId;

      // Get school information
      const { data: school } = await assertSupabase()
        .from('preschools')
        .select('id, name, school_type, grade_levels')
        .eq('id', preschoolId)
        .single();

      setSchoolInfo(school);

      // Get age groups appropriate for this school type
      const { data: ageGroupsData } = await assertSupabase()
        .from('age_groups')
        .select('id, name, min_age_months, max_age_months, age_min, age_max, school_type, description')
        .eq('school_type', school?.school_type || 'preschool')
        .eq('is_active', true)
        .order('min_age_months');

      setAgeGroups(ageGroupsData || []);

      // Get classes for this school
      const { data: classesData } = await assertSupabase()
        .from('classes')
        .select('id, name, grade_level, teacher_id')
        .eq('preschool_id', preschoolId)
        .eq('active', true)
        .order('name');

      setClasses(classesData || []);

      // Get students with comprehensive information
      const { data: studentsData, error: studentsError } = await assertSupabase()
        .from('students')
        .select(`
          id,
          student_id,
          first_name,
          last_name,
          avatar_url,
          date_of_birth,
          preschool_id,
          class_id,
          parent_id,
          guardian_id,
          is_active,
          status,
          classes (name)
        `)
        .eq('preschool_id', preschoolId)
        .eq('is_active', true)
        .order('first_name');

      if (studentsError) {
        console.error('Students query error:', studentsError);
      }

      // Fetch parent names separately to avoid relationship issues
      const parentIds = [...new Set((studentsData || [])
        .map((s: any) => s.parent_id || s.guardian_id)
        .filter(Boolean))];
      
      let parentMap: Record<string, string> = {};
      if (parentIds.length > 0) {
        const { data: parents } = await assertSupabase()
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', parentIds);
        parentMap = (parents || []).reduce((acc: any, p: any) => {
          acc[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim();
          return acc;
        }, {});
      }

      // Process student data with age calculations and appropriate grouping
      const processedStudents = (studentsData || []).map((student: any) => {
        const ageInfo = calculateAgeInfo(student.date_of_birth);
        const ageGroup = findAgeGroup(ageInfo.age_months, ageGroupsData || []);
        const parentId = student.parent_id || student.guardian_id;
        const className = student.classes?.name || undefined;
        
        return {
          ...student,
          student_id: student.student_id || null,
          avatar_url: student.avatar_url || null,
          age_months: ageInfo.age_months,
          age_years: ageInfo.age_years,
          // If DOB doesn't map to an age group, fall back to the assigned class name
          age_group_name: ageGroup?.name || className,
          class_name: className,
          parent_name: parentId ? parentMap[parentId] : undefined,
        };
      });

      setStudents(processedStudents);
      
    } catch (error) {
      console.error('Error fetching student data:', error);
      Alert.alert('Error', 'Failed to load student information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  const calculateAgeInfo = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return { age_months: 0, age_years: 0 };
    
    const birth = new Date(dateOfBirth);
    const today = new Date();
    
    const totalMonths = (today.getFullYear() - birth.getFullYear()) * 12 + 
                       (today.getMonth() - birth.getMonth());
    const years = Math.floor(totalMonths / 12);
    
    return {
      age_months: Math.max(0, totalMonths),
      age_years: years
    };
  };

  const findAgeGroup = (ageMonths: number, ageGroups: AgeGroup[]) => {
    return ageGroups.find(group => 
      ageMonths >= group.min_age_months && 
      ageMonths <= group.max_age_months
    );
  };

  const formatAge = (ageMonths: number, ageYears: number, schoolType: string) => {
    if (schoolType === 'preschool') {
      if (ageYears < 2) {
        return `${ageMonths} months`;
      } else {
        const remainingMonths = ageMonths % 12;
        return remainingMonths > 0 
          ? `${ageYears}y ${remainingMonths}m`
          : `${ageYears} years`;
      }
    } else {
      return `${ageYears} years`;
    }
  };

  const getAgeGroupColor = (ageGroupName: string | undefined, schoolType: string) => {
    if (!ageGroupName) return '#9CA3AF';
    
    if (schoolType === 'preschool') {
      switch (ageGroupName) {
        case 'Toddlers': return '#EC4899'; // Pink for toddlers
        case 'Preschool 3-4': return '#8B5CF6'; // Purple for 3-4 year olds
        case 'Preschool 4-5': return '#3B82F6'; // Blue for 4-5 year olds
        case 'Pre-K (Reception)': return '#059669'; // Green for school readiness
        default: return '#6B7280';
      }
    } else {
      // Primary/Secondary color coding by phase
      if (ageGroupName?.includes('Grade R') || ageGroupName?.includes('Grade 1-3')) return '#059669';
      if (ageGroupName?.includes('Grade 4-6')) return '#3B82F6';
      if (ageGroupName?.includes('Grade 7-9')) return '#8B5CF6';
      if (ageGroupName?.includes('Grade 10-12')) return '#DC2626';
      return '#6B7280';
    }
  };

  const filteredStudents = students.filter(student => {
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      if (!fullName.includes(searchLower)) return false;
    }
    
    if (filters.ageGroup) {
      if (filters.ageGroup === 'Unassigned') {
        if (student.age_group_name) return false; // Hide students with age groups
      } else {
        if (student.age_group_name !== filters.ageGroup) return false;
      }
    }
    if (filters.status && student.status !== filters.status) return false;
    if (filters.classId && student.class_id !== filters.classId) return false;
    
    return true;
  });

  const getSchoolTypeDisplay = (schoolType: string) => {
    switch (schoolType) {
      case 'preschool': return 'Pre-School';
      case 'primary': return 'Primary School';
      case 'secondary': return 'Secondary School';
      case 'combined': return 'Combined School';
      default: return 'School';
    }
  };

  const getAgeGroupStats = () => {
    const stats: Record<string, number> = {};
    filteredStudents.forEach(student => {
      const group = student.age_group_name || 'Unassigned';
      stats[group] = (stats[group] || 0) + 1;
    });
    return stats;
  };

  // Load data when screen is focused (ensures updates after returning)
  useFocusEffect(
    useCallback(() => {
      if (orgId && user) {
        fetchData();
      }
      return undefined;
    }, [orgId, user?.id, fetchData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const handlePrintIdCards = useCallback(async () => {
    if (filteredStudents.length === 0) {
      Alert.alert('No students', 'There are no student cards to print.');
      return;
    }

    try {
      const html = buildPrintableStudentIdCardsHtml({
        schoolName: schoolInfo?.name,
        schoolType: schoolInfo?.school_type,
        students: filteredStudents,
      });

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Student ID Cards',
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.error('Failed to print student cards:', error);
      Alert.alert('Print failed', 'Could not generate printable student cards.');
    }
  }, [filteredStudents, schoolInfo?.name, schoolInfo?.school_type]);

  const handleAutoAssignByDob = () => {
    if (!orgId) {
      Alert.alert('No school found', 'Please complete setup before auto-assigning students.');
      return;
    }

    const candidates = students.filter(student => !student.class_id && Boolean(student.date_of_birth));
    if (candidates.length === 0) {
      Alert.alert('Nothing to assign', 'No students without a class and a valid date of birth.');
      return;
    }

    Alert.alert(
      'Auto-assign by DOB',
      `Assign classes for ${candidates.length} student${candidates.length === 1 ? '' : 's'} based on date of birth? This will only fill missing class assignments.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          onPress: async () => {
            setAutoAssigning(true);
            let updated = 0;
            let skipped = 0;
            let failed = 0;

            for (const student of candidates) {
              try {
                const suggestion = await ClassPlacementService.suggestClassForStudent({
                  organizationId: orgId,
                  dateOfBirth: student.date_of_birth,
                });

                if (!suggestion?.classId) {
                  skipped += 1;
                  continue;
                }

                const { error } = await assertSupabase()
                  .from('students')
                  .update({ class_id: suggestion.classId })
                  .eq('id', student.id);

                if (error) {
                  console.warn('Auto-assign update failed', { studentId: student.id, error });
                  failed += 1;
                } else {
                  updated += 1;
                }
              } catch (error) {
                console.warn('Auto-assign failed', { studentId: student.id, error });
                failed += 1;
              }
            }

            await fetchData();
            setAutoAssigning(false);

            Alert.alert(
              'Auto-assign complete',
              `Assigned: ${updated}\nSkipped: ${skipped}\nFailed: ${failed}`
            );
          },
        },
      ]
    );
  };

  const handleStudentPress = (student: Student) => {
    router.push(`/screens/student-detail?studentId=${student.id}`);
  };

  const handleAddStudent = () => {
    router.push('/screens/student-enrollment');
  };

  // Show loading state while auth/profile is loading
  if (isStillLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t('dashboard.loading_profile', { defaultValue: 'Loading your profile...' })}</Text>
        </View>
      </View>
    );
  }

  // Show redirect message if no organization after loading is complete
  if (!orgId) {
    if (!user) {
      return (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={styles.loadingText}>{t('dashboard.loading_profile', { defaultValue: 'Loading your profile...' })}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.loadingText}>{t('dashboard.no_school_found_redirect', { defaultValue: 'No school found. Redirecting to setup...' })}</Text>
          <TouchableOpacity onPress={() => {
            try { router.replace('/screens/principal-onboarding'); } catch (e) { console.debug('Redirect failed', e); }
          }}>
            <Text style={[styles.loadingText, { color: theme.primary, textDecorationLine: 'underline', marginTop: 12 }]}>{t('common.go_now', { defaultValue: 'Go Now' })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.loadingText}>{t('student_management.loading', { defaultValue: 'Loading students...' })}</Text>
        </View>
      </View>
    );
  }

  const ageGroupStats = getAgeGroupStats();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{t('student_management.title', { defaultValue: 'Student Management' })}</Text>
            <Text style={styles.headerSubtitle}>
              {schoolInfo?.name} • {getSchoolTypeDisplay(schoolInfo?.school_type || 'preschool')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.filterButton}>
            <Ionicons name="filter" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{filteredStudents.length}</Text>
            <Text style={styles.statLabel}>{t('student_management.total_students', { defaultValue: 'Total Students' })}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{Object.keys(ageGroupStats).length}</Text>
            <Text style={styles.statLabel}>{t('student_management.age_groups', { defaultValue: 'Age Groups' })}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{classes.length}</Text>
            <Text style={styles.statLabel}>{t('student_management.classes', { defaultValue: 'Classes' })}</Text>
          </View>
        </View>
      </View>

      {/* Search + Actions */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('student_management.search_placeholder', { defaultValue: 'Search students...' })}
            placeholderTextColor={theme.textSecondary}
            value={filters.searchTerm}
            onChangeText={(text) => setFilters({...filters, searchTerm: text})}
          />
          {filters.searchTerm ? (
            <TouchableOpacity onPress={() => setFilters({...filters, searchTerm: ''})} style={styles.searchIcon}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}
          <Ionicons name="search-outline" size={18} color={theme.textSecondary} style={styles.searchIcon} />
        </View>
      </View>

      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={[styles.autoAssignButton, autoAssigning ? styles.autoAssignButtonDisabled : null]}
          onPress={handleAutoAssignByDob}
          disabled={autoAssigning}
        >
          <Ionicons name="sparkles-outline" size={16} color={theme.onPrimary} style={styles.autoAssignIcon} />
          <Text style={styles.autoAssignButtonText}>
            {autoAssigning ? 'Assigning...' : 'Auto-assign DOB'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.printCardsButton}
          onPress={handlePrintIdCards}
        >
          <Ionicons name="print-outline" size={16} color={theme.text} style={styles.autoAssignIcon} />
          <Text style={styles.printCardsButtonText}>Print ID Cards</Text>
        </TouchableOpacity>
      </View>

      {/* Age Group Overview for Preschools */}
      {schoolInfo?.school_type === 'preschool' && Object.keys(ageGroupStats).length > 0 && (
        <View style={styles.ageGroupOverview}>
          <Text style={styles.sectionTitle}>Age Group Distribution</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.ageGroupsRow}>
              {Object.entries(ageGroupStats).map(([groupName, count]) => (
                <TouchableOpacity
                  key={groupName}
                  style={[
                    styles.ageGroupChip,
                    { backgroundColor: getAgeGroupColor(groupName, schoolInfo.school_type) + '20' },
                    { borderColor: getAgeGroupColor(groupName, schoolInfo.school_type) }
                  ]}
                  onPress={() => {
                    const newFilter = filters.ageGroup === groupName ? '' : groupName;
                    setFilters({...filters, ageGroup: newFilter});
                  }}
                >
                  <Text style={[
                    styles.ageGroupName,
                    { color: getAgeGroupColor(groupName, schoolInfo.school_type) }
                  ]}>
                    {groupName}
                  </Text>
                  <Text style={styles.ageGroupCount}>{count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Students List */}
      <ScrollView
        style={styles.studentsList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredStudents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>
              {students.length === 0 ? 'No Students Enrolled' : 'No Students Match Filters'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {students.length === 0
                ? `Add your first student to this ${getSchoolTypeDisplay(schoolInfo?.school_type || 'preschool').toLowerCase()}`
                : 'Try adjusting your search or filter criteria'
              }
            </Text>
            {students.length === 0 && (
              <TouchableOpacity style={styles.addButton} onPress={handleAddStudent}>
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.addButtonText}>Add Student</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.studentsGrid}>
            {filteredStudents.map((student) => {
                const statusKey = String(student.status || 'active').toLowerCase();
                const statusTone =
                  statusKey === 'inactive'
                    ? { bg: '#DC262622', border: '#DC262655', text: '#B91C1C' }
                    : statusKey === 'pending'
                    ? { bg: '#F59E0B22', border: '#F59E0B55', text: '#B45309' }
                    : { bg: '#05966922', border: '#05966955', text: '#047857' };

                return (
                  <TouchableOpacity
                    key={student.id}
                    style={styles.studentCard}
                    onPress={() => handleStudentPress(student)}
                  >
                    <View style={styles.idTagPunchHole} />
                    <View style={styles.idTagGlow} />
                    <View style={styles.studentHeader}>
                      <View style={styles.studentAvatarShell}>
                        {student.avatar_url ? (
                          <Image source={{ uri: student.avatar_url }} style={styles.studentAvatarImage} />
                        ) : (
                          <View style={[
                            styles.studentAvatar,
                            { backgroundColor: getAgeGroupColor(student.age_group_name, schoolInfo?.school_type || 'preschool') }
                          ]}>
                            <Text style={styles.studentInitials}>
                              {getStudentInitials(student)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.studentInfo}>
                        <Text style={styles.studentName} numberOfLines={1}>
                          {student.first_name} {student.last_name}
                        </Text>
                        <Text style={styles.studentAge}>
                          {formatAge(student.age_months, student.age_years, schoolInfo?.school_type || 'preschool')}
                        </Text>
                      </View>
                      <View style={styles.studentIdBadge}>
                        <Text style={styles.studentIdBadgeText}>
                          {(student.student_id || student.id).slice(0, 8).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.studentDetails}>
                      {student.age_group_name && (
                        <View style={[
                          styles.ageGroupBadge,
                          { backgroundColor: getAgeGroupColor(student.age_group_name, schoolInfo?.school_type || 'preschool') + '20' }
                        ]}>
                          <Text style={[
                            styles.ageGroupBadgeText,
                            { color: getAgeGroupColor(student.age_group_name, schoolInfo?.school_type || 'preschool') }
                          ]}>
                            {student.age_group_name}
                          </Text>
                        </View>
                      )}
                      
                      {student.class_name && (
                        <Text style={styles.classInfo}>📚 {student.class_name}</Text>
                      )}
                      
                      {student.parent_name && (
                        <Text style={styles.parentInfo}>👨‍👩‍👧‍👦 {student.parent_name}</Text>
                      )}
                    </View>

                    <View style={styles.studentCardFooter}>
                      <View style={[styles.statusPill, { backgroundColor: statusTone.bg, borderColor: statusTone.border }]}>
                        <Text style={[styles.statusPillText, { color: statusTone.text }]}>
                          {(student.status || 'active').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.cardSerialText}>#{student.id.slice(0, 8).toUpperCase()}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Student FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleAddStudent}>
        <Ionicons name="add" size={24} color={theme.onPrimary} />
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.filterModal}>
          <View style={styles.filterHeader}>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Text style={styles.filterCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.filterTitle}>Filter Students</Text>
            <TouchableOpacity 
              onPress={() => {
                setFilters({searchTerm: '', ageGroup: '', status: '', classId: ''});
                setShowFilters(false);
              }}
            >
              <Text style={styles.filterClear}>Clear</Text>
            </TouchableOpacity>
          </View>
          
          {/* Filter options would go here */}
          <ScrollView style={styles.filterContent}>
            <Text style={styles.filterNote}>
              Filter by age group, class, or status to find specific students.
              {schoolInfo?.school_type === 'preschool' 
                ? ' Age groups are designed for developmental stages.'
                : ' Grades follow the South African education system.'
              }
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.textSecondary,
  },
  header: {
    backgroundColor: theme.primary,
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    marginRight: 10,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.onPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.onPrimary + 'CC',
    marginTop: 2,
  },
  filterButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.onPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: theme.onPrimary + 'CC',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: theme.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  autoAssignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    minHeight: 40,
  },
  autoAssignIcon: {
    marginRight: 6,
  },
  autoAssignButtonDisabled: {
    opacity: 0.6,
  },
  autoAssignButtonText: {
    color: theme.onPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  printCardsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    minHeight: 40,
  },
  printCardsButtonText: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '600',
  },
  ageGroupOverview: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  ageGroupsRow: {
    flexDirection: 'row',
    paddingRight: 20,
  },
  ageGroupChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  ageGroupName: {
    fontSize: 14,
    fontWeight: '600',
  },
  ageGroupCount: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  studentsList: {
    flex: 1,
  },
  studentsGrid: {
    padding: 20,
    paddingTop: 0,
  },
  studentCard: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border + 'AA',
    shadowColor: theme.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  idTagPunchHole: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.text + '30',
    backgroundColor: theme.background,
    zIndex: 2,
  },
  idTagGlow: {
    position: 'absolute',
    right: -16,
    top: -12,
    width: 86,
    height: 86,
    borderRadius: 999,
    backgroundColor: theme.primary + '1F',
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentAvatarShell: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.surfaceVariant || theme.primary + '18',
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.border + '88',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarImage: {
    width: '100%',
    height: '100%',
  },
  studentAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentInitials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  studentAge: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  studentIdBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.primary + '66',
    backgroundColor: theme.primary + '12',
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 104,
  },
  studentIdBadgeText: {
    color: theme.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  studentDetails: {
    gap: 8,
    marginBottom: 10,
  },
  ageGroupBadge: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ageGroupBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  classInfo: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  parentInfo: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  studentCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.border + '80',
    paddingTop: 8,
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: '#05966922',
    borderWidth: 1,
    borderColor: '#05966955',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusPillText: {
    color: '#047857',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardSerialText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textSecondary,
    letterSpacing: 0.8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  addButtonText: {
    color: theme.onPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.shadow || '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  filterModal: {
    flex: 1,
    backgroundColor: theme.background,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  filterCancel: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  filterClear: {
    fontSize: 16,
    color: theme.primary,
    fontWeight: '600',
  },
  filterContent: {
    flex: 1,
    padding: 20,
  },
  filterNote: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
});
