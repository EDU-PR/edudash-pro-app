/**
 * Teacher Workflow Templates
 *
 * Predefined multi-step workflow definitions for common teacher tasks.
 * Each template is instantiated into a DashTask by the WorkflowEngine.
 *
 * @module services/dash-ai/workflows/templates
 */

import type { WorkflowTemplate } from './types'

// ---------------------------------------------------------------------------
// Lesson Plan Generation Workflow
// ---------------------------------------------------------------------------

export const lessonPlanWorkflow: WorkflowTemplate = {
  id: 'lesson_plan_generation',
  name: 'AI Lesson Plan Generator',
  description:
    'Generate a complete, CAPS-aligned lesson plan with activities, assessments, and resources.',
  requiredTier: 'starter',
  estimatedDuration: 5,
  requiredParams: [
    {
      key: 'subject',
      label: 'Subject',
      type: 'select',
      required: true,
      options: [
        { label: 'Mathematics', value: 'mathematics' },
        { label: 'English Home Language', value: 'english_hl' },
        { label: 'Life Skills', value: 'life_skills' },
        { label: 'Natural Sciences', value: 'natural_sciences' },
        { label: 'Social Sciences', value: 'social_sciences' },
        { label: 'Technology', value: 'technology' },
      ],
    },
    {
      key: 'grade',
      label: 'Grade Level',
      type: 'select',
      required: true,
      options: [
        { label: 'Grade R', value: 'R' },
        { label: 'Grade 1', value: '1' },
        { label: 'Grade 2', value: '2' },
        { label: 'Grade 3', value: '3' },
        { label: 'Grade 4', value: '4' },
        { label: 'Grade 5', value: '5' },
        { label: 'Grade 6', value: '6' },
        { label: 'Grade 7', value: '7' },
      ],
    },
    {
      key: 'topic',
      label: 'Topic / Theme',
      type: 'string',
      required: true,
      placeholder: 'e.g., Fractions and decimals',
    },
  ],
  optionalParams: [
    {
      key: 'duration_minutes',
      label: 'Lesson Duration (minutes)',
      type: 'number',
      defaultValue: 45,
    },
    {
      key: 'include_homework',
      label: 'Include Homework',
      type: 'boolean',
      defaultValue: true,
    },
    {
      key: 'differentiation',
      label: 'Differentiation Level',
      type: 'select',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Multi-level (gifted + struggling)', value: 'multi_level' },
        { label: 'Inclusive (special needs)', value: 'inclusive' },
      ],
      defaultValue: 'standard',
    },
  ],
  steps: [
    {
      id: 'caps_alignment',
      name: 'CAPS Curriculum Alignment',
      description: 'Look up relevant CAPS curriculum guidelines for the subject, grade, and topic.',
      type: 'automated',
      serviceType: 'lesson_generation',
      toolIds: ['caps_curriculum'],
      promptTemplate:
        'Find the CAPS curriculum requirements for {{subject}} Grade {{grade}} covering the topic: {{topic}}. Return the specific learning outcomes, assessment standards, and content focus areas.',
    },
    {
      id: 'lesson_structure',
      name: 'Generate Lesson Structure',
      description: 'Create the lesson plan structure with objectives, activities, and timeline.',
      type: 'automated',
      serviceType: 'lesson_generation',
      promptTemplate:
        'Create a detailed lesson plan for {{subject}} Grade {{grade}} on "{{topic}}" lasting {{duration_minutes}} minutes. Use CAPS alignment data: {{caps_alignment_result}}. Include: 1) Learning objectives, 2) Introduction activity, 3) Main lesson body with activities, 4) Assessment activity, 5) Conclusion/review. Differentiation: {{differentiation}}.',
      dependsOn: ['caps_alignment'],
    },
    {
      id: 'resource_suggestions',
      name: 'Suggest Resources',
      description: 'Recommend textbook pages, worksheets, manipulatives, and digital resources.',
      type: 'automated',
      serviceType: 'lesson_generation',
      toolIds: ['textbook_content', 'context_aware_resources'],
      promptTemplate:
        'Based on this lesson plan: {{lesson_structure_result}}, suggest relevant resources including textbook references, printable worksheets, manipulatives, and online tools appropriate for Grade {{grade}}.',
      dependsOn: ['lesson_structure'],
    },
    {
      id: 'homework_generation',
      name: 'Generate Homework',
      description: 'Create homework activities aligned with the lesson.',
      type: 'automated',
      serviceType: 'lesson_generation',
      promptTemplate:
        'Create homework for Grade {{grade}} {{subject}} based on this lesson: {{lesson_structure_result}}. Include 3-5 practice problems of increasing difficulty. Format for easy printing.',
      dependsOn: ['lesson_structure'],
    },
    {
      id: 'teacher_review',
      name: 'Teacher Review & Approval',
      description: 'Review the generated lesson plan, resources, and homework before saving.',
      type: 'approval_required',
      requiresApproval: true,
      dependsOn: ['lesson_structure', 'resource_suggestions', 'homework_generation'],
    },
    {
      id: 'save_lesson',
      name: 'Save to Dashboard',
      description: 'Save the approved lesson plan and homework to the teacher\'s dashboard.',
      type: 'automated',
      dependsOn: ['teacher_review'],
    },
  ],
}

