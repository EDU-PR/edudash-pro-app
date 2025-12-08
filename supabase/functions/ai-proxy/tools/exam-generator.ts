/**
 * Exam Generator Tool
 * 
 * Generates CAPS-aligned examinations with validation.
 */

import type { ToolExecutionResult } from '../types.ts'
import type { ToolContext } from './tool-registry.ts'
import { validateExam } from '../validation/exam-validator.ts'
import { validateQuestion, hasTextualDataset, isVisualReference } from '../validation/question-validator.ts'

/**
 * Execute CAPS exam generation tool
 * Validates and returns structured exam data
 */
export async function executeExamGenerator(
  input: Record<string, any>,
  context: ToolContext
): Promise<ToolExecutionResult> {
  console.log('[ai-proxy] Executing generate_caps_exam tool with input:', JSON.stringify(input, null, 2))
  
  // Validate required fields
  let { title, grade, subject, sections, totalMarks } = input
  
  if (!title || !grade || !subject || !sections) {
    const missing = []
    if (!title) missing.push('title')
    if (!grade) missing.push('grade')
    if (!subject) missing.push('subject')
    if (!sections) missing.push('sections')
    console.error('[ai-proxy] Missing fields:', missing.join(', '))
    return {
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`
    }
  }
  
  // Calculate totalMarks if missing (sum from all questions)
  if (!totalMarks && Array.isArray(sections)) {
    totalMarks = sections.reduce((total: number, section: any) => {
      if (Array.isArray(section.questions)) {
        return total + section.questions.reduce((sectionTotal: number, q: any) => {
          return sectionTotal + (Number(q.marks) || 0)
        }, 0)
      }
      return total
    }, 0)
    console.log(`[ai-proxy] Calculated totalMarks: ${totalMarks}`)
  }
  
  // Validate sections have questions
  if (!Array.isArray(sections) || sections.length === 0) {
    return {
      success: false,
      error: 'Exam must have at least one section with questions'
    }
  }
  
  // Detect grade level for age-appropriate validation
  const gradeStr = String(grade).toLowerCase()
  const isFoundationPhase = gradeStr.match(/\b(r|grade r|1|2|3|grade 1|grade 2|grade 3)\b/i)
  const minQuestionLength = isFoundationPhase ? 10 : 20 // Shorter questions allowed for young learners
  
  // Validate questions are complete
  for (const section of sections) {
    if (!section.questions || section.questions.length === 0) {
      return {
        success: false,
        error: `Section "${section.title}" has no questions`
      }
    }
    
    for (const question of section.questions) {
      const qText: string = String(question.text || '').trim()

      // Check for vague questions without data (age-appropriate threshold)
      if (qText.length < minQuestionLength) {
        return {
          success: false,
          error: `Question "${qText}" is too short. Questions must be complete with all data.`
        }
      }
      
      // Disallow external visual references UNLESS a diagram is provided
      // If question has a diagram field, visual references are OK (the diagram IS the visual)
      const hasDiagram = !!(question.diagram && question.diagram.type && question.diagram.data)
      const hasImages = !!(question.images && question.images.length > 0)
      
      // Use validation from question-validator module
      const validationResult = validateQuestion(qText, hasDiagram, hasImages)
      if (!validationResult.success) {
        return {
          success: false,
          error: validationResult.error
        }
      }
      
      // Check for action verbs (age-appropriate - foundation phase uses simpler verbs)
      const actionVerbs = isFoundationPhase
        ? /\b(count|circle|match|choose|select|find|name|list|show|draw|color|colour|write|identify|point|tick|cross|trace|cut|paste|measure|sort|group|build|make|complete|fill|change|correct|rewrite)\b/i
        : /\b(calculate|compute|simplify|solve|list|identify|name|describe|explain|compare|choose|select|find|determine|evaluate|analyze|analyse|write|state|give|show|classify|match|order|arrange|label|prove|derive|expand|factorise|factorize|convert|graph|plot|sketch|measure|estimate|construct|complete|continue|extend|fill|rewrite|correct|edit|change|transform|translate|rephrase|paraphrase|summarize|summarise|underline|highlight|justify|define|discuss|outline|illustrate)\b/i
      
      if (!actionVerbs.test(qText)) {
        const suggestionVerbs = isFoundationPhase 
          ? 'Count, Circle, Match, Choose, or Find'
          : 'Calculate, Simplify, Solve, List, or Identify'
        return {
          success: false,
          error: `Question "${qText.substring(0, 80)}..." missing clear action verb (e.g., ${suggestionVerbs})`
        }
      }
    }
  }
  
  // All validation passed - return structured exam
  const exam = {
    title,
    grade,
    subject,
    language: input.language || 'en-ZA',
    instructions: input.instructions || [],
    sections,
    totalMarks,
    hasMemo: false  // Can be enhanced later
  }
  
  console.log(`[ai-proxy] Generated exam: ${sections.length} sections, ${sections.reduce((sum: number, s: any) => sum + s.questions.length, 0)} questions, ${totalMarks} marks`)
  
  return {
    success: true,
    result: exam
  }
}

/**
 * Validate exam sections structure
 */
export function validateSections(sections: any[]): { valid: boolean; error?: string } {
  if (!Array.isArray(sections)) {
    return { valid: false, error: 'Sections must be an array' }
  }
  
  if (sections.length === 0) {
    return { valid: false, error: 'Exam must have at least one section' }
  }
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    
    if (!section.title) {
      return { valid: false, error: `Section ${i + 1} is missing a title` }
    }
    
    if (!Array.isArray(section.questions) || section.questions.length === 0) {
      return { valid: false, error: `Section "${section.title}" has no questions` }
    }
  }
  
  return { valid: true }
}

/**
 * Calculate total marks from exam sections
 */
export function calculateTotalMarks(sections: any[]): number {
  return sections.reduce((total: number, section: any) => {
    if (!Array.isArray(section.questions)) return total
    
    return total + section.questions.reduce((sectionTotal: number, q: any) => {
      return sectionTotal + (Number(q.marks) || 0)
    }, 0)
  }, 0)
}

/**
 * Detect foundation phase (Grade R-3) for age-appropriate validation
 */
export function isFoundationPhase(grade: string): boolean {
  const gradeStr = String(grade).toLowerCase()
  // Match "r", "grade r", "grade_r", "1", "grade 1", "grade_1", etc.
  return !!(gradeStr.match(/^(r|grade[_\s]?r|[123]|grade[_\s]?[123])$/i))
}

/**
 * Get appropriate action verbs for grade level
 */
export function getActionVerbsPattern(isFoundation: boolean): RegExp {
  if (isFoundation) {
    // Simpler verbs for young learners
    return /\b(count|circle|match|choose|select|find|name|list|show|draw|color|colour|write|identify|point|tick|cross|trace|cut|paste|measure|sort|group|build|make|complete|fill|change|correct|rewrite)\b/i
  }
  
  // Comprehensive verbs for older students
  return /\b(calculate|compute|simplify|solve|list|identify|name|describe|explain|compare|choose|select|find|determine|evaluate|analyze|analyse|write|state|give|show|classify|match|order|arrange|label|prove|derive|expand|factorise|factorize|convert|graph|plot|sketch|measure|estimate|construct|complete|continue|extend|fill|rewrite|correct|edit|change|transform|translate|rephrase|paraphrase|summarize|summarise|underline|highlight|justify|define|discuss|outline|illustrate)\b/i
}
