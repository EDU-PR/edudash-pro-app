/**
 * Tool Registry for AI Proxy
 * 
 * Provides Claude with tools it can autonomously call, similar to how Claude Sonnet 4.5 operates.
 * 
 * Architecture:
 * - Tool definitions: Claude-compatible format with input_schema
 * - Role-based access: Filter tools by user role and tier
 * - Tool execution: Server-side execution with proper context
 */

import type { ClaudeTool, ToolContext, ToolExecutionResult } from '../types.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Get tools available for a specific role and tier
 * 
 * IMPORTANT: Strips custom metadata (allowedRoles, requiredTier, requiresConfirmation)
 * before returning tools to Claude API, as Claude only accepts:
 * - name
 * - description
 * - input_schema
 */
export function getToolsForRole(role: string, tier: string): ClaudeTool[] {
  const allTools = getAllTools()
  
  // Filter by role and tier
  const filteredTools = allTools.filter(tool => {
    // Check role access
    const allowedRoles = (tool as any).allowedRoles || []
    if (!allowedRoles.includes(role)) {
      return false
    }
    
    // Check tier requirements
    const requiredTier = (tool as any).requiredTier
    if (requiredTier) {
      const tierOrder = ['free', 'starter', 'basic', 'premium', 'pro', 'enterprise']
      const userTierIndex = tierOrder.indexOf(tier)
      const requiredTierIndex = tierOrder.indexOf(requiredTier)
      
      if (userTierIndex < requiredTierIndex) {
        return false
      }
    }
    
    return true
  })
  
  // Strip custom metadata fields before sending to Claude
  // Claude only accepts: name, description, input_schema
  return filteredTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema
  }))
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  parameters: Record<string, any>,
  context: ToolContext
): Promise<ToolExecutionResult> {
  console.log(`[tool-registry] Executing tool: ${toolName}`)
  
  const executor = toolExecutors[toolName]
  
  if (!executor) {
    return {
      success: false,
      error: `Tool ${toolName} not found`
    }
  }
  
  try {
    const result = await executor(parameters, context)
    return {
      success: true,
      result
    }
  } catch (error: any) {
    console.error(`[tool-registry] Tool ${toolName} failed:`, error)
    return {
      success: false,
      error: error.message || 'Tool execution failed'
    }
  }
}

/**
 * Get all available tools (unfiltered)
 */