// ---------------------------------------------------------------------------
// Weekly Preparation Workflow
// ---------------------------------------------------------------------------

export const weeklyPrepWorkflow: WorkflowTemplate = {
  id: 'weekly_preparation',
  name: 'Weekly Lesson Preparation',
  description:
    'Plan an entire week of lessons across subjects with consistent themes and progressive learning.',
  requiredTier: 'premium',
  estimatedDuration: 15,
  requiredParams: [
    {
      key: 'grade',
      label: 'Grade Level',
      type: 'select',
      required: true,
      options: [
        { label: 'Grade R', value: 'R' },
        { label: 'Grade 1', value: '1' },
        { label: 'Grade 2', value: '2' },
        { label: 'Grade 3', value: '3' },
      ],
    },
    {
      key: 'subjects',
      label: 'Subjects to Plan',
      type: 'multiselect',
      required: true,
      options: [
        { label: 'Mathematics', value: 'mathematics' },
        { label: 'English', value: 'english' },
        { label: 'Life Skills', value: 'life_skills' },
        { label: 'Natural Sciences', value: 'natural_sciences' },
      ],
    },
    {
      key: 'week_theme',
      label: 'Weekly Theme (optional)',
      type: 'string',
      placeholder: 'e.g., Water and sustainability',
    },
  ],
  steps: [
    {
      id: 'weekly_overview',
      name: 'Generate Weekly Overview',
      description: 'Create a high-level weekly plan with daily subject allocation.',
      type: 'automated',
      serviceType: 'lesson_generation',
      toolIds: ['caps_curriculum'],
      promptTemplate:
        'Create a weekly overview for Grade {{grade}} covering subjects: {{subjects}}. Theme: {{week_theme}}. Allocate subjects across 5 days (Mon-Fri). Ensure progressive learning and cross-curricular connections.',
    },
    {
      id: 'daily_plans',
      name: 'Generate Daily Lesson Plans',
      description: 'Create detailed lesson plans for each day based on the weekly overview.',
      type: 'automated',
      serviceType: 'lesson_generation',
      promptTemplate:
        'Based on this weekly overview: {{weekly_overview_result}}, generate detailed daily lesson plans for each of the 5 days. Each plan should have objectives, activities (15-30 min blocks), and materials needed.',
      dependsOn: ['weekly_overview'],
    },
    {
      id: 'materials_checklist',
      name: 'Materials Checklist',
      description: 'Compile a complete materials/resources checklist for the week.',
      type: 'automated',
      promptTemplate:
        'From these daily plans: {{daily_plans_result}}, create a comprehensive materials checklist organized by day. Flag items that need to be prepared or printed in advance.',
      dependsOn: ['daily_plans'],
    },
    {
      id: 'review_and_adjust',
      name: 'Review & Adjust',
      description: 'Review the complete weekly plan before saving.',
      type: 'approval_required',
      requiresApproval: true,
      dependsOn: ['daily_plans', 'materials_checklist'],
    },
    {
      id: 'save_weekly_plan',
      name: 'Save Weekly Plan',
      description: 'Save all lesson plans and link them to the calendar.',
      type: 'automated',
      dependsOn: ['review_and_adjust'],
    },
  ],
}

// ---------------------------------------------------------------------------
// Batch Grading Workflow
// ---------------------------------------------------------------------------

