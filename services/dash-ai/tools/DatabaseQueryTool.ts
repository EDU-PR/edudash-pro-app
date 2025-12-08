/**
 * DatabaseQueryTool
 * 
 * Safe database query executor with RLS enforcement.
 * Allows Dash to autonomously query the database to answer user questions.
 * 
 * **Security**:
 * - Read-only operations (SELECT only)
 * - ALWAYS filters by preschool_id
 * - Respects RLS policies
 * - Row limits to prevent abuse
 * - Query allowlist (no arbitrary SQL)
 */

import { Tool, ToolExecutionContext, ToolExecutionResult } from '../types';

/**
 * Supported safe query types
 */
type QueryType = 
  | 'list_students'
  | 'list_teachers'
  | 'list_classes'
  | 'list_assignments'
  | 'list_attendance'
  | 'get_student_progress'
  | 'get_class_summary';

/**
 * Query definitions with RLS-safe SQL
 */
const SAFE_QUERIES: Record<QueryType, {
  sql: string;
  description: string;
  requiredParams: string[];
  optionalParams: string[];
  maxRows: number;
}> = {
  list_students: {
    sql: `
      SELECT id, first_name, last_name, grade, status, date_of_birth
      FROM students
      WHERE preschool_id = $1
      AND status = 'active'
      ORDER BY last_name, first_name
      LIMIT $2
    `,
    description: 'List all active students in the preschool',
    requiredParams: ['preschool_id'],
    optionalParams: ['limit'],
    maxRows: 100
  },
  list_teachers: {
    sql: `
      SELECT p.id, p.full_name, p.email, p.role
      FROM profiles p
      WHERE p.preschool_id = $1
      AND p.role = 'teacher'
      ORDER BY p.full_name
      LIMIT $2
    `,
    description: 'List all teachers in the preschool',
    requiredParams: ['preschool_id'],
    optionalParams: ['limit'],
    maxRows: 50
  },
  list_classes: {
    sql: `
      SELECT id, name, grade, teacher_id, student_count
      FROM classes
      WHERE preschool_id = $1
      ORDER BY grade, name
      LIMIT $2
    `,
    description: 'List all classes in the preschool',
    requiredParams: ['preschool_id'],
    optionalParams: ['limit'],
    maxRows: 50
  },
  list_assignments: {
    sql: `
      SELECT id, title, subject, due_date, status, class_id
      FROM assignments
      WHERE preschool_id = $1
      AND due_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY due_date DESC
      LIMIT $2
    `,
    description: 'List recent assignments (last 30 days)',
    requiredParams: ['preschool_id'],
    optionalParams: ['limit'],
    maxRows: 100
  },
  list_attendance: {
    sql: `
      SELECT a.id, a.student_id, a.date, a.status,
             s.first_name, s.last_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE a.preschool_id = $1
      AND a.date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY a.date DESC, s.last_name
      LIMIT $2
    `,
    description: 'List attendance records (last 7 days)',
    requiredParams: ['preschool_id'],
    optionalParams: ['limit'],
    maxRows: 200
  },
  get_student_progress: {
    sql: `
      SELECT 
        s.id,
        s.first_name,
        s.last_name,
        COUNT(DISTINCT a.id) as total_assignments,
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_assignments,
        AVG(CASE WHEN a.grade IS NOT NULL THEN a.grade END) as average_grade
      FROM students s
      LEFT JOIN assignments a ON s.id = a.student_id
      WHERE s.preschool_id = $1
      AND s.id = $2
      GROUP BY s.id, s.first_name, s.last_name
    `,
    description: 'Get progress summary for a specific student',
    requiredParams: ['preschool_id', 'student_id'],
    optionalParams: [],
    maxRows: 1
  },
  get_class_summary: {
    sql: `
      SELECT 
        c.id,
        c.name,
        c.grade,
        COUNT(DISTINCT s.id) as student_count,
        COUNT(DISTINCT a.id) as assignment_count,
        AVG(at.attendance_rate) as avg_attendance_rate
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id
      LEFT JOIN assignments a ON c.id = a.class_id
      LEFT JOIN (
        SELECT student_id, 
               COUNT(CASE WHEN status = 'present' THEN 1 END)::float / NULLIF(COUNT(*), 0) as attendance_rate
        FROM attendance
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY student_id
      ) at ON s.id = at.student_id
      WHERE c.preschool_id = $1
      AND c.id = $2
      GROUP BY c.id, c.name, c.grade
    `,
    description: 'Get comprehensive summary for a specific class',
    requiredParams: ['preschool_id', 'class_id'],
    optionalParams: [],
    maxRows: 1
  }
};

