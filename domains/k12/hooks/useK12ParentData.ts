/**
 * K-12 Parent Dashboard Data Hook
 * 
 * Fetches children, attendance, homework, and events data for the K-12 parent dashboard.
 * Includes realtime subscription for attendance updates.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { fetchParentChildren } from '@/lib/parent-children';
import { sanitizeAvatarUrl } from '@/lib/utils/avatar';
import type { Child } from '@/domains/k12/components/K12ParentChildCard';

export interface RecentUpdate {
  id: string;
  type: string;
  child: string;
  message: string;
  time: string;
  icon: string;
  color: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  time: string;
}

// Avatar colors for children (cycle through these)
const avatarColors = ['#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

// Format time ago helper
export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'Just now';
};

export function useK12ParentData(profileId: string | undefined, organizationId: string | undefined) {
  const [children, setChildren] = useState<Child[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<RecentUpdate[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const childrenIdsRef = useRef<string[]>([]);

  const fetchChildrenData = useCallback(async () => {
    // profileId is the internal profile.id (NOT auth user.id!)
    if (!profileId) return;
    
    try {
      setDataLoading(true);
      const supabase = assertSupabase();
      
      // Fetch children linked to this parent (supports multiple parents per child)
      // NOTE: fetchParentChildren expects profile.id, NOT auth user.id
      const studentsData = await fetchParentChildren(profileId, {
        includeInactive: false,
        schoolId: organizationId || undefined,
      });

      if (!studentsData || studentsData.length === 0) {
        setChildren([]);
        setDataLoading(false);
        return;
      }

      // Build child cards with metrics
      const childCards: Child[] = await Promise.all(
        studentsData.map(async (student: any, index: number) => {
          let attendance = 0;
          let pendingAssignments = 0;
          let avgGrade = '--';

          try {
            // Get attendance percentage (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const { data: attendanceData } = await supabase
              .from('attendance')
              .select('status')
              .eq('student_id', student.id)
              .gte('attendance_date', thirtyDaysAgo);

            if (attendanceData && attendanceData.length > 0) {
              const present = attendanceData.filter((a: any) => 
                String(a.status).toLowerCase() === 'present'
              ).length;
              attendance = Math.round((present / attendanceData.length) * 100);
            }

            // Get pending homework
            if (student.class_id) {
              const { data: assignments } = await supabase
                .from('homework_assignments')
                .select('id')
                .eq('class_id', student.class_id)
                .gte('due_date', new Date().toISOString());

              if (assignments && assignments.length > 0) {
                const assignmentIds = assignments.map((a: any) => a.id);
                const { data: submissions } = await supabase
                  .from('homework_submissions')
                  .select('assignment_id')
                  .eq('student_id', student.id)
                  .in('assignment_id', assignmentIds);

                const submittedSet = new Set((submissions || []).map((s: any) => s.assignment_id));
                pendingAssignments = assignmentIds.filter((id: string) => !submittedSet.has(id)).length;
              }
            }

            // Get average grade from recent submissions
            const { data: gradedSubmissions } = await supabase
              .from('homework_submissions')
              .select('grade')
              .eq('student_id', student.id)
              .not('grade', 'is', null)
              .order('submitted_at', { ascending: false })
              .limit(10);

            if (gradedSubmissions && gradedSubmissions.length > 0) {
              const avg = gradedSubmissions.reduce((sum: number, s: any) => sum + (s.grade || 0), 0) / gradedSubmissions.length;
              avgGrade = avg >= 90 ? 'A' : avg >= 80 ? 'B+' : avg >= 70 ? 'B' : avg >= 60 ? 'C+' : avg >= 50 ? 'C' : 'D';
            }
          } catch (err) {
            console.warn('[K12 Dashboard] Error fetching metrics for child:', err);
          }

          const gradeLevel = (student.classes as any)?.grade_level || student.grade || '';
          const displayGrade = gradeLevel ? `Grade ${gradeLevel}` : 'Not assigned';

          return {
            id: student.id,
            name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
            grade: displayGrade,
            avatar: (student.first_name?.[0] || 'S').toUpperCase(),
            avatarUrl: sanitizeAvatarUrl(student.avatar_url ?? null),
            avgGrade,
            attendance: attendance || 0,
            pendingAssignments,
            color: avatarColors[index % avatarColors.length],
            dateOfBirth: student.date_of_birth,
            classId: student.class_id,
            className: (student.classes as any)?.name,
          };
        })
      );

      setChildren(childCards);

      // Fetch recent updates (attendance, grades, messages)
      const updates: RecentUpdate[] = [];
      
      // Recent attendance
      const studentIds = studentsData.map((s: any) => s.id);
      const { data: recentAttendance } = await supabase
        .from('attendance')
        .select('id, student_id, status, attendance_date, created_at')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false })
        .limit(3);

      recentAttendance?.forEach((att: any) => {
        const child = childCards.find(c => c.id === att.student_id);
        if (child) {
          const status = String(att.status).toLowerCase();
          updates.push({
            id: `att-${att.id}`,
            type: 'attendance',
            child: child.name.split(' ')[0],
            message: `Marked ${status} on ${new Date(att.attendance_date).toLocaleDateString()}`,
            time: formatTimeAgo(att.created_at),
            icon: status === 'present' ? 'checkmark-circle' : 'close-circle',
            color: status === 'present' ? '#10B981' : '#EF4444',
          });
        }
      });

      setRecentUpdates(updates.slice(0, 5));

      // Fetch upcoming events
      const { data: eventsData } = await supabase
        .from('school_events')
        .select('id, title, start_date, all_day')
        .eq('preschool_id', organizationId)
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(5);

      if (eventsData && eventsData.length > 0) {
        setUpcomingEvents(
          eventsData.map((event: any) => {
            const startDate = new Date(event.start_date);
            return {
              id: event.id,
              title: event.title,
              date: startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              time: event.all_day
                ? 'All day'
                : startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            };
          })
        );
      } else {
        setUpcomingEvents([]);
      }

    } catch (error) {
      console.error('[K12 Dashboard] Error fetching data:', error);
    } finally {
      setDataLoading(false);
    }
  }, [profileId, organizationId]);

  // Set up realtime subscription for attendance updates
  useEffect(() => {
    if (!profileId || childrenIdsRef.current.length === 0) return;
    
    const supabase = assertSupabase();
    const studentIds = childrenIdsRef.current;
    
    // Subscribe to attendance changes for the parent's children
    const channel = supabase
      .channel(`parent-attendance-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'attendance',
        },
        (payload) => {
          const studentId = (payload.new as any)?.student_id || (payload.old as any)?.student_id;
          // Only refresh if the attendance is for one of the parent's children
          if (studentIds.includes(studentId)) {
            logger.debug('K12Dashboard', 'Attendance updated for child:', studentId);
            fetchChildrenData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, fetchChildrenData]);

  // Update childrenIdsRef when children change
  useEffect(() => {
    childrenIdsRef.current = children.map(c => c.id);
  }, [children]);

  return {
    children,
    recentUpdates,
    upcomingEvents,
    dataLoading,
    fetchChildrenData,
  };
}
