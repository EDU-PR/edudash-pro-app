import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { useOrganizationTerminology } from '@/lib/hooks/useOrganizationTerminology';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface StudentRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  parent_id: string | null;
  guardian_id: string | null;
  classes?: {
    id?: string | null;
    name?: string | null;
    teacher_id?: string | null;
  } | null;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role?: string | null;
}

interface ThreadParticipant {
  user_id: string;
  role: string;
}

interface ThreadRow {
  id: string;
  student_id?: string | null;
  type?: string | null;
  message_participants?: ThreadParticipant[] | null;
}

type TabKey = 'parents' | 'teachers';

export default function PrincipalNewMessageScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { terminology } = useOrganizationTerminology();
  const { showAlert, alertProps } = useAlertModal();

  const organizationId =
    (profile as any)?.organization_membership?.organization_id ||
    profile?.organization_id ||
    profile?.preschool_id ||
    null;
  const [activeTab, setActiveTab] = useState<TabKey>('parents');
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [parentMap, setParentMap] = useState<Record<string, ProfileRow>>({});
  const [teacherMap, setTeacherMap] = useState<Record<string, ProfileRow>>({});
  const [selectedParentStudentId, setSelectedParentStudentId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  const loadDirectory = useCallback(async () => {
    if (!organizationId) {
      return;
    }
    setLoading(true);
    try {
      const { data: studentRows, error } = await assertSupabase()
        .from('students')
        .select('id, first_name, last_name, parent_id, guardian_id, classes(id, name, teacher_id)')
        .or(`preschool_id.eq.${organizationId},organization_id.eq.${organizationId}`)
        .eq('status', 'active')
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;

      const normalizedStudents = (studentRows || []) as StudentRow[];
      setStudents(normalizedStudents);

      const parentIds = Array.from(new Set(
        normalizedStudents
          .map((student) => student.parent_id || student.guardian_id)
          .filter(Boolean) as string[]
      ));

      const teacherIds = Array.from(new Set(
        normalizedStudents
          .map((student) => student.classes?.teacher_id)
          .filter(Boolean) as string[]
      ));

      if (parentIds.length > 0) {
        const { data: parents } = await assertSupabase()
          .from('profiles')
          .select('id, first_name, last_name, role')
          .in('id', parentIds);
        const map: Record<string, ProfileRow> = {};
        (parents || []).forEach((row) => {
          map[row.id] = row as ProfileRow;
        });
        setParentMap(map);
      }

      if (teacherIds.length > 0) {
        const { data: teachers } = await assertSupabase()
          .from('profiles')
          .select('id, first_name, last_name, role')
          .in('id', teacherIds);
        const map: Record<string, ProfileRow> = {};
        (teachers || []).forEach((row) => {
          map[row.id] = row as ProfileRow;
        });
        setTeacherMap(map);
      }
    } catch (err) {
      showAlert({
        title: t('common.error', { defaultValue: 'Error' }),
        message: err instanceof Error ? err.message : t('principal.directoryError', { defaultValue: 'Failed to load contacts.' }),
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, t]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const parentOptions = useMemo(() => (
    students.filter((student) => student.parent_id || student.guardian_id)
  ), [students]);

  const teacherOptions = useMemo(() => {
    const uniqueTeachers: ProfileRow[] = [];
    const seen = new Set<string>();
    Object.values(teacherMap).forEach((teacher) => {
      if (!seen.has(teacher.id)) {
        uniqueTeachers.push(teacher);
        seen.add(teacher.id);
      }
    });
    return uniqueTeachers;
  }, [teacherMap]);

  const findExistingThread = useCallback(async (payload: { studentId?: string | null; type: string; participantIds: string[] }) => {
    if (!organizationId) return null;
    const { data } = await assertSupabase()
      .from('message_threads')
      .select('id, student_id, type, message_participants(user_id, role)')
      .eq('preschool_id', organizationId)
      .eq('type', payload.type)
      .eq('student_id', payload.studentId ?? null);

    const threads = (data as ThreadRow[] | null) || [];
    const match = threads.find((thread) => {
      const participants = thread.message_participants || [];
      const ids = new Set(participants.map((participant) => participant.user_id));
      return payload.participantIds.every((id) => ids.has(id));
    });
    return match?.id || null;
  }, [organizationId]);

  const createThread = useCallback(async (payload: { studentId?: string | null; type: string; subject: string; participantIds: Array<{ id: string; role: string }> }) => {
    if (!user?.id || !organizationId) return null;

    const existingId = await findExistingThread({
      studentId: payload.studentId,
      type: payload.type,
      participantIds: payload.participantIds.map((p) => p.id),
    });
    if (existingId) return existingId;

    const supabase = assertSupabase();
    const { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .insert({
        preschool_id: organizationId,
        created_by: user.id,
        subject: payload.subject,
        type: payload.type,
        student_id: payload.studentId ?? null,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (threadError) throw threadError;

    const threadId = thread?.id as string;
    await supabase.from('message_participants').insert(
      payload.participantIds.map((participant) => ({
        thread_id: threadId,
        user_id: participant.id,
        role: participant.role,
      }))
    );

    return threadId;
  }, [findExistingThread, organizationId, user?.id]);

  const handleStartParentMessage = useCallback(async () => {
    const selectedStudent = parentOptions.find((student) => student.id === selectedParentStudentId) || null;
    if (!selectedStudent) {
      showAlert({
        title: t('principal.selectParentTitle', { defaultValue: `Select a ${terminology.guardian}` }),
        message: t('principal.selectParentMessage', { defaultValue: 'Choose a family to message.' }),
      });
      return;
    }

    const parentId = selectedStudent.parent_id || selectedStudent.guardian_id;
    if (!parentId || !user?.id) return;

    const parent = parentMap[parentId];
    const parentName = parent ? `${parent.first_name || ''} ${parent.last_name || ''}`.trim() : terminology.guardian;
    const subject = `${parentName} • ${selectedStudent.first_name || ''} ${selectedStudent.last_name || ''}`.trim();

    try {
      const threadId = await createThread({
        studentId: selectedStudent.id,
        type: 'parent-principal',
        subject: subject || t('principal.parentMessageSubject', { defaultValue: 'Parent Message' }),
        participantIds: [
          { id: user.id, role: 'principal' },
          { id: parentId, role: 'parent' },
        ],
      });
      if (!threadId) return;
      router.replace({
        pathname: '/screens/principal-message-thread',
        params: { threadId, title: parentName },
      });
    } catch (err) {
      showAlert({
        title: t('common.error', { defaultValue: 'Error' }),
        message: err instanceof Error ? err.message : t('principal.threadCreateError', { defaultValue: 'Unable to start message.' }),
      });
    }
  }, [createThread, parentMap, parentOptions, selectedParentStudentId, t, terminology.guardian, user?.id]);

  const handleStartTeacherMessage = useCallback(async () => {
    if (!user?.id) return;
    const teacher = teacherOptions.find((item) => item.id === selectedTeacherId) || null;
    if (!teacher) {
      showAlert({
        title: t('principal.selectTeacherTitle', { defaultValue: `Select a ${terminology.instructor}` }),
        message: t('principal.selectTeacherMessage', { defaultValue: 'Choose a teacher to message.' }),
      });
      return;
    }

    try {
      const subject = `${terminology.instructor} • ${teacher.first_name || ''} ${teacher.last_name || ''}`.trim();
      const threadId = await createThread({
        studentId: null,
        type: 'general',
        subject: subject || t('principal.teacherMessageSubject', { defaultValue: 'Teacher Message' }),
        participantIds: [
          { id: user?.id || '', role: 'principal' },
          { id: teacher.id, role: 'teacher' },
        ],
      });
      if (!threadId) return;
      const teacherName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || terminology.instructor;
      router.replace({
        pathname: '/screens/principal-message-thread',
        params: { threadId, title: teacherName },
      });
    } catch (err) {
      showAlert({
        title: t('common.error', { defaultValue: 'Error' }),
        message: err instanceof Error ? err.message : t('principal.threadCreateError', { defaultValue: 'Unable to start message.' }),
      });
    }
  }, [createThread, selectedTeacherId, t, teacherOptions, terminology.instructor, user?.id]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight || 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      marginLeft: 12,
    },
    tabs: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 10,
    },
    tabActive: {
      backgroundColor: theme.primary,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    tabTextActive: {
      color: theme.onPrimary,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
    },
    cardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '12',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary + '22',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    meta: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    cta: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
    },
    ctaText: {
      color: theme.onPrimary,
      fontWeight: '600',
      fontSize: 15,
    },
    empty: {
      alignItems: 'center',
      padding: 24,
    },
    emptyText: {
      marginTop: 12,
      color: theme.textSecondary,
      textAlign: 'center',
    },
  }), [insets.top, theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('principal.newMessageTitle', { defaultValue: 'Start a conversation' })}
        </Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'parents' && styles.tabActive]}
          onPress={() => setActiveTab('parents')}
        >
          <Text style={[styles.tabText, activeTab === 'parents' && styles.tabTextActive]}>
            {terminology.guardians}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'teachers' && styles.tabActive]}
          onPress={() => setActiveTab('teachers')}
        >
          <Text style={[styles.tabText, activeTab === 'teachers' && styles.tabTextActive]}>
            {terminology.instructors}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading && (
          <View style={styles.empty}>
            <EduDashSpinner color={theme.primary} />
            <Text style={styles.emptyText}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
          </View>
        )}

        {!loading && activeTab === 'parents' && parentOptions.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>
              {t('principal.noParentsYet', { defaultValue: 'No linked parents yet.' })}
            </Text>
          </View>
        )}

        {!loading && activeTab === 'teachers' && teacherOptions.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>
              {t('principal.noTeachersYet', { defaultValue: 'No teachers available yet.' })}
            </Text>
          </View>
        )}

        {!loading && activeTab === 'parents' && parentOptions.map((student) => {
          const parentId = student.parent_id || student.guardian_id || '';
          const parent = parentMap[parentId];
          const parentName = parent
            ? `${parent.first_name || ''} ${parent.last_name || ''}`.trim()
            : terminology.guardian;
          const isSelected = student.id === selectedParentStudentId;
          return (
            <TouchableOpacity
              key={student.id}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => setSelectedParentStudentId(student.id)}
            >
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={{ color: theme.primary, fontWeight: '700' }}>
                    {(student.first_name || 'P')[0]}{(student.last_name || '')[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{parentName}</Text>
                  <Text style={styles.meta}>
                    {student.first_name} {student.last_name}
                    {student.classes?.name ? ` • ${student.classes.name}` : ''}
                  </Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color={theme.primary} />}
              </View>
            </TouchableOpacity>
          );
        })}

        {!loading && activeTab === 'teachers' && teacherOptions.map((teacher) => {
          const isSelected = teacher.id === selectedTeacherId;
          const teacherName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim();
          return (
            <TouchableOpacity
              key={teacher.id}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => setSelectedTeacherId(teacher.id)}
            >
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={{ color: theme.primary, fontWeight: '700' }}>
                    {(teacher.first_name || 'T')[0]}{(teacher.last_name || '')[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{teacherName || terminology.instructor}</Text>
                  <Text style={styles.meta}>{t('principal.teacherLabel', { defaultValue: 'Teacher' })}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color={theme.primary} />}
              </View>
            </TouchableOpacity>
          );
        })}

        {!loading && activeTab === 'parents' && parentOptions.length > 0 && (
          <TouchableOpacity style={styles.cta} onPress={handleStartParentMessage}>
            <Text style={styles.ctaText}>{t('principal.startMessage', { defaultValue: 'Start message' })}</Text>
          </TouchableOpacity>
        )}

        {!loading && activeTab === 'teachers' && teacherOptions.length > 0 && (
          <TouchableOpacity style={styles.cta} onPress={handleStartTeacherMessage}>
            <Text style={styles.ctaText}>{t('principal.startMessage', { defaultValue: 'Start message' })}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <AlertModal {...alertProps} />
    </View>
  );
}
