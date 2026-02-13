/**
 * Learning Progress Tool
 * 
 * Provides Dash AI access to student learning progress data.
 * Tracks mastery levels, identifies gaps, and recommends next steps.
 * 
 * **Features:**
 * - Track concept mastery across subjects
 * - Identify learning gaps and strengths
 * - Generate progress reports
 * - Recommend next learning steps
 * - Compare performance to curriculum benchmarks
 * 
 * **Security:**
 * - Students see their own progress
 * - Parents see their children's progress
 * - Teachers see their students' progress
 * - Principals see school-wide aggregates
 * - All data respects RLS policies
 */

import { Tool, ToolCategory, RiskLevel, ToolParameter, ToolExecutionContext, ToolExecutionResult } from '../types';
import { assertSupabase } from '@/lib/supabase';
import { hasCapability, resolveCapabilityTier } from '@/lib/ai/capabilities';
import type { Tier } from '@/lib/ai/capabilities';

// Progress report types
const REPORT_TYPES = [
  'overview',        // General progress summary
  'subject_detail',  // Detailed subject breakdown
  'topic_mastery',   // Topic-level mastery tracking
  'time_analysis',   // Study time and patterns
  'recommendations', // AI-powered recommendations
  'comparison',      // Benchmark comparisons
] as const;

// Time periods for analysis
const TIME_PERIODS = [
  'week',      // Last 7 days
  'month',     // Last 30 days
  'term',      // Current school term
  'year',      // Academic year
  'all_time',  // All historical data
] as const;

