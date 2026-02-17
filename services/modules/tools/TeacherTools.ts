/**
 * Teacher AI Tools for Dash AI
 *
 * Tools empowering teachers with AI-driven teaching strategies,
 * homework generation, and batch grading capabilities.
 *
 * Tools:
 *   - generate_teaching_strategy — pedagogy advisor (Bloom's, ZPD, differentiation)
 *   - generate_homework         — AI homework/assignment creator with CAPS alignment
 *   - batch_grade_submissions   — grade multiple student submissions at once
 *
 * ≤500 lines per WARP.md
 */

import { getDefaultModelIdForTier } from '@/lib/ai/modelForTier';
import { logger } from '@/lib/logger';
import type { AgentTool } from '../DashToolRegistry';

// ─── Teaching Strategy Tool ──────────────────────────────────────────────────

function buildStrategyTool(): AgentTool {
  return {
    name: 'generate_teaching_strategy',
    description:
      'Generate a differentiated teaching strategy for a specific topic. ' +
      'Returns a structured lesson approach with Bloom\'s taxonomy alignment, ' +
      'scaffolding levels (below/at/above grade), formative assessment ideas, ' +
      'and South African CAPS alignment where applicable.',
    parameters: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Subject area (e.g., Mathematics, Life Skills, English)',
        },
        topic: {
          type: 'string',
          description: 'Specific topic or concept to teach',
        },
        grade: {
          type: 'string',
          description: 'Grade level (e.g., Grade R, Grade 1, Grade 7)',
        },
        learner_challenges: {
          type: 'string',
          description:
            'Optional: Known learner difficulties or misconceptions to address',
        },
        class_size: {
          type: 'number',
          description: 'Optional: Number of learners in class for grouping strategies',
        },
        duration_minutes: {
          type: 'number',
          description: 'Optional: Lesson duration in minutes (default 30)',
        },
      },
      required: ['subject', 'topic', 'grade'],
    },
    risk: 'low',
    execute: async (args, context?) => {
      try {
        const tier = (context as any)?.tier ?? 'free';
        const model = getDefaultModelIdForTier(tier);
        const duration = args.duration_minutes || 30;

        const prompt = [
          `You are a master South African ECD/K-12 pedagogy advisor.`,
          `Generate a structured teaching strategy for:`,
          `- Subject: ${args.subject}`,
          `- Topic: ${args.topic}`,
          `- Grade: ${args.grade}`,
          `- Duration: ${duration} minutes`,
          args.learner_challenges
            ? `- Known challenges: ${args.learner_challenges}`
            : '',
          args.class_size
            ? `- Class size: ${args.class_size} learners`
            : '',
          '',
          'Return JSON with this structure:',
          '{',
          '  "topic": "...",',
          '  "blooms_level": "remember|understand|apply|analyze|evaluate|create",',
          '  "learning_objectives": ["..."],',
          '  "introduction": { "activity": "...", "duration_min": 5, "resources": ["..."] },',
          '  "scaffolding": {',
          '    "below_grade": { "approach": "...", "activities": ["..."] },',
          '    "at_grade": { "approach": "...", "activities": ["..."] },',
          '    "above_grade": { "approach": "...", "activities": ["..."] }',
          '  },',
          '  "formative_assessment": ["..."],',
          '  "differentiation_tips": ["..."],',
          '  "caps_alignment": "...",',
          '  "resources_needed": ["..."]',
          '}',
        ]
          .filter(Boolean)
          .join('\n');

        // Call AI proxy for strategy generation
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-proxy`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              scope: 'teacher',
              service_type: 'lesson_generation',
              payload: { prompt, model },
            }),
          },
        );

        if (!response.ok) {
          throw new Error(`AI proxy returned ${response.status}`);
        }

        const result = await response.json();
        const content = result?.content || result?.text || '';

        // Try to extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return { success: true, result: JSON.parse(jsonMatch[0]) };
          } catch {
            // Return as text if JSON parsing fails
          }
        }

        return { success: true, result: { strategy: content } };
      } catch (error) {
        logger.error('[TeacherTools] generate_teaching_strategy failed', { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Strategy generation failed',
        };
      }
    },
  };
}

// ─── Homework Generation Tool ────────────────────────────────────────────────

function buildHomeworkTool(): AgentTool {
  return {
    name: 'generate_homework',
    description:
      'Generate a homework assignment with questions, rubric, and answer key. ' +
      'Supports multiple question types: multiple_choice, short_answer, fill_blank, ' +
      'matching, true_false, essay. CAPS-aligned with difficulty tiers.',
    parameters: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Subject area',
        },
        topic: {
          type: 'string',
          description: 'Specific topic or chapter',
        },
        grade: {
          type: 'string',
          description: 'Grade level',
        },
        num_questions: {
          type: 'number',
          description: 'Number of questions (default: 5, max: 20)',
        },
        question_types: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Types of questions: multiple_choice, short_answer, fill_blank, true_false, matching, essay',
        },
        difficulty: {
          type: 'string',
          description: 'easy, medium, hard, or mixed (default: mixed)',
        },
        include_rubric: {
          type: 'boolean',
          description: 'Include scoring rubric (default: true)',
        },
        include_answer_key: {
          type: 'boolean',
          description: 'Include answer key (default: true)',
        },
      },
      required: ['subject', 'topic', 'grade'],
    },
    risk: 'low',
    execute: async (args, context?) => {
      try {
        const tier = (context as any)?.tier ?? 'free';
        const model = getDefaultModelIdForTier(tier);
        const numQ = Math.min(args.num_questions || 5, 20);
        const types = args.question_types?.join(', ') || 'multiple_choice, short_answer';
        const difficulty = args.difficulty || 'mixed';

        const prompt = [
          `You are an expert South African curriculum specialist.`,
          `Generate a homework assignment:`,
          `- Subject: ${args.subject}`,
          `- Topic: ${args.topic}`,
          `- Grade: ${args.grade}`,
          `- Questions: ${numQ}`,
          `- Types: ${types}`,
          `- Difficulty: ${difficulty}`,
          '',
          'Return JSON:',
          '{',
          '  "title": "...",',
          '  "instructions": "...",',
          '  "estimated_time_minutes": 30,',
          '  "questions": [',
          '    {',
          '      "number": 1,',
          '      "type": "multiple_choice",',
          '      "question": "...",',
          '      "options": ["A", "B", "C", "D"],',
          '      "correct_answer": "B",',
          '      "difficulty": "easy",',
          '      "blooms_level": "understand",',
          '      "marks": 2,',
          '      "explanation": "..."',
          '    }',
          '  ],',
          args.include_rubric !== false
            ? '  "rubric": { "total_marks": 20, "criteria": [...] },'
            : '',
          args.include_answer_key !== false
            ? '  "answer_key": [...],'
            : '',
          '  "caps_alignment": "..."',
          '}',
        ]
          .filter(Boolean)
          .join('\n');

        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-proxy`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              scope: 'teacher',
              service_type: 'homework_generation',
              payload: { prompt, model },
            }),
          },
        );

        if (!response.ok) throw new Error(`AI proxy returned ${response.status}`);
        const result = await response.json();
        const content = result?.content || result?.text || '';

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return { success: true, result: JSON.parse(jsonMatch[0]) };
          } catch {
            // fall through
          }
        }
        return { success: true, result: { homework: content } };
      } catch (error) {
        logger.error('[TeacherTools] generate_homework failed', { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Homework generation failed',
        };
      }
    },
  };
}

