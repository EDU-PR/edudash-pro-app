/**
 * Student Tutor Tool
 * 
 * Provides Dash AI with personalized tutoring capabilities for students.
 * Explains concepts, guides problem-solving, and adapts to learning styles.
 * 
 * **Features:**
 * - Step-by-step concept explanations
 * - Guided problem solving with hints
 * - Socratic questioning method
 * - Adaptive difficulty based on student performance
 * - Progress tracking integration
 * - Multiple explanation approaches
 * 
 * **Security:**
 * - Available to all authenticated users
 * - Content filtered for age-appropriateness
 * - Progress data scoped to user
 */

import { Tool, ToolCategory, RiskLevel, ToolParameter, ToolExecutionContext, ToolExecutionResult } from '../types';
import { normalizeLanguageCode } from '@/lib/ai/dashSettings';

// Teaching styles supported
const TEACHING_STYLES = [
  'direct',      // Clear, straightforward explanations
  'socratic',    // Question-based discovery learning
  'visual',      // Diagrams and visual representations
  'step_by_step', // Detailed procedural breakdown
  'examples',    // Learn through worked examples
  'analogies',   // Relate to familiar concepts
] as const;

// Hint levels
const HINT_LEVELS = [
  'none',       // No hints, let student try
  'gentle',     // Subtle nudge in right direction
  'moderate',   // More specific guidance
  'detailed',   // Step-by-step assistance
] as const;