export const LearningProgressTool: Tool = {
  id: 'learning_progress',
  name: 'Learning Progress Tracker',
  description: 'Track and analyze student learning progress. View mastery levels, identify learning gaps, and get personalized recommendations for improvement. Supports progress reports for students, parents, and teachers.',
  category: 'analysis' as ToolCategory,
  riskLevel: 'low' as RiskLevel,
  
  allowedRoles: ['superadmin', 'principal', 'teacher', 'parent', 'student'],
  requiredTier: undefined, // Basic features available to all
  
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: 'Type of progress query',
      required: true,
      enum: ['get_progress', 'get_gaps', 'get_strengths', 'get_recommendations', 'get_report'],
    },
    {
      name: 'student_id',
      type: 'string',
      description: 'Student ID (optional for students viewing own progress)',
      required: false,
    },
    {
      name: 'subject',
      type: 'string',
      description: 'Filter by subject (Mathematics, English, etc.)',
      required: false,
    },
    {
      name: 'grade',
      type: 'string',
      description: 'Grade level (R, 1-12)',
      required: false,
    },
    {
      name: 'time_period',
      type: 'string',
      description: 'Time period for analysis',
      required: false,
      enum: [...TIME_PERIODS],
    },
    {
      name: 'report_type',
      type: 'string',
      description: 'Type of progress report',
      required: false,
      enum: [...REPORT_TYPES],
    },
    {
      name: 'include_goals',
      type: 'boolean',
      description: 'Include learning goals in response',
      required: false,
    },
    {
      name: 'include_benchmarks',
      type: 'boolean',
      description: 'Include curriculum benchmarks comparison',
      required: false,
    },
  ] as ToolParameter[],
  
  claudeToolDefinition: {
    name: 'learning_progress',
    description: 'Track and analyze student learning progress. Get mastery levels, identify gaps and strengths, receive personalized recommendations. Students view their own progress; parents and teachers view their learners.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['get_progress', 'get_gaps', 'get_strengths', 'get_recommendations', 'get_report'],
          description: 'Type of progress query',
        },
        student_id: {
          type: 'string',
          description: 'Student ID (optional for own progress)',
        },
        subject: {
          type: 'string',
          description: 'Filter by subject',
        },
        grade: {
          type: 'string',
          description: 'Grade level (R, 1-12)',
        },
        time_period: {
          type: 'string',
          enum: [...TIME_PERIODS],
          description: 'Time period for analysis',
        },
        report_type: {
          type: 'string',
          enum: [...REPORT_TYPES],
          description: 'Type of progress report',
        },
        include_goals: {
          type: 'boolean',
          description: 'Include learning goals',
        },
        include_benchmarks: {
          type: 'boolean',
          description: 'Include benchmark comparisons',
        },
      },
      required: ['action'],
    },
  },
  
  execute: async (
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> => {
    try {
      const { 
        action, 
        student_id, 
        subject, 
        grade, 
        time_period, 
        report_type,
        include_goals,
        include_benchmarks 
      } = params;
      
      const userTier = resolveCapabilityTier(context.tier || 'free') as Tier;
      const supabase = assertSupabase();
      
      // Determine target student
      let targetStudentId = student_id || context.userId;
      
      // Permission check: Students can only view their own progress
      if (context.role === 'student' && student_id && student_id !== context.userId) {
        return {
          success: false,
          error: 'Students can only view their own learning progress.',
          metadata: { toolId: 'learning_progress' },
        };
      }
      
      // Check for advanced features
      if (include_benchmarks && !hasCapability(userTier, 'insights.learning')) {
        return {
          success: false,
          error: 'Benchmark comparisons require Premium subscription.',
          metadata: { requiredTier: 'premium', feature: 'insights.learning' },
        };
      }
      
      switch (action) {
        case 'get_progress': {
          // Query learning progress data
          let query = supabase
            .from('student_progress')
            .select(`
              *,
              subject:subjects(name, code),
              topic:topics(title, curriculum_code)
            `)
            .eq('student_id', targetStudentId);
          
          if (subject) {
            query = query.eq('subject', subject);
          }
          
          if (grade) {
            query = query.eq('grade', grade);
          }
          
          // Apply time filter
          if (time_period && time_period !== 'all_time') {
            const cutoffDate = getTimePeriodCutoff(time_period);
            query = query.gte('updated_at', cutoffDate.toISOString());
          }
          
          const { data, error } = await query.limit(100);
          
          if (error) {
            // If table doesn't exist, return simulated progress
            if (error.code === '42P01') {
              return generateSimulatedProgress(targetStudentId, subject, grade);
            }
            return {
              success: false,
              error: `Failed to fetch progress: ${error.message}`,
            };
          }
          
          // Calculate summary statistics
          const summary = calculateProgressSummary(data || []);
          
          return {
            success: true,
            data: {
              progress: data,
              summary,
              period: time_period || 'all_time',
            },
            metadata: { 
              toolId: 'learning_progress',
              recordCount: data?.length || 0,
            },
          };
        }
        
        case 'get_gaps': {
          // Identify learning gaps (areas below mastery threshold)
          const gapsData = await identifyLearningGaps(
            supabase,
            targetStudentId,
            subject,
            grade
          );
          
          return {
            success: true,
            data: {
              gaps: gapsData.gaps,
              recommendations: gapsData.recommendations,
              priorityOrder: gapsData.priorityOrder,
            },
            metadata: { toolId: 'learning_progress' },
          };
        }
        
        case 'get_strengths': {
          // Identify strengths (areas above mastery threshold)
          const strengthsData = await identifyStrengths(
            supabase,
            targetStudentId,
            subject,
            grade
          );
          
          return {
            success: true,
            data: {
              strengths: strengthsData.strengths,
              topPerformingAreas: strengthsData.topAreas,
              potentialAdvancedTopics: strengthsData.advancedSuggestions,
            },
            metadata: { toolId: 'learning_progress' },
          };
        }
        
        case 'get_recommendations': {
          // AI-powered learning recommendations
          if (!hasCapability(userTier, 'student.progress')) {
            return {
              success: false,
              error: 'Learning recommendations require Starter subscription or higher.',
              metadata: { requiredTier: 'starter', feature: 'student.progress' },
            };
          }
          
          const recommendations = await generateLearningRecommendations(
            supabase,
            targetStudentId,
            subject,
            grade
          );
          
          return {
            success: true,
            data: recommendations,
            metadata: { toolId: 'learning_progress' },
          };
        }
        
        case 'get_report': {
          // Generate comprehensive progress report
          const reportData = await generateProgressReport(
            supabase,
            targetStudentId,
            report_type || 'overview',
            subject,
            grade,
            time_period || 'month',
            include_goals || false
          );
          
          return {
            success: true,
            data: reportData,
            metadata: { 
              toolId: 'learning_progress',
              reportType: report_type || 'overview',
            },
          };
        }
        
        default:
          return {
            success: false,
            error: `Unknown action: ${action}. Valid actions: get_progress, get_gaps, get_strengths, get_recommendations, get_report`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Learning progress error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { toolId: 'learning_progress' },
      };
    }
  },
};

// Helper functions

function getTimePeriodCutoff(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'term':
      // Approximate 3 months
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(0);
  }
}

function calculateProgressSummary(progressData: any[]): Record<string, any> {
  if (!progressData.length) {
    return {
      totalTopics: 0,
      averageMastery: 0,
      masteredCount: 0,
      inProgressCount: 0,
      notStartedCount: 0,
    };
  }
  
  const masteryScores = progressData.map(p => p.mastery_score || 0);
  const avgMastery = masteryScores.reduce((a, b) => a + b, 0) / masteryScores.length;
  
  return {
    totalTopics: progressData.length,
    averageMastery: Math.round(avgMastery),
    masteredCount: progressData.filter(p => (p.mastery_score || 0) >= 80).length,
    inProgressCount: progressData.filter(p => (p.mastery_score || 0) >= 30 && (p.mastery_score || 0) < 80).length,
    notStartedCount: progressData.filter(p => (p.mastery_score || 0) < 30).length,
  };
}