export const batchGradingWorkflow: WorkflowTemplate = {
  id: 'batch_grading',
  name: 'AI Batch Grading',
  description:
    'Grade multiple homework submissions at once with AI, generating feedback and identifying patterns.',
  requiredTier: 'starter',
  estimatedDuration: 10,
  requiredParams: [
    {
      key: 'assignment_id',
      label: 'Assignment',
      type: 'select',
      required: true,
      options: [], // Populated dynamically from teacher's assignments
    },
    {
      key: 'grading_rubric',
      label: 'Grading Approach',
      type: 'select',
      required: true,
      options: [
        { label: 'Standard (1-10 scale)', value: 'standard_10' },
        { label: 'Percentage (0-100%)', value: 'percentage' },
        { label: 'Rubric-based', value: 'rubric' },
        { label: 'Competency-based', value: 'competency' },
      ],
    },
  ],
  steps: [
    {
      id: 'fetch_submissions',
      name: 'Fetch Ungraded Submissions',
      description: 'Retrieve all ungraded submissions for the selected assignment.',
      type: 'automated',
      toolIds: ['database_query'],
    },
    {
      id: 'ai_grade_batch',
      name: 'AI Grading',
      description: 'Grade each submission using AI with consistent rubric application.',
      type: 'automated',
      serviceType: 'grading_assistance',
      promptTemplate:
        'Grade this batch of {{submission_count}} submissions for assignment "{{assignment_title}}". Use {{grading_rubric}} grading. For each submission, provide: score, detailed feedback, strengths, and areas for improvement. Maintain consistency across all grades.',
      dependsOn: ['fetch_submissions'],
    },
    {
      id: 'pattern_analysis',
      name: 'Class Performance Analysis',
      description: 'Analyze grading results for common patterns and insights.',
      type: 'automated',
      serviceType: 'progress_analysis',
      toolIds: ['mistake_pattern', 'learning_progress'],
      promptTemplate:
        'Analyze these grading results: {{ai_grade_batch_result}}. Identify: 1) Common mistakes, 2) Knowledge gaps, 3) Top performers, 4) Students needing intervention. Generate a class summary.',
      dependsOn: ['ai_grade_batch'],
    },
    {
      id: 'review_grades',
      name: 'Review & Adjust Grades',
      description: 'Review AI-generated grades and make adjustments before publishing.',
      type: 'approval_required',
      requiresApproval: true,
      dependsOn: ['ai_grade_batch', 'pattern_analysis'],
    },
    {
      id: 'publish_grades',
      name: 'Publish Grades & Feedback',
      description: 'Save grades and send feedback to students/parents.',
      type: 'automated',
      dependsOn: ['review_grades'],
    },
  ],
}

// ---------------------------------------------------------------------------
// Progress Report Workflow
// ---------------------------------------------------------------------------

export const progressReportWorkflow: WorkflowTemplate = {
  id: 'progress_report_generation',
  name: 'Student Progress Reports',
  description:
    'Generate individual progress reports for each student with AI-written commentary.',
  requiredTier: 'premium',
  estimatedDuration: 20,
  requiredParams: [
    {
      key: 'class_id',
      label: 'Class',
      type: 'select',
      required: true,
      options: [], // Populated dynamically
    },
    {
      key: 'report_period',
      label: 'Report Period',
      type: 'select',
      required: true,
      options: [
        { label: 'Term 1', value: 'term_1' },
        { label: 'Term 2', value: 'term_2' },
        { label: 'Term 3', value: 'term_3' },
        { label: 'Term 4', value: 'term_4' },
        { label: 'Mid-Year', value: 'mid_year' },
        { label: 'Year-End', value: 'year_end' },
      ],
    },
  ],
  steps: [
    {
      id: 'gather_data',
      name: 'Gather Student Data',
      description: 'Collect grades, attendance, homework completion, and notes for each student.',
      type: 'automated',
      toolIds: ['database_query', 'learning_progress'],
    },
    {
      id: 'generate_commentary',
      name: 'Generate Report Commentary',
      description: 'Write individualized commentary for each student based on their data.',
      type: 'automated',
      serviceType: 'progress_analysis',
      promptTemplate:
        'Generate progress report commentary for each student in the class. Data: {{gather_data_result}}. Report period: {{report_period}}. For each student, write a professional, encouraging, and specific 3-4 sentence commentary covering academic performance, behaviour, and areas for growth. Use South African educational tone and terminology.',
      dependsOn: ['gather_data'],
    },
    {
      id: 'review_reports',
      name: 'Review Reports',
      description: 'Review and personalize each student\'s report before distribution.',
      type: 'approval_required',
      requiresApproval: true,
      dependsOn: ['generate_commentary'],
    },
    {
      id: 'generate_pdfs',
      name: 'Generate PDF Reports',
      description: 'Create formatted PDF reports for each student.',
      type: 'automated',
      dependsOn: ['review_reports'],
    },
    {
      id: 'notify_parents',
      name: 'Notify Parents',
      description: 'Send notifications to parents that reports are available.',
      type: 'automated',
      dependsOn: ['generate_pdfs'],
    },
  ],
}

// ---------------------------------------------------------------------------
// Template Registry
// ---------------------------------------------------------------------------

export const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {
  lesson_plan_generation: lessonPlanWorkflow,
  weekly_preparation: weeklyPrepWorkflow,
  batch_grading: batchGradingWorkflow,
  progress_report_generation: progressReportWorkflow,
}

/** Get all available workflow templates for a given tier */
export function getAvailableWorkflows(
  tier: 'free' | 'starter' | 'premium' | 'enterprise',
): WorkflowTemplate[] {
  const tierRank: Record<string, number> = {
    free: 0,
    starter: 1,
    premium: 2,
    enterprise: 3,
  }

  const userRank = tierRank[tier] ?? 0

  return Object.values(WORKFLOW_TEMPLATES).filter(
    (t) => tierRank[t.requiredTier] <= userRank,
  )
}
