/**
 * Data Access Tools for Dash AI
 * 
 * Tools for accessing organization data: members, progress, schedule, assignments, stats
 */

import { logger } from '@/lib/logger';
import type { AgentTool } from '../DashToolRegistry';

export function registerDataAccessTools(register: (tool: AgentTool) => void): void {
  
  // Get member/student list
  register({
    name: 'get_member_list',
    description: 'Get list of members (students/employees/athletes) with optional filters by group',
    parameters: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: 'Filter by specific group/class/team ID'
        },
        include_inactive: {
          type: 'boolean',
          description: 'Include inactive members (default: false)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)'
        }
      }
    },
    risk: 'low',
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const profile = await (await import('@/lib/sessionManager')).getCurrentProfile();
        
        if (!profile) {
          return { success: false, error: 'User not authenticated' };
        }

        const orgId = (profile as any).organization_id || (profile as any).preschool_id;
        
        if (!orgId) {
          return { success: false, error: 'No organization found for user' };
        }

        let query = supabase
          .from('students')
          .select('id, first_name, last_name, date_of_birth, classroom_id, status')
          .eq('preschool_id', orgId);

        if (args.group_id) {
          query = query.eq('classroom_id', args.group_id);
        }

        if (!args.include_inactive) {
          query = query.eq('status', 'active');
        }

        query = query.limit(args.limit || 50);

        const { data, error } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          count: data?.length || 0,
          members: data || [],
          organization_id: orgId
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  });

  // Get member progress/grades
  register({
    name: 'get_member_progress',
    description: 'Get detailed progress and performance data for a specific member',
    parameters: {
      type: 'object',
      properties: {
        member_id: {
          type: 'string',
          description: 'ID of the member to get progress for'
        },
        subject: {
          type: 'string',
          description: 'Filter by specific subject (optional)'
        },
        date_range_days: {
          type: 'number',
          description: 'Number of days to look back (default: 30)'
        }
      },
      required: ['member_id']
    },
    risk: 'low',
    execute: async (args) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        
        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id, first_name, last_name, classroom_id')
          .eq('id', args.member_id)
          .single();

        if (studentError || !student) {
          return { success: false, error: 'Member not found' };
        }

        const daysBack = args.date_range_days || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        let gradesQuery = supabase
          .from('grades')
          .select('subject, score, date_recorded, assignment_name')
          .eq('student_id', args.member_id)
          .gte('date_recorded', startDate.toISOString())
          .order('date_recorded', { ascending: false })
          .limit(20);

        if (args.subject) {
          gradesQuery = gradesQuery.eq('subject', args.subject);
        }

        const { data: grades, error: gradesError } = await gradesQuery;

        const avgScore = grades && grades.length > 0
          ? grades.reduce((sum, g) => sum + (g.score || 0), 0) / grades.length
          : null;

        return {
          success: true,
          member: {
            id: student.id,
            name: `${student.first_name} ${student.last_name}`
          },
          progress: {
            average_score: avgScore ? Math.round(avgScore * 10) / 10 : null,
            total_assessments: grades?.length || 0,
            recent_grades: grades || [],
            period_days: daysBack
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  });

  // Get schedule/calendar
  register({
    name: 'get_schedule',
    description: 'Get schedule or calendar events for a date range',
    parameters: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date (ISO format or "today", "tomorrow")'
        },
        days: {
          type: 'number',
          description: 'Number of days to show (default: 7)'
        }
      }
    },
    risk: 'low',
    execute: async (args) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const profile = await (await import('@/lib/sessionManager')).getCurrentProfile();
        
        if (!profile) {
          return { success: false, error: 'User not authenticated' };
        }

        const orgId = (profile as any).organization_id || (profile as any).preschool_id;

        let startDate = new Date();
        if (args.start_date === 'tomorrow') {
          startDate.setDate(startDate.getDate() + 1);
        } else if (args.start_date && args.start_date !== 'today') {
          startDate = new Date(args.start_date);
        }
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (args.days || 7));

        const { data: events, error } = await supabase
          .from('calendar_events')
          .select('id, title, description, event_date, event_type, location')
          .eq('organization_id', orgId)
          .gte('event_date', startDate.toISOString())
          .lte('event_date', endDate.toISOString())
          .order('event_date', { ascending: true })
          .limit(50);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          period: {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
            days: args.days || 7
          },
          events: events || [],
          count: events?.length || 0
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  });

  // Get assignments
  register({
    name: 'get_assignments',
    description: 'Get list of assignments with optional filters',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'submitted', 'graded', 'all'],
          description: 'Filter by assignment status (default: all)'
        },
        subject: {
          type: 'string',
          description: 'Filter by subject'
        },
        days_ahead: {
          type: 'number',
          description: 'Number of days to look ahead (default: 30)'
        }
      }
    },
    risk: 'low',
    execute: async (args) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const profile = await (await import('@/lib/sessionManager')).getCurrentProfile();
        
        if (!profile) {
          return { success: false, error: 'User not authenticated' };
        }

        const orgId = (profile as any).organization_id || (profile as any).preschool_id;

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (args.days_ahead || 30));

        let query = supabase
          .from('assignments')
          .select('id, title, description, subject, due_date, status, points_possible')
          .eq('school_id', orgId)
          .lte('due_date', endDate.toISOString())
          .order('due_date', { ascending: true })
          .limit(50);

        if (args.status && args.status !== 'all') {
          query = query.eq('status', args.status);
        }

        if (args.subject) {
          query = query.eq('subject', args.subject);
        }

        const { data: assignments, error } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          assignments: assignments || [],
          count: assignments?.length || 0,
          filters: {
            status: args.status || 'all',
            subject: args.subject,
            days_ahead: args.days_ahead || 30
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  });

  // Get organization statistics
  register({
    name: 'get_organization_stats',
    description: 'Get comprehensive statistics about the organization (student counts, teacher counts, class counts, etc.)',
    parameters: {
      type: 'object',
      properties: {
        include_inactive: {
          type: 'boolean',
          description: 'Include inactive members (default: false)'
        }
      }
    },
    risk: 'low',
    execute: async (args) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const profile = await (await import('@/lib/sessionManager')).getCurrentProfile();
        
        if (!profile) {
          return { success: false, error: 'User not authenticated' };
        }

        const orgId = (profile as any).organization_id || (profile as any).preschool_id;
        
        if (!orgId) {
          return { success: false, error: 'No organization found for user' };
        }

        const { data: org } = await supabase
          .from('preschools')
          .select('name, city, province')
          .eq('id', orgId)
          .single();

        let studentsQuery = supabase
          .from('students')
          .select('id, status', { count: 'exact', head: true })
          .eq('preschool_id', orgId);
        
        if (!args.include_inactive) {
          studentsQuery = studentsQuery.eq('status', 'active');
        }
        
        const { count: studentCount } = await studentsQuery;

        const { count: teacherCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .or(`preschool_id.eq.${orgId},organization_id.eq.${orgId}`)
          .eq('role', 'teacher');

        const { count: classCount } = await supabase
          .from('classrooms')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', orgId);

        const { data: studentsByStatus } = await supabase
          .from('students')
          .select('status')
          .eq('preschool_id', orgId);

        const statusBreakdown = studentsByStatus?.reduce((acc: any, s: any) => {
          acc[s.status] = (acc[s.status] || 0) + 1;
          return acc;
        }, {});

        return {
          success: true,
          organization: {
            id: orgId,
            name: org?.name || 'Your Organization',
            location: org ? `${org.city}, ${org.province}` : null
          },
          statistics: {
            total_students: studentCount || 0,
            active_students: statusBreakdown?.active || 0,
            total_teachers: teacherCount || 0,
            total_classes: classCount || 0,
            student_status_breakdown: statusBreakdown || {}
          },
          summary: `${org?.name || 'Your organization'} has ${studentCount || 0} ${args.include_inactive ? 'total' : 'active'} students, ${teacherCount || 0} teachers, and ${classCount || 0} classes.`
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  });

  // Analyze class performance
  register({
    name: 'analyze_class_performance',
    description: 'Analyze overall class or group performance with insights',
    parameters: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: 'ID of the class/group to analyze'
        },
        subject: {
          type: 'string',
          description: 'Filter by specific subject (optional)'
        },
        days_back: {
          type: 'number',
          description: 'Number of days to analyze (default: 30)'
        }
      }
    },
    risk: 'low',
    execute: async (args) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const profile = await (await import('@/lib/sessionManager')).getCurrentProfile();
        
        if (!profile) {
          return { success: false, error: 'User not authenticated' };
        }

        const orgId = (profile as any).organization_id || (profile as any).preschool_id;

        let className = 'All Classes';
        if (args.group_id) {
          const { data: classroom } = await supabase
            .from('classrooms')
            .select('name')
            .eq('id', args.group_id)
            .single();
          if (classroom) {
            className = classroom.name;
          }
        }

        let studentsQuery = supabase
          .from('students')
          .select('id, first_name, last_name')
          .eq('preschool_id', orgId)
          .eq('status', 'active');

        if (args.group_id) {
          studentsQuery = studentsQuery.eq('classroom_id', args.group_id);
        }

        const { data: students } = await studentsQuery;

        if (!students || students.length === 0) {
          return { success: false, error: 'No students found in group' };
        }

        const daysBack = args.days_back || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        const studentIds = students.map(s => s.id);

        let gradesQuery = supabase
          .from('grades')
          .select('student_id, subject, score, date_recorded')
          .in('student_id', studentIds)
          .gte('date_recorded', startDate.toISOString());

        if (args.subject) {
          gradesQuery = gradesQuery.eq('subject', args.subject);
        }

        const { data: grades } = await gradesQuery;

        const totalGrades = grades?.length || 0;
        const avgScore = grades && grades.length > 0
          ? grades.reduce((sum, g) => sum + (g.score || 0), 0) / grades.length
          : 0;

        const studentScores = new Map<string, number[]>();
        grades?.forEach(g => {
          if (!studentScores.has(g.student_id)) {
            studentScores.set(g.student_id, []);
          }
          studentScores.get(g.student_id)?.push(g.score || 0);
        });

        const strugglingStudents = [];
        for (const [studentId, scores] of studentScores) {
          const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
          if (avg < 60) {
            const student = students.find(s => s.id === studentId);
            if (student) {
              strugglingStudents.push({
                id: studentId,
                name: `${student.first_name} ${student.last_name}`,
                average: Math.round(avg * 10) / 10
              });
            }
          }
        }

        return {
          success: true,
          group: {
            id: args.group_id,
            name: className,
            student_count: students.length
          },
          performance: {
            average_score: Math.round(avgScore * 10) / 10,
            total_assessments: totalGrades,
            period_days: daysBack,
            subject: args.subject || 'all subjects'
          },
          insights: {
            struggling_students: strugglingStudents,
            needs_attention: strugglingStudents.length > 0
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  });
}