function generateSimulatedProgress(studentId: string, subject?: string, grade?: string): ToolExecutionResult {
  // Return structured guidance when no actual data exists
  return {
    success: true,
    data: {
      progress: [],
      summary: {
        totalTopics: 0,
        averageMastery: 0,
        masteredCount: 0,
        inProgressCount: 0,
        notStartedCount: 0,
      },
      message: 'No learning progress data recorded yet. Progress will be tracked as you complete lessons, quizzes, and assignments.',
      suggestions: [
        'Complete a quiz in your subject to start tracking progress',
        'Work through practice problems in the Exam Prep section',
        'Ask Dash to generate practice exercises for you',
      ],
    },
    metadata: { 
      toolId: 'learning_progress',
      simulated: true,
    },
  };
}

async function identifyLearningGaps(
  supabase: any,
  studentId: string,
  subject?: string,
  grade?: string
): Promise<{ gaps: any[]; recommendations: string[]; priorityOrder: string[] }> {
  // Query for topics with low mastery
  const { data: lowMasteryTopics } = await supabase
    .from('student_progress')
    .select('*')
    .eq('student_id', studentId)
    .lt('mastery_score', 50)
    .order('mastery_score', { ascending: true })
    .limit(10);
    
  const gaps = lowMasteryTopics || [];
  
  // Generate recommendations based on gaps
  const recommendations = gaps.map((gap: any) => 
    `Review ${gap.topic_title || gap.topic}: Current mastery ${gap.mastery_score}%`
  );
  
  // Priority order (lowest mastery first)
  const priorityOrder = gaps.map((gap: any) => gap.topic_id || gap.id);
  
  return { gaps, recommendations, priorityOrder };
}

async function identifyStrengths(
  supabase: any,
  studentId: string,
  subject?: string,
  grade?: string
): Promise<{ strengths: any[]; topAreas: string[]; advancedSuggestions: string[] }> {
  // Query for topics with high mastery
  const { data: highMasteryTopics } = await supabase
    .from('student_progress')
    .select('*')
    .eq('student_id', studentId)
    .gte('mastery_score', 80)
    .order('mastery_score', { ascending: false })
    .limit(10);
    
  const strengths = highMasteryTopics || [];
  
  const topAreas = strengths.map((s: any) => s.topic_title || s.topic);
  
  const advancedSuggestions = topAreas.slice(0, 3).map((area: string) =>
    `Consider advanced challenges in ${area}`
  );
  
  return { strengths, topAreas, advancedSuggestions };
}

async function generateLearningRecommendations(
  supabase: any,
  studentId: string,
  subject?: string,
  grade?: string
): Promise<Record<string, any>> {
  // Get current progress
  const { data: progress } = await supabase
    .from('student_progress')
    .select('*')
    .eq('student_id', studentId)
    .limit(50);
    
  if (!progress || progress.length === 0) {
    return {
      nextSteps: [
        'Start with foundational topics in your grade level',
        'Take a diagnostic quiz to assess your current knowledge',
        'Set up learning goals for this term',
      ],
      focusAreas: [],
      studyPlan: 'Begin with basic concepts and build progressively',
    };
  }
  
  // Analyze and recommend
  const lowMastery = progress.filter((p: any) => (p.mastery_score || 0) < 50);
  const mediumMastery = progress.filter((p: any) => (p.mastery_score || 0) >= 50 && (p.mastery_score || 0) < 80);
  
  return {
    nextSteps: [
      lowMastery.length > 0 
        ? `Focus on ${lowMastery.length} topics that need more practice`
        : 'Great progress! Try more challenging problems',
      'Practice for 20-30 minutes daily for best results',
      'Review your notes before attempting new exercises',
    ],
    focusAreas: lowMastery.slice(0, 5).map((p: any) => ({
      topic: p.topic_title || p.topic,
      currentMastery: p.mastery_score,
      suggestedAction: 'Review and practice',
    })),
    reinforcementAreas: mediumMastery.slice(0, 3).map((p: any) => ({
      topic: p.topic_title || p.topic,
      currentMastery: p.mastery_score,
      suggestedAction: 'Practice to solidify understanding',
    })),
    estimatedTimeToMastery: `${Math.ceil(lowMastery.length * 2)} hours of focused study`,
  };
}

