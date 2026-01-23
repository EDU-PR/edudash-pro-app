/**
 * Exam Prep Tool
 * 
 * Provides Dash AI access to exam preparation features.
 * Generates practice tests, revision materials, flashcards, and study guides.
 * 
 * **Features:**
 * - Generate CAPS-aligned practice tests
 * - Create revision notes and summaries
 * - Generate flashcards for key concepts
 * - Create comprehensive study guides
 * - Access past papers (Premium+)
 * - Auto-mark exam responses (Premium+)
 * 
 * **Security:**
 * - Role-based access (all users can access basic features)
 * - Premium features gated by tier
 * - Content appropriate for student's grade level
 */

import { Tool, ToolCategory, RiskLevel, ToolParameter, ToolExecutionContext, ToolExecutionResult } from '../types';
import { hasCapability } from '@/lib/ai/capabilities';
import type { Tier } from '@/lib/ai/capabilities';

// Exam types available
const EXAM_TYPES = [
  'practice_test',
  'revision_notes',
  'flashcards',
  'study_guide',
  'past_paper',
  'quiz',
  'worksheet',
] as const;

// South African languages supported
const SUPPORTED_LANGUAGES = [
  'en-ZA', 'af-ZA', 'zu-ZA', 'xh-ZA', 'st-ZA', 
  'tn-ZA', 'ss-ZA', 've-ZA', 'ts-ZA', 'nr-ZA', 'nso-ZA'
] as const;

