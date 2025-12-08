/**
 * Database Query Tool
 * 
 * Executes safe, read-only database queries with RLS protection.
 */

import type { ToolExecutionResult } from '../types.ts'
import type { ToolContext } from './tool-registry.ts'

/**
 * Query type definitions with RLS filters
 */
interface QueryDefinition {
  table: string
  select: string
  filter?: Record<string, any>
  personalFilter?: boolean  // Can be filtered by userId for independent users
}

/**
 * Execute database query tool
 */
export async function executeDatabaseQuery(
  input: Record<string, any>,
  context: ToolContext
): Promise<ToolExecutionResult> {
  console.log('[ai-proxy] Executing query_database tool with input:', JSON.stringify(input, null, 2))
  
  const { query_type, student_id, class_id, limit = 20 } = input
  
  // Validate query type
  if (!query_type) {
    return {
      success: false,
      error: 'Missing required field: query_type'
    }
  }
  
  // Define available queries with RLS protection
  const queries: Record<string, QueryDefinition> = {
    list_students: {
      table: 'students',
      select: 'id, first_name, last_name, grade, status, date_of_birth',
      filter: context.organizationId ? { organization_id: context.organizationId, status: 'active' } : undefined,
      personalFilter: true  // Can be filtered by userId for independent users
    },
    list_teachers: {
      table: 'profiles',
      select: 'id, full_name, email, role',
      filter: context.organizationId ? { organization_id: context.organizationId, role: 'teacher' } : undefined,
      personalFilter: false  // Org-only
    },
    list_classes: {
      table: 'classes',
      select: 'id, name, grade, teacher_id, student_count',
      filter: context.organizationId ? { organization_id: context.organizationId } : undefined,
      personalFilter: false  // Org-only
    },
    list_assignments: {
      table: 'assignments',
      select: 'id, title, subject, due_date, status, class_id',
      filter: context.organizationId ? { organization_id: context.organizationId } : undefined,
      personalFilter: true  // Can query personal assignments
    },
    list_attendance: {
      table: 'attendance',
      select: 'id, student_id, date, status',
      filter: context.organizationId ? { organization_id: context.organizationId } : undefined,
      personalFilter: true  // Can query personal attendance
    },
    get_student_progress: {
      table: 'student_progress',
      select: 'id, student_id, subject, score, date, notes',
      filter: context.organizationId ? { organization_id: context.organizationId } : undefined,
      personalFilter: true
    },
    get_class_summary: {
      table: 'classes',
      select: 'id, name, grade, teacher_id, student_count, average_attendance, average_score',
      filter: context.organizationId ? { organization_id: context.organizationId } : undefined,
      personalFilter: false
    }
  }
  
  const queryDef = queries[query_type]
  if (!queryDef) {
    return {
      success: false,
      error: `Invalid query_type: ${query_type}. Available types: ${Object.keys(queries).join(', ')}`
    }
  }
  
  // Independent users: only allow personal queries
  if (!context.hasOrganization && !queryDef.personalFilter) {
    return {
      success: false,
      error: `Query '${query_type}' requires organization membership`
    }
  }
  
  // Guest users: no database access
  if (context.isGuest) {
    return {
      success: false,
      error: 'Database queries are not available for guest users'
    }
  }
  
  try {
    let query = context.supabaseAdmin
      .from(queryDef.table)
      .select(queryDef.select)
    
    // Apply filters (organization or personal)
    if (queryDef.filter) {
      Object.entries(queryDef.filter).forEach(([key, value]) => {
        query = query.eq(key, value)
      })
    } else if (queryDef.personalFilter && !context.hasOrganization) {
      // Independent user: filter by userId for personal data
      query = query.eq('user_id', context.userId).is('organization_id', null)
    }
    
    // Apply student/class filters if provided
    if (student_id) {
      query = query.eq('student_id', student_id)
    }
    if (class_id) {
      query = query.eq('class_id', class_id)
    }
    
    // Apply limit (max 100)
    const safeLimit = Math.min(Math.max(limit, 1), 100)
    query = query.limit(safeLimit)
    
    const { data, error } = await query
    
    if (error) {
      console.error('[ai-proxy] Database query error:', error)
      return {
        success: false,
        error: `Database query failed: ${error.message}`
      }
    }
    
    console.log(`[ai-proxy] Query ${query_type} returned ${data?.length || 0} rows`)
    
    return {
      success: true,
      result: {
        query_type,
        rows: data || [],
        row_count: data?.length || 0
      }
    }
  } catch (error: any) {
    console.error('[ai-proxy] Query execution error:', error)
    return {
      success: false,
      error: `Query execution failed: ${error.message}`
    }
  }
}

/**
 * Validate query parameters
 */
export function validateQueryParams(input: Record<string, any>): { valid: boolean; error?: string } {
  if (!input.query_type) {
    return { valid: false, error: 'Missing required field: query_type' }
  }
  
  // Validate student_id if provided
  if (input.student_id && typeof input.student_id !== 'string') {
    return { valid: false, error: 'student_id must be a string (UUID)' }
  }
  
  // Validate class_id if provided
  if (input.class_id && typeof input.class_id !== 'string') {
    return { valid: false, error: 'class_id must be a string (UUID)' }
  }
  
  // Validate limit if provided
  if (input.limit !== undefined) {
    const limit = Number(input.limit)
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return { valid: false, error: 'limit must be a number between 1 and 100' }
    }
  }
  
  return { valid: true }
}

/**
 * Get available query types for a role
 */
export function getAvailableQueryTypes(role: string, hasOrganization: boolean): string[] {
  const baseQueries = ['list_students', 'list_assignments', 'list_attendance', 'get_student_progress']
  
  if (!hasOrganization) {
    // Independent users: only personal queries
    return baseQueries
  }
  
  // Organization users: all queries
  return [
    ...baseQueries,
    'list_teachers',
    'list_classes',
    'get_class_summary'
  ]
}

/**
 * Check if user has access to a specific query type
 */
export function hasQueryAccess(queryType: string, hasOrganization: boolean): boolean {
  const queries: Record<string, { personalFilter?: boolean }> = {
    list_students: { personalFilter: true },
    list_teachers: { personalFilter: false },
    list_classes: { personalFilter: false },
    list_assignments: { personalFilter: true },
    list_attendance: { personalFilter: true },
    get_student_progress: { personalFilter: true },
    get_class_summary: { personalFilter: false }
  }
  
  const queryDef = queries[queryType]
  if (!queryDef) return false
  
  // If query doesn't allow personal filter and user has no org, deny access
  if (!hasOrganization && !queryDef.personalFilter) {
    return false
  }
  
  return true
}