async function generateProgressReport(
  supabase: any,
  studentId: string,
  reportType: string,
  subject?: string,
  grade?: string,
  timePeriod?: string,
  includeGoals?: boolean
): Promise<Record<string, any>> {
  // Fetch student info
  const { data: student } = await supabase
    .from('profiles')
    .select('full_name, display_name')
    .eq('id', studentId)
    .single();
    
  // Fetch progress data
  const { data: progress } = await supabase
    .from('student_progress')
    .select('*')
    .eq('student_id', studentId)
    .limit(100);
    
  const summary = calculateProgressSummary(progress || []);
  
  const report: Record<string, any> = {
    studentName: student?.full_name || student?.display_name || 'Student',
    reportType,
    generatedAt: new Date().toISOString(),
    period: timePeriod || 'month',
    summary,
  };
  
  // Add report-type specific data
  switch (reportType) {
    case 'overview':
      report.highlights = [
        summary.masteredCount > 0 ? `Mastered ${summary.masteredCount} topics` : null,
        summary.averageMastery > 70 ? 'Excellent overall progress!' : null,
        summary.inProgressCount > 0 ? `${summary.inProgressCount} topics in progress` : null,
      ].filter(Boolean);
      break;
      
    case 'subject_detail':
      // Group by subject
      const bySubject: Record<string, any[]> = {};
      (progress || []).forEach((p: any) => {
        const subj = p.subject || 'General';
        if (!bySubject[subj]) bySubject[subj] = [];
        bySubject[subj].push(p);
      });
      report.bySubject = Object.entries(bySubject).map(([name, items]) => ({
        subject: name,
        topicCount: items.length,
        averageMastery: Math.round(
          items.reduce((a: number, b: any) => a + (b.mastery_score || 0), 0) / items.length
        ),
      }));
      break;
      
    case 'recommendations':
      const recs = await generateLearningRecommendations(supabase, studentId, subject, grade);
      report.recommendations = recs;
      break;

    case 'time_analysis': {
      // Analyze study time patterns from quiz sessions and conversations
      const { data: sessions } = await supabase
        .from('dash_quiz_sessions')
        .select('created_at, completed_at, subject, total_questions, correct_answers')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (sessions?.length) {
        const sessionDurations = sessions
          .filter((s: any) => s.completed_at)
          .map((s: any) => ({
            date: s.created_at,
            duration_min: Math.round(
              (new Date(s.completed_at).getTime() - new Date(s.created_at).getTime()) / 60000,
            ),
            subject: s.subject || 'General',
            accuracy: s.total_questions > 0
              ? Math.round((s.correct_answers / s.total_questions) * 100)
              : 0,
          }));

        const totalMinutes = sessionDurations.reduce((a: number, b: any) => a + b.duration_min, 0);
        const avgAccuracy = sessionDurations.length > 0
          ? Math.round(sessionDurations.reduce((a: number, b: any) => a + b.accuracy, 0) / sessionDurations.length)
          : 0;

        report.timeAnalysis = {
          totalStudyMinutes: totalMinutes,
          sessionsCompleted: sessionDurations.length,
          avgSessionDuration: Math.round(totalMinutes / (sessionDurations.length || 1)),
          avgAccuracy,
          recentSessions: sessionDurations.slice(0, 10),
          studyPattern: totalMinutes > 300 ? 'consistent' : totalMinutes > 100 ? 'moderate' : 'needs_more',
        };
      } else {
        report.timeAnalysis = { message: 'No study session data available yet' };
      }
      break;
    }

    case 'comparison': {
      // Compare student performance to class/grade benchmarks
      const { data: orgMembers } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', (await supabase.auth.getUser()).data?.user?.user_metadata?.organization_id)
        .eq('role', 'student')
        .limit(100);

      const studentIds = (orgMembers || []).map((m: any) => m.id);

      if (studentIds.length > 1) {
        const { data: allProgress } = await supabase
          .from('student_progress')
          .select('student_id, mastery_score, subject')
          .in('student_id', studentIds)
          .limit(500);

        const classMastery = (allProgress || []).map((p: any) => p.mastery_score || 0);
        const classAvg = classMastery.length > 0
          ? Math.round(classMastery.reduce((a: number, b: number) => a + b, 0) / classMastery.length)
          : 0;

        report.comparison = {
          classAverage: classAvg,
          studentAverage: summary.averageMastery,
          percentile: classMastery.length > 0
            ? Math.round(
                (classMastery.filter((m: number) => m <= summary.averageMastery).length /
                  classMastery.length) * 100,
              )
            : 50,
          totalClassmates: studentIds.length - 1,
          standout: summary.averageMastery > classAvg + 10 ? 'above_average' :
                    summary.averageMastery < classAvg - 10 ? 'needs_support' : 'on_track',
        };
      } else {
        report.comparison = { message: 'Not enough classmates for comparison' };
      }
      break;
    }
  }
  
  if (includeGoals) {
    // Fetch learning goals if available
    const { data: goals } = await supabase
      .from('learning_goals')
      .select('*')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .limit(5);
      
    report.activeGoals = goals || [];
  }
  
  return report;
}

export default LearningProgressTool;