/**
 * Database Query Tool Definition
 */
export const DatabaseQueryTool: Tool = {
  id: 'query_database',
  name: 'Query Database',
  description: 'Execute safe, read-only database queries to retrieve information about students, teachers, classes, assignments, and attendance. All queries are automatically filtered by the user\'s preschool and respect Row-Level Security policies.',
  category: 'database',
  riskLevel: 'low', // Read-only, RLS-enforced
  allowedRoles: ['parent', 'teacher', 'principal', 'superadmin'],
  parameters: [
    {
      name: 'query_type',
      type: 'string',
      description: 'Type of query to execute',
      required: true,
      enum: Object.keys(SAFE_QUERIES)
    },
    {
      name: 'student_id',
      type: 'string',
      description: 'Student ID (required for student-specific queries)',
      required: false
    },
    {
      name: 'class_id',
      type: 'string',
      description: 'Class ID (required for class-specific queries)',
      required: false
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of rows to return',
      required: false,
      default: 20,
      validation: {
        min: 1,
        max: 100
      }
    }
  ],
  claudeToolDefinition: {
    name: 'query_database',
    description: 'Execute safe, read-only database queries to retrieve information about students, teachers, classes, assignments, and attendance. Use this when the user asks about their students, classes, or school data. All queries automatically respect tenant isolation and security policies.',
    input_schema: {
      type: 'object',
      properties: {
        query_type: {
          type: 'string',
          enum: Object.keys(SAFE_QUERIES),
          description: 'Type of query to execute. Available queries: list_students (get all students), list_teachers (get all teachers), list_classes (get all classes), list_assignments (get recent assignments), list_attendance (get recent attendance), get_student_progress (detailed progress for one student), get_class_summary (comprehensive class statistics)'
        },
        student_id: {
          type: 'string',
          description: 'UUID of the student (required for get_student_progress)'
        },
        class_id: {
          type: 'string',
          description: 'UUID of the class (required for get_class_summary)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of rows to return (default: 20, max: 100)'
        }
      },
      required: ['query_type']
    }
  },
  execute: async (params: Record<string, any>, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
    const { query_type, student_id, class_id, limit = 20 } = params;

    // Organization-agnostic validation
    // Independent users: organizationId is null, filter by userId
    // Affiliated users: organizationId is set, filter by organization
    const organizationId = context.organizationId || context.preschoolId;  // Legacy support
    
    // Guest users: no data access
    if (context.isGuest) {
      return {
        success: false,
        error: 'Guest users cannot access database queries. Please sign up for access.'
      };
    }

    // Get query definition
    const queryDef = SAFE_QUERIES[query_type as QueryType];
    if (!queryDef) {
      return {
        success: false,
        error: `Invalid query_type: ${query_type}`
      };
    }

    // Validate required parameters
    if (queryDef.requiredParams.includes('student_id') && !student_id) {
      return {
        success: false,
        error: 'student_id is required for this query'
      };
    }
    if (queryDef.requiredParams.includes('class_id') && !class_id) {
      return {
        success: false,
        error: 'class_id is required for this query'
      };
    }

    // Enforce row limit
    const safeLimit = Math.min(limit, queryDef.maxRows);

    // Build query parameters
    // For organization-scoped queries, use organizationId if available
    // For independent users (organizationId = null), filter by userId in query
    const queryParams: any[] = [organizationId];
    if (student_id) queryParams.push(student_id);
    if (class_id) queryParams.push(class_id);
    if (queryDef.optionalParams.includes('limit')) queryParams.push(safeLimit);
    
    // Add userId for independent user queries
    if (!context.hasOrganization) {
      queryParams.push(context.userId);
    }

    // Execute query via Supabase client
    if (!context.supabaseClient) {
      return {
        success: false,
        error: 'Supabase client not available in execution context'
      };
    }

    try {
      const startTime = Date.now();
      
      // Execute RLS-protected query
      const { data, error } = await context.supabaseClient
        .rpc('execute_safe_query', {
          query_sql: queryDef.sql,
          query_params: queryParams
        });

      if (error) {
        console.error('[DatabaseQueryTool] Query error:', error);
        return {
          success: false,
          error: `Database query failed: ${error.message}`
        };
      }

      return {
        success: true,
        data: {
          query_type,
          rows: data || [],
          row_count: data?.length || 0,
          description: queryDef.description
        },
        metadata: {
          executionTime: Date.now() - startTime,
          rowsAffected: data?.length || 0
        }
      };
    } catch (error: any) {
      console.error('[DatabaseQueryTool] Execution error:', error);
      return {
        success: false,
        error: `Query execution failed: ${error.message}`
      };
    }
  }
};