export const ExamPrepTool: Tool = {
  id: 'exam_prep_generate',
  name: 'Exam Preparation Generator',
  description: 'Generate CAPS-aligned exam preparation materials including practice tests, revision notes, flashcards, study guides, and worksheets. Supports all South African grades (R-12) and official languages.',
  category: 'education' as ToolCategory,
  riskLevel: 'low' as RiskLevel,
  
  allowedRoles: ['superadmin', 'principal', 'teacher', 'parent', 'student'],
  requiredTier: undefined, // Basic features available to all, advanced gated internally
  
  parameters: [
    {
      name: 'grade',
      type: 'string',
      description: 'Grade level (R, 1-12)',
      required: true,
    },
    {
      name: 'subject',
      type: 'string',
      description: 'Subject area (e.g., "Mathematics", "English", "Physical Sciences")',
      required: true,
    },
    {
      name: 'topic',
      type: 'string',
      description: 'Specific topic within the subject (e.g., "Fractions", "Photosynthesis")',
      required: false,
    },
    {
      name: 'exam_type',
      type: 'string',
      description: 'Type of material to generate',
      required: true,
      enum: [...EXAM_TYPES],
    },
    {
      name: 'difficulty',
      type: 'string',
      description: 'Difficulty level',
      required: false,
      enum: ['easy', 'medium', 'hard', 'mixed'],
    },
    {
      name: 'num_questions',
      type: 'number',
      description: 'Number of questions/items to generate (default: 10)',
      required: false,
      validation: { min: 1, max: 50 },
    },
    {
      name: 'language',
      type: 'string',
      description: 'Language for the content (default: en-ZA)',
      required: false,
      enum: [...SUPPORTED_LANGUAGES],
    },
    {
      name: 'include_answers',
      type: 'boolean',
      description: 'Include answer key/memorandum',
      required: false,
    },
    {
      name: 'term',
      type: 'number',
      description: 'School term (1-4) for term-specific content',
      required: false,
      validation: { min: 1, max: 4 },
    },
    {
      name: 'interactive',
      type: 'boolean',
      description: 'Generate interactive format for in-app experience',
      required: false,
    },
  ] as ToolParameter[],
  
  claudeToolDefinition: {
    name: 'exam_prep_generate',
    description: 'Generate CAPS-aligned exam preparation materials for South African students. Creates practice tests, revision notes, flashcards, study guides, and worksheets for Grades R-12 in all subjects. Supports all 11 official South African languages.',
    input_schema: {
      type: 'object' as const,
      properties: {
        grade: {
          type: 'string',
          description: 'Grade level (R, 1-12)',
        },
        subject: {
          type: 'string',
          description: 'Subject area',
        },
        topic: {
          type: 'string',
          description: 'Specific topic within the subject',
        },
        exam_type: {
          type: 'string',
          enum: [...EXAM_TYPES],
          description: 'Type of material: practice_test, revision_notes, flashcards, study_guide, past_paper, quiz, worksheet',
        },
        difficulty: {
          type: 'string',
          enum: ['easy', 'medium', 'hard', 'mixed'],
          description: 'Difficulty level',
        },
        num_questions: {
          type: 'number',
          description: 'Number of questions/items (1-50)',
        },
        language: {
          type: 'string',
          description: 'Content language (en-ZA, af-ZA, zu-ZA, etc.)',
        },
        include_answers: {
          type: 'boolean',
          description: 'Include answer key/memorandum',
        },
        term: {
          type: 'number',
          description: 'School term (1-4)',
        },
        interactive: {
          type: 'boolean',
          description: 'Generate interactive format',
        },
      },
      required: ['grade', 'subject', 'exam_type'],
    },
  },
  
  execute: async (
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> => {
    try {
      const { grade, subject, topic, exam_type, difficulty, num_questions, language, include_answers, term, interactive } = params;
      const userTier = (context.tier || 'free') as Tier;
      
      // Check capability for advanced features
      if (exam_type === 'past_paper' && !hasCapability(userTier, 'exam.pastpapers')) {
        return {
          success: false,
          error: 'Past papers access requires Premium subscription. Upgrade to access official past examination papers.',
          metadata: { requiredTier: 'premium', feature: 'exam.pastpapers' },
        };
      }
      
      // Build the exam prep prompt
      const promptParts: string[] = [];
      
      // Header with context
      promptParts.push(`Generate a ${exam_type.replace('_', ' ')} for:`);
      promptParts.push(`- Grade: ${grade}`);
      promptParts.push(`- Subject: ${subject}`);
      if (topic) promptParts.push(`- Topic: ${topic}`);
      if (term) promptParts.push(`- Term: ${term}`);
      if (difficulty) promptParts.push(`- Difficulty: ${difficulty}`);
      
      // Specific instructions based on exam type
      switch (exam_type) {
        case 'practice_test':
          promptParts.push(`\nCreate a comprehensive practice test with ${num_questions || 10} questions.`);
          promptParts.push('Include a mix of question types: multiple choice, short answer, and problem-solving.');
          promptParts.push('Align with CAPS curriculum requirements for this grade and subject.');
          break;
          
        case 'revision_notes':
          promptParts.push('\nCreate comprehensive revision notes covering key concepts.');
          promptParts.push('Use bullet points, diagrams descriptions, and memory aids.');
          promptParts.push('Highlight important formulas, definitions, and exam tips.');
          break;
          
        case 'flashcards':
          promptParts.push(`\nGenerate ${num_questions || 15} flashcards with:`);
          promptParts.push('- Front: Question/term/concept');
          promptParts.push('- Back: Answer/definition/explanation');
          promptParts.push('Focus on key vocabulary and core concepts.');
          break;
          
        case 'study_guide':
          promptParts.push('\nCreate a structured study guide including:');
          promptParts.push('1. Learning objectives');
          promptParts.push('2. Key concepts and definitions');
          promptParts.push('3. Step-by-step explanations');
          promptParts.push('4. Practice examples');
          promptParts.push('5. Self-assessment questions');
          promptParts.push('6. Exam preparation tips');
          break;
          
        case 'quiz':
          promptParts.push(`\nCreate a quick ${num_questions || 10}-question quiz.`);
          promptParts.push('Use multiple choice format for easy self-assessment.');
          promptParts.push('Include immediate feedback explanations.');
          break;
          
        case 'worksheet':
          promptParts.push(`\nCreate a practice worksheet with ${num_questions || 10} problems.`);
          promptParts.push('Include clear instructions and space for working.');
          promptParts.push('Progress from easier to more challenging problems.');
          break;
          
        case 'past_paper':
          promptParts.push('\nProvide a past paper-style assessment:');
          promptParts.push('- Follow official exam format and structure');
          promptParts.push('- Include time allocation guidance');
          promptParts.push('- Replicate mark distribution');
          break;
      }
      
      // Language instruction
      if (language && language !== 'en-ZA') {
        const langMap: Record<string, string> = {
          'af-ZA': 'Afrikaans',
          'zu-ZA': 'isiZulu',
          'xh-ZA': 'isiXhosa',
          'st-ZA': 'Sesotho',
          'tn-ZA': 'Setswana',
          'ss-ZA': 'siSwati',
          've-ZA': 'Tshivenda',
          'ts-ZA': 'Xitsonga',
          'nr-ZA': 'isiNdebele',
          'nso-ZA': 'Sepedi',
        };
        promptParts.push(`\nGenerate the content in ${langMap[language] || language}.`);
      }
      
      // Answer key
      if (include_answers) {
        promptParts.push('\nInclude a complete answer key/memorandum with explanations.');
      }
      
      // Interactive format
      if (interactive) {
        promptParts.push('\nFormat the output as structured JSON for interactive rendering.');
      }
      
      const generatedPrompt = promptParts.join('\n');
      
      return {
        success: true,
        data: {
          type: 'exam_prep_request',
          exam_type,
          grade,
          subject,
          topic: topic || null,
          difficulty: difficulty || 'mixed',
          language: language || 'en-ZA',
          term: term || null,
          num_questions: num_questions || 10,
          include_answers: include_answers || false,
          interactive: interactive || false,
          generated_prompt: generatedPrompt,
          message: `Ready to generate ${exam_type.replace('_', ' ')} for Grade ${grade} ${subject}${topic ? ` - ${topic}` : ''}.`,
        },
        metadata: {
          toolId: 'exam_prep_generate',
          tier: userTier,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to prepare exam content: ${error.message}`,
      };
    }
  },
};

export default ExamPrepTool;