// ─── Batch Grading Tool ──────────────────────────────────────────────────────

function buildBatchGradeTool(): AgentTool {
  return {
    name: 'batch_grade_submissions',
    description:
      'Grade multiple student submissions against rubric criteria. ' +
      'Provides per-student scores, feedback, common mistakes summary, ' +
      'and class-level analytics.',
    parameters: {
      type: 'object',
      properties: {
        assignment_id: {
          type: 'string',
          description: 'The assignment/homework ID to grade submissions for',
        },
        rubric: {
          type: 'string',
          description:
            'Grading rubric or criteria (if not embedded in assignment)',
        },
        max_submissions: {
          type: 'number',
          description: 'Maximum submissions to grade in this batch (default: 10)',
        },
      },
      required: ['assignment_id'],
    },
    risk: 'medium',
    execute: async (args, context?) => {
      try {
        const tier = (context as any)?.tier ?? 'free';
        const { GradingEngine } = await import('@/lib/services/GradingEngine');
        const result = await GradingEngine.batchGrade({
          assignmentId: args.assignment_id,
          rubric: args.rubric,
          maxSubmissions: args.max_submissions,
          tier,
        });

        return {
          success: true,
          result: {
            graded: result.graded,
            total_submissions: result.totalSubmissions,
            grades: result.grades,
            class_summary: result.classSummary,
          },
        };
      } catch (error) {
        logger.error('[TeacherTools] batch_grade_submissions failed', { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Batch grading failed',
        };
      }
    },
  };
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerTeacherTools(
  register: (tool: AgentTool) => void,
): void {
  register(buildStrategyTool());
  register(buildHomeworkTool());
  register(buildBatchGradeTool());
  logger.info('[TeacherTools] 3 teacher tools registered');
}