export const StudentTutorTool: Tool = {
  id: 'student_tutor',
  name: 'AI Tutor',
  description: 'Provides personalized tutoring for students. Explains concepts step-by-step, helps solve problems with adaptive hints, and adjusts teaching style to student needs. Perfect for homework help and concept mastery.',
  category: 'education' as ToolCategory,
  riskLevel: 'low' as RiskLevel,
  
  allowedRoles: ['superadmin', 'principal', 'teacher', 'parent', 'student'],
  requiredTier: undefined, // Available to all tiers
  
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: 'Type of tutoring action',
      required: true,
      enum: ['explain', 'solve', 'check', 'hint', 'practice', 'review'],
    },
    {
      name: 'subject',
      type: 'string',
      description: 'Subject area (Mathematics, Science, English, etc.)',
      required: true,
    },
    {
      name: 'grade',
      type: 'string',
      description: 'Student grade level (R, 1-12)',
      required: true,
    },
    {
      name: 'topic',
      type: 'string',
      description: 'Specific topic or concept',
      required: false,
    },
    {
      name: 'question',
      type: 'string',
      description: 'The question or problem to work on',
      required: false,
    },
    {
      name: 'student_answer',
      type: 'string',
      description: 'Student\'s attempted answer (for checking)',
      required: false,
    },
    {
      name: 'teaching_style',
      type: 'string',
      description: 'Preferred teaching approach',
      required: false,
      enum: [...TEACHING_STYLES],
    },
    {
      name: 'hint_level',
      type: 'string',
      description: 'How much help to provide',
      required: false,
      enum: [...HINT_LEVELS],
    },
    {
      name: 'language',
      type: 'string',
      description: 'Language for explanations (default: English)',
      required: false,
    },
    {
      name: 'show_working',
      type: 'boolean',
      description: 'Show detailed working/steps',
      required: false,
    },
    {
      name: 'encourage_mode',
      type: 'boolean',
      description: 'Include encouraging messages and positive reinforcement',
      required: false,
    },
  ] as ToolParameter[],
  
  claudeToolDefinition: {
    name: 'student_tutor',
    description: 'Provide personalized tutoring for students. Can explain concepts, help solve problems with hints, check answers, and generate practice problems. Adapts to student grade level and preferred learning style.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['explain', 'solve', 'check', 'hint', 'practice', 'review'],
          description: 'Tutoring action: explain (concept), solve (problem), check (answer), hint (guidance), practice (generate problems), review (summarize topic)',
        },
        subject: {
          type: 'string',
          description: 'Subject area',
        },
        grade: {
          type: 'string',
          description: 'Student grade level (R, 1-12)',
        },
        topic: {
          type: 'string',
          description: 'Specific topic or concept',
        },
        question: {
          type: 'string',
          description: 'The question or problem',
        },
        student_answer: {
          type: 'string',
          description: 'Student\'s attempted answer',
        },
        teaching_style: {
          type: 'string',
          enum: [...TEACHING_STYLES],
          description: 'Teaching approach preference',
        },
        hint_level: {
          type: 'string',
          enum: [...HINT_LEVELS],
          description: 'Amount of help to provide',
        },
        language: {
          type: 'string',
          description: 'Language for explanations',
        },
        show_working: {
          type: 'boolean',
          description: 'Show detailed steps',
        },
        encourage_mode: {
          type: 'boolean',
          description: 'Include encouragement',
        },
      },
      required: ['action', 'subject', 'grade'],
    },
  },
  
  execute: async (
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> => {
    try {
      const { 
        action, 
        subject, 
        grade, 
        topic, 
        question, 
        student_answer, 
        teaching_style, 
        hint_level, 
        language,
        show_working,
        encourage_mode 
      } = params;
      
      // Build tutoring prompt based on action
      const promptParts: string[] = [];
      
      // Set context
      promptParts.push(`You are a friendly, patient tutor helping a Grade ${grade} student with ${subject}.`);
      
      if (encourage_mode !== false) {
        promptParts.push('Be encouraging and supportive. Celebrate small wins and normalize mistakes as part of learning.');
      }
      
      const normalizedLanguage = normalizeLanguageCode(language);
      const languageName = normalizedLanguage === 'af'
        ? 'Afrikaans'
        : normalizedLanguage === 'zu'
          ? 'isiZulu'
          : 'English';
      if (languageName !== 'English') {
        promptParts.push(`Respond in ${languageName}.`);
      }
      
      // Teaching style instructions
      switch (teaching_style) {
        case 'socratic':
          promptParts.push('Use the Socratic method - guide discovery through thoughtful questions rather than giving direct answers.');
          break;
        case 'visual':
          promptParts.push('Include visual descriptions, diagrams (using ASCII art if helpful), and spatial reasoning.');
          break;
        case 'step_by_step':
          promptParts.push('Break everything down into small, numbered steps. Explain each step before moving to the next.');
          break;
        case 'examples':
          promptParts.push('Use plenty of worked examples. Show similar problems and how to solve them.');
          break;
        case 'analogies':
          promptParts.push('Relate concepts to everyday experiences and familiar situations the student would understand.');
          break;
        default:
          promptParts.push('Explain clearly and directly, checking for understanding along the way.');
      }
      
      // Action-specific instructions
      switch (action) {
        case 'explain':
          promptParts.push(`\n**Task: Explain the concept**`);
          if (topic) {
            promptParts.push(`Explain "${topic}" in ${subject} at a Grade ${grade} level.`);
          }
          promptParts.push('Cover:');
          promptParts.push('1. What it is (simple definition)');
          promptParts.push('2. Why it matters (real-world relevance)');
          promptParts.push('3. How it works (core mechanics)');
          promptParts.push('4. Example to illustrate');
          promptParts.push('5. Quick check question for the student');
          break;
          
        case 'solve':
          promptParts.push(`\n**Task: Help solve a problem**`);
          if (question) {
            promptParts.push(`Problem: ${question}`);
          }
          if (show_working) {
            promptParts.push('Show detailed working for each step.');
          }
          switch (hint_level) {
            case 'none':
              promptParts.push('Give the student a chance to try first. Ask guiding questions.');
              break;
            case 'gentle':
              promptParts.push('Provide a subtle hint about where to start, then let them continue.');
              break;
            case 'moderate':
              promptParts.push('Walk through the approach but let them do the calculations.');
              break;
            case 'detailed':
            default:
              promptParts.push('Provide a complete step-by-step solution with explanations.');
          }
          break;
          
        case 'check':
          promptParts.push(`\n**Task: Check student's answer**`);
          if (question) {
            promptParts.push(`Question: ${question}`);
          }
          if (student_answer) {
            promptParts.push(`Student's answer: ${student_answer}`);
          }
          promptParts.push('Determine if the answer is correct. If wrong:');
          promptParts.push('- Identify where the mistake occurred');
          promptParts.push('- Explain the correct approach without being discouraging');
          promptParts.push('- Show the correct answer with working');
          break;
          
        case 'hint':
          promptParts.push(`\n**Task: Provide a hint**`);
          if (question) {
            promptParts.push(`Problem: ${question}`);
          }
          switch (hint_level) {
            case 'gentle':
              promptParts.push('Give a very subtle hint - just nudge them in the right direction.');
              break;
            case 'moderate':
              promptParts.push('Give a medium hint - mention the concept or formula needed.');
              break;
            case 'detailed':
              promptParts.push('Give a strong hint - outline the approach without doing the full solution.');
              break;
            default:
              promptParts.push('Give a helpful hint appropriate for the difficulty.');
          }
          promptParts.push('End with an encouraging question to keep them engaged.');
          break;
          
        case 'practice':
          promptParts.push(`\n**Task: Generate practice problems**`);
          promptParts.push(`Generate 3-5 practice problems for ${topic || subject} at Grade ${grade} level.`);
          promptParts.push('Include:');
          promptParts.push('- Problems of increasing difficulty');
          promptParts.push('- A mix of problem types');
          promptParts.push('- Brief hints for each problem');
          promptParts.push('- Answer key at the end (hidden/collapsible format)');
          break;
          
        case 'review':
          promptParts.push(`\n**Task: Review/summarize topic**`);
          promptParts.push(`Create a quick review summary of ${topic || subject} for Grade ${grade}.`);
          promptParts.push('Include:');
          promptParts.push('- Key points (3-5 bullet points)');
          promptParts.push('- Important formulas/rules');
          promptParts.push('- Common mistakes to avoid');
          promptParts.push('- Quick self-test (2-3 questions)');
          break;
      }
      
      const generatedPrompt = promptParts.join('\n');
      
      return {
        success: true,
        data: {
          type: 'tutor_request',
          action,
          subject,
          grade,
          topic: topic || null,
          question: question || null,
          teaching_style: teaching_style || 'direct',
          hint_level: hint_level || 'moderate',
          language: languageName,
          generated_prompt: generatedPrompt,
          message: `Ready to ${action} - ${topic || subject} for Grade ${grade}.`,
          encouragement: encourage_mode !== false 
            ? "Remember: Every expert was once a beginner. Let's learn together! 🌟"
            : undefined,
        },
        metadata: {
          toolId: 'student_tutor',
          action,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Tutoring error: ${error.message}`,
      };
    }
  },
};

export default StudentTutorTool;