function getAllTools(): ClaudeTool[] {
  return [
    // ========================================
    // DATABASE QUERY TOOLS
    // ========================================
    
    {
      name: 'get_student_list',
      description: 'Get list of students with optional filters by class or status. Use this when user asks about students, learners, or children in their organization.',
      input_schema: {
        type: 'object',
        properties: {
          class_id: {
            type: 'string',
            description: 'Filter by specific class/classroom ID'
          },
          include_inactive: {
            type: 'boolean',
            description: 'Include inactive students (default: false)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 50)'
          }
        },
        required: []
      },
      allowedRoles: ['teacher', 'principal'],
      requiredTier: 'free'
    } as any,
    
    {
      name: 'get_student_progress',
      description: 'Get detailed progress and performance data for a specific student including grades, assessments, and attendance.',
      input_schema: {
        type: 'object',
        properties: {
          student_id: {
            type: 'string',
            description: 'ID of the student'
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
        required: ['student_id']
      },
      allowedRoles: ['teacher', 'principal', 'parent'],
      requiredTier: 'free'
    } as any,
    
    // TODO: Re-enable after creating calendar_events table migration
    // Currently disabled - table doesn't exist in database schema
    // {
    //   name: 'get_schedule',
    //   description: 'Get schedule or calendar events for a date range. Use when user asks about upcoming events, schedule, or calendar.',
    //   input_schema: {
    //     type: 'object',
    //     properties: {
    //       start_date: {
    //         type: 'string',
    //         description: 'Start date (ISO format, "today", or "tomorrow")'
    //       },
    //       days: {
    //         type: 'number',
    //         description: 'Number of days to show (default: 7)'
    //       }
    //     },
    //     required: []
    //   },
    //   allowedRoles: ['teacher', 'principal', 'parent'],
    //   requiredTier: 'free'
    // } as any,
    
    {
      name: 'get_assignments',
      description: 'Get list of homework assignments with optional filters by status or subject.',
      input_schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'completed', 'archived', 'all'],
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
        },
        required: []
      },
      allowedRoles: ['teacher', 'principal', 'parent'],
      requiredTier: 'free'
    } as any,
    
    {
      name: 'get_organization_stats',
      description: 'Get comprehensive statistics about the organization including student counts, teacher counts, class counts, etc. Use when user asks for overview or summary of the school.',
      input_schema: {
        type: 'object',
        properties: {
          include_inactive: {
            type: 'boolean',
            description: 'Include inactive members (default: false)'
          }
        },
        required: []
      },
      allowedRoles: ['principal', 'teacher'],
      requiredTier: 'free'
    } as any,
    
    {
      name: 'analyze_class_performance',
      description: 'Analyze overall class or group performance with insights and identify struggling students.',
      input_schema: {
        type: 'object',
        properties: {
          class_id: {
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
        },
        required: []
      },
      allowedRoles: ['teacher', 'principal'],
      requiredTier: 'starter'
    } as any,
    
    // ========================================
    // CAPS CURRICULUM TOOLS (South African)
    // ========================================
    
    {
      name: 'search_caps_curriculum',
      description: 'Search South African CAPS curriculum documents by topic, grade, or subject. Use this when teachers ask about curriculum requirements, learning outcomes, or official guidelines.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (topic, learning outcome, concept)'
          },
          grade: {
            type: 'string',
            description: 'Grade level (e.g., "R-3", "4-6", "7-9", "10-12", or specific like "10")'
          },
          subject: {
            type: 'string',
            description: 'Subject name (e.g., Mathematics, English, Physical Sciences)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 5)'
          }
        },
        required: ['query']
      },
      allowedRoles: ['teacher', 'principal'],
      requiredTier: 'free'
    } as any,
    
    {
      name: 'get_caps_documents',
      description: 'Get official CAPS curriculum documents for a specific grade and subject from the Department of Basic Education.',
      input_schema: {
        type: 'object',
        properties: {
          grade: {
            type: 'string',
            description: 'Grade level (e.g., "R-3", "4-6", "7-9", "10-12")'
          },
          subject: {
            type: 'string',
            description: 'Subject name (e.g., Mathematics, English HL, Physical Sciences)'
          }
        },
        required: ['grade', 'subject']
      },
      allowedRoles: ['teacher', 'principal'],
      requiredTier: 'free'
    } as any,
    
    {
      name: 'get_caps_subjects',
      description: 'Get list of available subjects in the CAPS curriculum database for a specific grade level.',
      input_schema: {
        type: 'object',
        properties: {
          grade: {
            type: 'string',
            description: 'Grade level (e.g., "R-3", "4-6", "7-9", "10-12")'
          }
        },
        required: ['grade']
      },
      allowedRoles: ['teacher', 'principal'],
      requiredTier: 'free'
    } as any,
    
    // ========================================
    // COMMUNICATION TOOLS
    // ========================================
    
    {
      name: 'send_email',
      description: 'Send an email to one or more recipients. ONLY use when user explicitly requests to send an email. Always confirm details with user first.',
      input_schema: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient email address (or comma-separated addresses)'
          },
          subject: {
            type: 'string',
            description: 'Email subject line'
          },
          body: {
            type: 'string',
            description: 'Email body content (HTML supported)'
          },
          reply_to: {
            type: 'string',
            description: 'Optional reply-to email address'
          },
          is_html: {
            type: 'boolean',
            description: 'Whether body contains HTML (default: true)'
          }
        },
        required: ['to', 'subject', 'body']
      },
      allowedRoles: ['teacher', 'principal'],
      requiredTier: 'basic',
      requiresConfirmation: true
    } as any,
    
    // ========================================
    // PARENT-SPECIFIC TOOLS
    // ========================================
    
    {
      name: 'get_child_learning_context',
      description: 'For parents: Get comprehensive learning data for their child including homework, attendance, and progress.',
      input_schema: {
        type: 'object',
        properties: {
          student_id: {
            type: 'string',
            description: 'Child student ID'
          },
          include_homework: {
            type: 'boolean',
            description: 'Include pending homework assignments'
          },
          include_attendance: {
            type: 'boolean',
            description: 'Include attendance records'
          },
          days_back: {
            type: 'number',
            description: 'Number of days of history (default: 30)'
          }
        },
        required: ['student_id']
      },
      allowedRoles: ['parent'],
      requiredTier: 'free'
    } as any,
    
    // ========================================
    // EXAM GENERATION TOOLS
    // ========================================
    
    {
      name: 'get_curriculum_for_topic',
      description: `Find official South African CAPS curriculum resources for any grade and subject topic. 

When to use:
- Student uploads homework/exam image → extract grade/subject/topic and call this
- Parent asks "what should my child learn about [topic]?"
- Teacher needs curriculum guidelines for lesson planning

What it returns:
- Official DBE curriculum documents
- Learning outcomes and assessment standards
- File URLs to download full curriculum PDFs

Example: Student uploads Grade 9 Math worksheet on "Quadratic Equations" → call get_curriculum_for_topic(grade="Grade 9", subject="Mathematics", topic="Quadratic Equations")`,
      input_schema: {
        type: 'object',
        properties: {
          grade: {
            type: 'string',
            description: 'Grade level (e.g., "Grade 9", "grade_9", "9", "R-3", "7-9")'
          },
          subject: {
            type: 'string',
            description: 'Subject name (e.g., "Mathematics", "English HL", "Physical Sciences", "Life Sciences")'
          },
          topic: {
            type: 'string',
            description: 'Topic or concept name (e.g., "Quadratic equations", "Photosynthesis", "Data handling")'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 5, max: 20)'
          }
        },
        required: ['grade', 'subject', 'topic']
      },
      allowedRoles: ['parent', 'teacher', 'principal'],
      requiredTier: 'free'
    } as any,
    
    {
      name: 'get_similar_past_papers',
      description: `Find past exam papers and practice tests from 2015-2024 to help students prepare for exams.

When to use:
- Student says "I need to practice for [subject] exam"
- Student uploads exam paper → offer similar papers for more practice
- Parent asks "where can I find past papers for Grade [X]?"

What it returns:
- Past exam papers (DBE official papers)
- Practice tests and mock exams
- Marking memorandums (answer keys)
- Year, term, and paper number metadata

Smart tip: If student struggles with a topic, recommend papers from multiple years to see how questions vary.

Example: Student says "I'm writing Grade 12 Maths exam tomorrow" → call get_similar_past_papers(grade="Grade 12", subject="Mathematics", limit=8)`,
      input_schema: {
        type: 'object',
        properties: {
          grade: {
            type: 'string',
            description: 'Grade level (e.g., "Grade 9", "grade_9", "9")'
          },
          subject: {
            type: 'string',
            description: 'Subject name (e.g., "Mathematics", "English", "Physical Sciences")'
          },
          exam_type: {
            type: 'string',
            description: 'Type: "past_paper", "mock_exam", "practice_test", or "all" (default)',
            enum: ['past_paper', 'mock_exam', 'practice_test', 'all']
          },
          year: {
            type: 'number',
            description: 'Optional: filter by year (e.g., 2024, 2023)'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 5, max: 10)'
          }
        },
        required: ['grade', 'subject']
      },
      allowedRoles: ['parent', 'teacher', 'principal'],
      requiredTier: 'free'
    } as any,
    
    {
      name: 'create_exam_attempt',
      description: `Track student exam performance over time to identify improvement areas and celebrate progress.

When to use:
- Student completes a practice test and tells you their score
- Student uploads marked exam paper with results
- After generating an exam, student returns with their score

What it does:
- Saves score, percentage, and grade (A-E)
- Auto-calculates percentage from marks
- Tracks time spent and weak topics
- Enables progress charts on dashboard

Smart suggestions after recording:
- If score < 50%: "Let's focus on [weak topics]. Would you like practice questions?"
- If score 50-70%: "You're improving! Let's target [specific areas]"
- If score > 70%: "Great work! Want to challenge yourself with harder questions?"

Example: Student says "I got 65 out of 100 on Grade 10 Physics test" → call create_exam_attempt(...) then offer targeted help`,
      input_schema: {
        type: 'object',
        properties: {
          exam_title: {
            type: 'string',
            description: 'Title of the exam/test'
          },
          grade: {
            type: 'string',
            description: 'Grade level'
          },
          subject: {
            type: 'string',
            description: 'Subject'
          },
          score_obtained: {
            type: 'number',
            description: 'Score the student got'
          },
          score_total: {
            type: 'number',
            description: 'Total possible marks'
          },
          time_spent_minutes: {
            type: 'number',
            description: 'Time spent on exam in minutes'
          },
          exam_generation_id: {
            type: 'string',
            description: 'If this was from a generated exam, provide the exam_generation ID (optional)'
          },
          user_notes: {
            type: 'string',
            description: 'Student notes/reflections (optional)'
          },
          areas_to_improve: {
            type: 'array',
            description: 'List of topics needing improvement (optional)',
            items: { type: 'string' }
          }
        },
        required: ['exam_title', 'grade', 'subject', 'score_obtained', 'score_total']
      },
      allowedRoles: ['parent'],
      requiredTier: 'free'
    } as any,
    
    {
      name: 'generate_caps_exam',
      description: `Create a complete, print-ready exam paper aligned to CAPS curriculum standards.

When to use:
- Student/parent/teacher requests "create/generate a practice test/exam"
- After identifying weak topics → "Would you like a practice test on [topic]?"
- As follow-up to study session → "Ready to test yourself?"

What you must provide:
- grade: e.g. "Grade 9"
- subject: e.g. "Mathematics"
- exam_type: "practice_test" | "mid_year" | "final" | "quiz"
- title: descriptive name
- sections: array with title, instructions, questions (number, text, type, marks, options, correctAnswer)
- instructions: array of exam instructions
- total_marks: sum of all question marks

Smart features:
- Include multiple sections (MCQ, Short Answer, Essays)
- Vary question difficulty (easy → medium → hard)
- Provide marking memo (correctAnswer field)
- Include time suggestions based on marks (1 mark ≈ 1-2 minutes)

Example structure:
{
  sections: [
    { title: "SECTION A: Multiple Choice", questions: [15 MCQs @ 2 marks each] },
    { title: "SECTION B: Short Answer", questions: [8 questions @ 5 marks each] },
    { title: "SECTION C: Essays", questions: [2 questions @ 15 marks each] }
  ],
  total_marks: 100
}

ALWAYS use this tool - don't generate exam text manually. The tool creates structured, downloadable format.`,
      input_schema: {
        type: 'object',
        properties: {
          grade: {
            type: 'string',
            description: 'Grade level (e.g., "Grade 9", "Grade 10", "grade_9")'
          },
          subject: {
            type: 'string',
            description: 'Subject name (e.g., "Mathematics", "English", "Physical Sciences")'
          },
          exam_type: {
            type: 'string',
            description: 'Type of exam (e.g., "practice_test", "mid_year", "final", "quiz")'
          },
          title: {
            type: 'string',
            description: 'Exam title (e.g., "Grade 9 Mathematics Practice Test")'
          },
          sections: {
            type: 'array',
            description: 'Array of exam sections with questions',
            items: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Section title (e.g., "SECTION A: Multiple Choice")'
                },
                instructions: {
                  type: 'string',
                  description: 'Instructions for this section'
                },
                questions: {
                  type: 'array',
                  description: 'Array of questions in this section',
                  items: {
                    type: 'object',
                    properties: {
                      number: {
                        type: 'string',
                        description: 'Question number (e.g., "1", "1.1", "2.3")'
                      },
                      text: {
                        type: 'string',
                        description: 'Question text'
                      },
                      type: {
                        type: 'string',
                        enum: ['multiple_choice', 'short_answer', 'essay', 'numeric'],
                        description: 'Question type'
                      },
                      marks: {
                        type: 'number',
                        description: 'Marks allocated to this question'
                      },
                      options: {
                        type: 'array',
                        description: 'Options for multiple choice (optional)',
                        items: { type: 'string' }
                      },
                      correctAnswer: {
                        type: 'string',
                        description: 'Correct answer for auto-grading (optional)'
                      }
                    },
                    required: ['number', 'text', 'type', 'marks']
                  }
                }
              },
              required: ['title', 'questions']
            }
          },
          instructions: {
            type: 'array',
            description: 'General exam instructions',
            items: { type: 'string' }
          },
          total_marks: {
            type: 'number',
            description: 'Total marks for the exam'
          },
          duration_minutes: {
            type: 'number',
            description: 'Suggested duration in minutes (optional)'
          }
        },
        required: ['grade', 'subject', 'exam_type', 'title', 'sections', 'instructions', 'total_marks']
      },
      allowedRoles: ['parent', 'teacher', 'principal'],
      requiredTier: 'free'
    } as any,
    
    {
      name: 'get_textbook_pages',
      description: `Retrieve actual content from CAPS-aligned textbook pages stored in our database.

When to use:
- User/student mentions specific page numbers when requesting exam generation (e.g., "create exam from pages 45-60")
- Need to base questions on actual textbook content rather than general knowledge
- User says "from the textbook" or "based on the book"
- Scope includes page references (e.g., "study pages 23-35 for the test")

What it does:
- Retrieves OCR'd text content from textbook pages
- Returns chapter titles and page numbers
- Indicates if pages have practice exercises
- Works with our library of 19 CAPS-aligned textbooks (Siyavula, DBE Rainbow, Via Afrika)

Usage:
1. If user mentions textbook ID: use textbook_id
2. If user mentions grade + subject: system will find matching textbook
3. Specify page range to retrieve content
4. Use the retrieved content to generate contextual exam questions

Example:
User: "Create a Grade 10 Math exam from pages 45-60 of the textbook"
→ Call get_textbook_pages(grade: "10", subject: "Mathematics", page_start: 45, page_end: 60)
→ Use returned content to create targeted questions with generate_caps_exam`,
      input_schema: {
        type: 'object',
        properties: {
          textbook_id: {
            type: 'string',
            description: 'Direct textbook UUID (optional if grade+subject provided)'
          },
          grade: {
            type: 'string',
            description: 'Grade level (e.g., "10", "9", "12") - used to find textbook if ID not provided'
          },
          subject: {
            type: 'string',
            description: 'Subject name (e.g., "Mathematics", "Physical Sciences") - used with grade to find textbook'
          },
          page_start: {
            type: 'number',
            description: 'Starting page number (default: 1)'
          },
          page_end: {
            type: 'number',
            description: 'Ending page number (default: page_start + 10)'
          }
        },
        required: []
      },
      allowedRoles: ['parent', 'teacher', 'principal', 'student'],
      requiredTier: 'free'
    } as any,
  ]
}

// ============================================================================
// TOOL EXECUTORS
// ============================================================================

const toolExecutors: Record<string, (params: any, context: ToolContext) => Promise<any>> = {
  
  // ========================================
  // DATABASE QUERY EXECUTORS
  // ========================================
  
  async get_student_list(params: any, context: ToolContext) {
    const { supabaseAdmin, organizationId } = context
    
    if (!organizationId) {
      return { success: false, error: 'No organization found for user' }
    }
    
    let query = supabaseAdmin
      .from('students')
      .select('id, first_name, last_name, date_of_birth, classroom_id, status')
      .eq('preschool_id', organizationId)
    
    if (params.class_id) {
      query = query.eq('classroom_id', params.class_id)
    }
    
    if (!params.include_inactive) {
      query = query.eq('status', 'active')
    }
    
    query = query.limit(params.limit || 50)
    
    const { data, error } = await query
    
    if (error) {
      throw new Error(error.message)
    }
    
    return {
      count: data?.length || 0,
      students: data || [],
      organization_id: organizationId
    }
  },
  
  async get_student_progress(params: any, context: ToolContext) {
    const { supabaseAdmin } = context
    
    // Get student info
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, first_name, last_name, classroom_id')
      .eq('id', params.student_id)
      .single()
    
    if (studentError || !student) {
      throw new Error('Student not found')
    }
    
    // Get recent grades
    const daysBack = params.date_range_days || 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)
    
    let gradesQuery = supabaseAdmin
      .from('grades')
      .select('subject, score, date_recorded, assignment_name')
      .eq('student_id', params.student_id)
      .gte('date_recorded', startDate.toISOString())
      .order('date_recorded', { ascending: false })
      .limit(20)
    
    if (params.subject) {
      gradesQuery = gradesQuery.eq('subject', params.subject)
    }
    
    const { data: grades } = await gradesQuery
    
    // Calculate average
    const avgScore = grades && grades.length > 0
      ? grades.reduce((sum: number, g: any) => sum + (g.score || 0), 0) / grades.length
      : null
    
    return {
      student: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`
      },
      progress: {
        average_score: avgScore ? Math.round(avgScore * 10) / 10 : null,
        total_assessments: grades?.length || 0,
        recent_grades: grades || [],
        period_days: daysBack
      }
    }
  },
  
  // TODO: Re-enable after creating calendar_events table
  // async get_schedule(params: any, context: ToolContext) {
  //   const { supabaseAdmin, organizationId } = context
  //   
  //   if (!organizationId) {
  //     throw new Error('No organization found')
  //   }
  //   
  //   // Parse start date
  //   let startDate = new Date()
  //   if (params.start_date === 'tomorrow') {
  //     startDate.setDate(startDate.getDate() + 1)
  //   } else if (params.start_date && params.start_date !== 'today') {
  //     startDate = new Date(params.start_date)
  //   }
  //   startDate.setHours(0, 0, 0, 0)
  //   
  //   const endDate = new Date(startDate)
  //   endDate.setDate(endDate.getDate() + (params.days || 7))
  //   
  //   const { data: events, error } = await supabaseAdmin
  //     .from('calendar_events')
  //     .select('id, title, description, event_date, event_type, location')
  //     .eq('organization_id', organizationId)
  //     .gte('event_date', startDate.toISOString())
  //     .lte('event_date', endDate.toISOString())
  //     .order('event_date', { ascending: true })
  //     .limit(50)
  //   
  //   if (error) {
  //     throw new Error(error.message)
  //   }
  //   
  //   return {
  //     period: {
  //       start: startDate.toISOString().split('T')[0],
  //       end: endDate.toISOString().split('T')[0],
  //       days: params.days || 7
  //     },
  //     events: events || [],
  //     count: events?.length || 0
  //   }
  // },
  
  async get_assignments(params: any, context: ToolContext) {
    const { supabaseAdmin, organizationId, userId, role } = context
    
    if (!organizationId) {
      throw new Error('No organization found')
    }
    
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + (params.days_ahead || 30))
    
    let query = supabaseAdmin
      .from('homework_assignments')
      .select('id, title, description, subject, due_date, status, max_score')
      .eq('preschool_id', organizationId)
      .lte('due_date', endDate.toISOString())
      .order('due_date', { ascending: true })
      .limit(50)
    
    // Teachers only see their own assignments
    if (role === 'teacher') {
      query = query.eq('teacher_id', userId)
    }
    
    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status)
    }
    
    if (params.subject) {
      query = query.eq('subject', params.subject)
    }
    
    const { data: assignments, error } = await query
    
    if (error) {
      throw new Error(error.message)
    }
    
    return {
      assignments: (assignments || []).map((a: any) => ({
        ...a,
        points_possible: a.max_score // Alias for compatibility
      })),
      count: assignments?.length || 0,
      filters: {
        status: params.status || 'all',
        subject: params.subject,
        days_ahead: params.days_ahead || 30
      }
    }
  },
  
  async get_organization_stats(params: any, context: ToolContext) {
    const { supabaseAdmin, organizationId } = context
    
    if (!organizationId) {
      throw new Error('No organization found')
    }
    
    // Get organization name
    const { data: org } = await supabaseAdmin
      .from('preschools')
      .select('name, city, province')
      .eq('id', organizationId)
      .single()
    
    // Count students
    let studentsQuery = supabaseAdmin
      .from('students')
      .select('id, status', { count: 'exact', head: true })
      .eq('preschool_id', organizationId)
    
    if (!params.include_inactive) {
      studentsQuery = studentsQuery.eq('status', 'active')
    }
    
    const { count: studentCount } = await studentsQuery
    
    // Count teachers from profiles table (not deprecated users table)
    const { count: teacherCount } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('preschool_id', organizationId)
      .eq('role', 'teacher')
    
    // Count classes
    const { count: classCount } = await supabaseAdmin
      .from('classrooms')
      .select('id', { count: 'exact', head: true })
      .eq('preschool_id', organizationId)
    
    // Get student status breakdown
    const { data: studentsByStatus } = await supabaseAdmin
      .from('students')
      .select('status')
      .eq('preschool_id', organizationId)
    
    const statusBreakdown = studentsByStatus?.reduce((acc: any, s: any) => {
      acc[s.status] = (acc[s.status] || 0) + 1
      return acc
    }, {})
    
    return {
      organization: {
        id: organizationId,
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
      summary: `${org?.name || 'Your organization'} has ${studentCount || 0} ${params.include_inactive ? 'total' : 'active'} students, ${teacherCount || 0} teachers, and ${classCount || 0} classes.`
    }
  },
  
  async analyze_class_performance(params: any, context: ToolContext) {
    const { supabaseAdmin, organizationId } = context
    
    if (!organizationId) {
      throw new Error('No organization found')
    }
    
    // Get class info if provided
    let className = 'All Classes'
    if (params.class_id) {
      const { data: classroom } = await supabaseAdmin
        .from('classrooms')
        .select('name')
        .eq('id', params.class_id)
        .single()
      if (classroom) {
        className = classroom.name
      }
    }
    
    // Get students
    let studentsQuery = supabaseAdmin
      .from('students')
      .select('id, first_name, last_name')
      .eq('preschool_id', organizationId)
      .eq('status', 'active')
    
    if (params.class_id) {
      studentsQuery = studentsQuery.eq('classroom_id', params.class_id)
    }
    
    const { data: students } = await studentsQuery
    
    if (!students || students.length === 0) {
      throw new Error('No students found in class')
    }
    
    // Get grades
    const daysBack = params.days_back || 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)
    
    const studentIds = students.map((s: any) => s.id)
    
    let gradesQuery = supabaseAdmin
      .from('grades')
      .select('student_id, subject, score, date_recorded')
      .in('student_id', studentIds)
      .gte('date_recorded', startDate.toISOString())
    
    if (params.subject) {
      gradesQuery = gradesQuery.eq('subject', params.subject)
    }
    
    const { data: grades } = await gradesQuery
    
    // Calculate statistics
    const totalGrades = grades?.length || 0
    const avgScore = grades && grades.length > 0
      ? grades.reduce((sum: number, g: any) => sum + (g.score || 0), 0) / grades.length
      : 0
    
    // Find struggling students
    const studentScores = new Map<string, number[]>()
    grades?.forEach((g: any) => {
      if (!studentScores.has(g.student_id)) {
        studentScores.set(g.student_id, [])
      }
      studentScores.get(g.student_id)?.push(g.score || 0)
    })
    
    const strugglingStudents = []
    for (const [studentId, scores] of studentScores) {
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length
      if (avg < 60) {
        const student = students.find((s: any) => s.id === studentId)
        if (student) {
          strugglingStudents.push({
            id: studentId,
            name: `${student.first_name} ${student.last_name}`,
            average: Math.round(avg * 10) / 10
          })
        }
      }
    }
    
    return {
      class: {
        id: params.class_id,
        name: className,
        student_count: students.length
      },
      performance: {
        average_score: Math.round(avgScore * 10) / 10,
        total_assessments: totalGrades,
        period_days: daysBack,
        subject: params.subject || 'all subjects'
      },
      insights: {
        struggling_students: strugglingStudents,
        needs_attention: strugglingStudents.length > 0
      }
    }
  },
  
  // ========================================
  // CAPS CURRICULUM EXECUTORS
  // ========================================
  
  async search_caps_curriculum(params: any, context: ToolContext) {
    const { supabaseAdmin } = context
    
    let query = supabaseAdmin
      .from('caps_documents')
      .select('id, title, subject, grade, document_type, file_url, content_preview')
      .textSearch('content', params.query)
      .limit(params.limit || 5)
    
    if (params.grade) {
      query = query.eq('grade', params.grade)
    }
    
    if (params.subject) {
      query = query.eq('subject', params.subject)
    }
    
    const { data, error } = await query
    
    if (error) {
      throw new Error(error.message)
    }
    
    if (!data || data.length === 0) {
      return {
        found: false,
        message: `No CAPS documents found for "${params.query}"${params.grade ? ` in grade ${params.grade}` : ''}${params.subject ? ` for ${params.subject}` : ''}`
      }
    }
    
    return {
      found: true,
      count: data.length,
      documents: data.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        subject: doc.subject,
        grade: doc.grade,
        document_type: doc.document_type,
        file_url: doc.file_url,
        excerpt: doc.content_preview || 'Preview not available'
      }))
    }
  },
  
  async get_caps_documents(params: any, context: ToolContext) {
    const { supabaseAdmin } = context
    
    const { data, error } = await supabaseAdmin
      .from('caps_documents')
      .select('id, title, subject, grade, document_type, file_url, year')
      .eq('grade', params.grade)
      .eq('subject', params.subject)
    
    if (error) {
      throw new Error(error.message)
    }
    
    if (!data || data.length === 0) {
      return {
        found: false,
        message: `No CAPS documents found for ${params.subject} in grade ${params.grade}`
      }
    }
    
    return {
      found: true,
      count: data.length,
      documents: data.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        subject: doc.subject,
        grade: doc.grade,
        document_type: doc.document_type,
        file_url: doc.file_url,
        year: doc.year,
        source: 'Department of Basic Education'
      }))
    }
  },
  
  async get_caps_subjects(params: any, context: ToolContext) {
    const { supabaseAdmin } = context
    
    const { data, error } = await supabaseAdmin
      .from('caps_documents')
      .select('subject')
      .eq('grade', params.grade)
    
    if (error) {
      throw new Error(error.message)
    }
    
    const subjects = [...new Set(data?.map((d: any) => d.subject) || [])]
    
    return {
      grade: params.grade,
      count: subjects.length,
      subjects
    }
  },
  
  // New executors for image-to-curriculum flow
  async get_curriculum_for_topic(params: any, context: ToolContext) {
    const { supabaseAdmin } = context
    const limit = Math.min(Math.max(Number(params.limit || 5), 1), 20)

    let query = supabaseAdmin
      .from('caps_documents')
      .select('id, title, subject, grade, document_type, topic, section, file_url, year')
      .eq('grade', params.grade)
      .eq('subject', params.subject)
      .limit(limit)

    if (params.topic) {
      // Prefer topic match, fall back to text search
      query = query.ilike('topic', `%${params.topic}%`)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    if (!data || data.length === 0) {
      // Fallback: text search across content_text
      const { data: fallback } = await supabaseAdmin
        .from('caps_documents')
        .select('id, title, subject, grade, document_type, topic, section, file_url, year')
        .eq('grade', params.grade)
        .eq('subject', params.subject)
        .textSearch('content_text', params.topic)
        .limit(limit)

      return {
        found: (fallback?.length || 0) > 0,
        count: fallback?.length || 0,
        documents: fallback || []
      }
    }

    return {
      found: true,
      count: data.length,
      documents: data
    }
  },

  async get_similar_past_papers(params: any, context: ToolContext) {
    const { supabaseAdmin } = context
    const limit = Math.min(Math.max(Number(params.limit || 5), 1), 10)

    let query = supabaseAdmin
      .from('past_papers')
      .select('id, title, subject, grade, year, term, paper_number, exam_type, file_url, memo_file_url, total_marks, duration_minutes')
      .eq('grade', params.grade)
      .eq('subject', params.subject)
      .order('year', { ascending: false })
      .limit(limit)

    if (params.exam_type && params.exam_type !== 'all') {
      query = query.eq('exam_type', params.exam_type)
    }
    if (params.year) {
      query = query.eq('year', params.year)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return {
      found: (data?.length || 0) > 0,
      count: data?.length || 0,
      papers: data || []
    }
  },

  async create_exam_attempt(params: any, context: ToolContext) {
    const { supabaseAdmin, userId } = context

    const percentage = params.score_total > 0 ? (params.score_obtained / params.score_total) * 100 : null
    const gradeAchieved = percentage === null ? null : (
      percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'E'
    )

    const { data, error } = await supabaseAdmin
      .from('exam_user_progress')
      .insert({
        user_id: userId,
        exam_title: params.exam_title,
        grade: params.grade,
        subject: params.subject,
        score_obtained: params.score_obtained,
        score_total: params.score_total,
        percentage,
        grade_achieved: gradeAchieved,
        time_spent_minutes: params.time_spent_minutes || null,
        exam_generation_id: params.exam_generation_id || null,
        user_notes: params.user_notes || null,
        areas_to_improve: params.areas_to_improve || null
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)

    return { success: true, attempt_id: data.id }
  },
  
  // ========================================
  // COMMUNICATION EXECUTORS
  // ========================================
  
  async send_email(params: any, context: ToolContext) {
    const { supabaseAdmin, role } = context
    
    // Only teachers and principals can send email
    if (role !== 'teacher' && role !== 'principal') {
      throw new Error('Only teachers and principals can send emails')
    }
    
    // Call send-email Edge Function
    const { data, error } = await supabaseAdmin.functions.invoke('send-email', {
      body: {
        to: params.to.includes(',') ? params.to.split(',').map((e: string) => e.trim()) : params.to,
        subject: params.subject,
        body: params.body,
        reply_to: params.reply_to,
        is_html: params.is_html !== false,
        confirmed: true
      }
    })
    
    if (error) {
      throw new Error(error.message || 'Failed to send email')
    }
    
    if (!data.success) {
      throw new Error(data.error || 'Email sending failed')
    }
    
    return {
      message_id: data.message_id,
      message: `Email sent successfully to ${params.to}`,
      rate_limit: data.rate_limit,
      warning: data.warning
    }
  },
  
  // ========================================
  // PARENT-SPECIFIC EXECUTORS
  // ========================================
  
  async get_child_learning_context(params: any, context: ToolContext) {
    const { supabaseAdmin, role } = context
    
    if (role !== 'parent') {
      throw new Error('This tool is only available to parents')
    }
    
    const learningContext: any = {}
    
    // Get student info
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('first_name, last_name, date_of_birth, classroom_id')
      .eq('id', params.student_id)
      .single()
    
    if (studentError || !student) {
      throw new Error('Student not found')
    }
    
    learningContext.student = student
    
    // Get homework if requested
    if (params.include_homework && student.classroom_id) {
      const { data: homework } = await supabaseAdmin
        .from('homework_assignments')
        .select('id, title, description, due_date, subject')
        .eq('class_id', student.classroom_id)
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(5)
      
      learningContext.pending_homework = homework || []
    }
    
    // Get attendance if requested
    if (params.include_attendance) {
      const daysBack = params.days_back || 30
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: attendance } = await supabaseAdmin
        .from('attendance_records')
        .select('date, status')
        .eq('student_id', params.student_id)
        .gte('date', startDate)
        .order('date', { ascending: false })
      
      learningContext.attendance_summary = {
        records: attendance || [],
        present_count: attendance?.filter((a: any) => a.status === 'present').length || 0,
        total_days: attendance?.length || 0
      }
    }
    
    return learningContext
  },
  
  // ========================================
  // EXAM GENERATION EXECUTORS
  // ========================================
  
  async get_textbook_pages(params: any, context: ToolContext) {
    const { supabaseAdmin } = context
    
    console.log('[get_textbook_pages] Fetching pages:', params)
    
    // Validate parameters
    if (!params.textbook_id && !params.grade && !params.subject) {
      throw new Error('Must provide either textbook_id or both grade and subject')
    }
    
    let textbookId = params.textbook_id
    
    // If no textbook_id, search by grade and subject
    if (!textbookId && params.grade && params.subject) {
      const { data: books } = await supabaseAdmin
        .from('textbooks')
        .select('id')
        .eq('grade', params.grade)
        .eq('subject', params.subject)
        .eq('is_active', true)
        .limit(1)
      
      if (!books || books.length === 0) {
        return {
          found: false,
          message: `No textbook found for Grade ${params.grade} ${params.subject}`
        }
      }
      
      textbookId = books[0].id
    }
    
    // Fetch page content
    const { data: pages, error } = await supabaseAdmin
      .rpc('get_textbook_content', {
        p_textbook_id: textbookId,
        p_page_start: params.page_start || 1,
        p_page_end: params.page_end || params.page_start || 10
      })
    
    if (error) {
      console.error('[get_textbook_pages] Error:', error)
      return {
        found: false,
        message: 'Could not retrieve textbook content',
        error: error.message
      }
    }
    
    if (!pages || pages.length === 0) {
      return {
        found: false,
        message: 'No content available for these pages yet. Content is being prepared.',
        note: 'You can still generate exams based on the CAPS curriculum for this topic.'
      }
    }
    
    return {
      found: true,
      textbook_id: textbookId,
      pages: pages,
      total_pages: pages.length,
      content_summary: pages.map((p: any) => ({
        page: p.page_number,
        chapter: p.chapter_title,
        has_exercises: p.has_exercises
      }))
    }
  },
  
  async generate_caps_exam(params: any, context: ToolContext) {
    console.log('[generate_caps_exam] Generating exam with params:', JSON.stringify(params, null, 2))
    
    // Check if textbook pages were requested
    if (params.textbook_pages) {
      console.log('[generate_caps_exam] Textbook page references detected:', params.textbook_pages)
      // The AI should have already called get_textbook_pages before this
      // This is just a marker that the exam is based on specific pages
    }
    
    // Validate required fields
    if (!params.grade || !params.subject || !params.sections || !params.sections.length) {
      throw new Error('Missing required exam parameters: grade, subject, and sections')
    }
    
    // Process sections to ensure proper structure
    const processedSections = params.sections.map((section: any, sectionIndex: number) => {
      const questions = section.questions.map((q: any, qIndex: number) => {
        // Generate ID if not provided
        const questionId = q.id || `q-${sectionIndex}-${qIndex}`
        
        return {
          id: questionId,
          number: q.number || String(qIndex + 1),
          text: q.text,
          type: q.type || 'short_answer',
          marks: q.marks || 1,
          options: q.options || undefined,
          correctAnswer: q.correctAnswer || undefined,
          sectionTitle: section.title
        }
      })
      
      return {
        title: section.title,
        instructions: section.instructions || '',
        questions
      }
    })
    
    // Calculate total marks if not provided
    const totalMarks = params.total_marks || processedSections.reduce((sum: number, section: any) => {
      return sum + section.questions.reduce((qSum: number, q: any) => qSum + (q.marks || 0), 0)
    }, 0)
    
    // Build the exam object
    const exam = {
      success: true,
      data: {
        title: params.title || `${params.grade} ${params.subject} Exam`,
        grade: params.grade,
        subject: params.subject,
        examType: params.exam_type || 'practice_test',
        instructions: params.instructions || [
          'Read all instructions carefully before starting.',
          'Answer all questions.',
          'Write neatly and legibly.',
          'Show all your working for calculations.'
        ],
        sections: processedSections,
        totalMarks,
        durationMinutes: params.duration_minutes || null,
        hasMemo: processedSections.some((s: any) => 
          s.questions.some((q: any) => q.correctAnswer)
        )
      }
    }
    
    console.log('[generate_caps_exam] Generated exam:', JSON.stringify(exam, null, 2))
    
    return exam
  }
}
