/**
 * Super Admin AI Proxy - Full Agentic Capabilities
 * 
 * This is a dedicated AI proxy for super admins with:
 * - NO rate limits or quotas
 * - Full Claude Opus/Sonnet access
 * - Database query and modification tools
 * - GitHub integration for code changes
 * - EAS/Expo deployment tools
 * - System administration tools
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')
const EAS_ACCESS_TOKEN = Deno.env.get('EAS_ACCESS_TOKEN')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SuperAdminRequest {
  action: 'chat' | 'query_database' | 'modify_database' | 'github_operation' | 'eas_operation' | 'system_operation'
  message?: string
  history?: Array<{ role: string, content: string }>
  query?: string
  operation?: string
  parameters?: Record<string, unknown>
  stream?: boolean
  max_tokens?: number
}

// Super admin tool definitions for Claude
const SUPERADMIN_TOOLS = [
  {
    name: 'query_database',
    description: 'Execute a read-only SQL query against the database. Returns up to 100 rows. Use for analytics, reports, and data inspection.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The SQL SELECT query to execute. Must be read-only (SELECT statements only).'
        },
        explanation: {
          type: 'string',
          description: 'Brief explanation of what this query does and why.'
        }
      },
      required: ['query', 'explanation']
    }
  },
  {
    name: 'modify_database',
    description: 'Execute a data modification query (INSERT, UPDATE, DELETE). Requires explicit confirmation. Changes are logged.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The SQL modification query (INSERT, UPDATE, DELETE).'
        },
        explanation: {
          type: 'string',
          description: 'Detailed explanation of what this modification does and the expected impact.'
        },
        affected_tables: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of tables that will be affected.'
        }
      },
      required: ['query', 'explanation', 'affected_tables']
    }
  },
  {
    name: 'get_platform_stats',
    description: 'Get comprehensive platform statistics including users, schools, subscriptions, revenue, and AI usage.',
    input_schema: {
      type: 'object',
      properties: {
        time_range: {
          type: 'string',
          enum: ['today', 'week', 'month', 'quarter', 'year', 'all'],
          description: 'Time range for statistics.'
        }
      },
      required: ['time_range']
    }
  },
  {
    name: 'list_schools',
    description: 'List all schools/preschools with their status, subscription tier, and key metrics.',
    input_schema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'active', 'inactive', 'trial', 'churned'],
          description: 'Filter schools by status.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of schools to return (default 50).'
        }
      },
      required: []
    }
  },
  {
    name: 'list_users',
    description: 'List users with optional filtering by role, school, or status.',
    input_schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: ['all', 'super_admin', 'principal', 'teacher', 'parent', 'student'],
          description: 'Filter by user role.'
        },
        school_id: {
          type: 'string',
          description: 'Filter by specific school ID.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of users to return (default 50).'
        }
      },
      required: []
    }
  },
  {
    name: 'get_ai_usage',
    description: 'Get AI usage statistics and costs across the platform.',
    input_schema: {
      type: 'object',
      properties: {
        time_range: {
          type: 'string',
          enum: ['today', 'week', 'month'],
          description: 'Time range for AI usage data.'
        },
        group_by: {
          type: 'string',
          enum: ['school', 'user', 'model', 'day'],
          description: 'How to group the usage data.'
        }
      },
      required: ['time_range']
    }
  },
  {
    name: 'github_list_prs',
    description: 'List open pull requests in the repository.',
    input_schema: {
      type: 'object',
      properties: {
        state: {
          type: 'string',
          enum: ['open', 'closed', 'all'],
          description: 'PR state to filter by.'
        }
      },
      required: []
    }
  },
  {
    name: 'github_search_code',
    description: 'Search for code in the repository. Use for finding functions, classes, or code patterns.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query (e.g., function name, class name, code pattern).'
        },
        path: {
          type: 'string',
          description: 'Optional: limit search to specific path (e.g., "components/", "services/").'
        },
        extension: {
          type: 'string',
          description: 'Optional: limit to file extension (e.g., "tsx", "ts", "sql").'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'github_get_file',
    description: 'Get the contents of a specific file from the repository.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file.'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'run_terminal_command',
    description: 'Execute a terminal command via the secure proxy. Allowed commands: npm run lint/test/build, supabase db push/diff, git status.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The command to run (e.g., "npm run lint").'
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional arguments for the command.'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'create_file',
    description: 'Create a new file in the repository via GitHub API.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path where the file should be created.'
        },
        content: {
          type: 'string',
          description: 'The content of the file.'
        },
        message: {
          type: 'string',
          description: 'Commit message.'
        }
      },
      required: ['path', 'content', 'message']
    }
  },
          type: 'string',
          description: 'The file path relative to repo root (e.g., "components/DashOrb.tsx").'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'github_get_commits',
    description: 'Get recent commits from the repository.',
    input_schema: {
      type: 'object',
      properties: {
        branch: {
          type: 'string',
          description: 'Branch name (default: main).'
        },
        limit: {
          type: 'number',
          description: 'Number of commits to return (default 10).'
        }
      },
      required: []
    }
  },
  {
    name: 'eas_list_builds',
    description: 'List recent EAS builds for the project.',
    input_schema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['all', 'ios', 'android'],
          description: 'Filter by platform.'
        },
        status: {
          type: 'string',
          enum: ['all', 'finished', 'in-progress', 'errored'],
          description: 'Filter by build status.'
        }
      },
      required: []
    }
  },
  {
    name: 'eas_trigger_build',
    description: 'Trigger a new EAS build. Requires confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'all'],
          description: 'Platform to build for.'
        },
        profile: {
          type: 'string',
          enum: ['development', 'preview', 'production'],
          description: 'Build profile to use.'
        }
      },
      required: ['platform', 'profile']
    }
  },
  {
    name: 'send_announcement',
    description: 'Send a platform-wide announcement to all users or specific schools.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Announcement title.'
        },
        message: {
          type: 'string',
          description: 'Announcement message content.'
        },
        target: {
          type: 'string',
          enum: ['all', 'principals', 'teachers', 'parents'],
          description: 'Target audience for the announcement.'
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: 'Priority level.'
        }
      },
      required: ['title', 'message', 'target']
    }
  },
  {
    name: 'manage_feature_flag',
    description: 'Enable, disable, or configure a feature flag.',
    input_schema: {
      type: 'object',
      properties: {
        flag_name: {
          type: 'string',
          description: 'Name of the feature flag.'
        },
        action: {
          type: 'string',
          enum: ['enable', 'disable', 'set_percentage'],
          description: 'Action to perform.'
        },
        percentage: {
          type: 'number',
          description: 'Rollout percentage (0-100) if action is set_percentage.'
        }
      },
      required: ['flag_name', 'action']
    }
  },
  {
    name: 'generate_report',
    description: 'Generate a comprehensive platform report.',
    input_schema: {
      type: 'object',
      properties: {
        report_type: {
          type: 'string',
          enum: ['revenue', 'usage', 'growth', 'churn', 'ai_costs', 'security', 'full'],
          description: 'Type of report to generate.'
        },
        time_range: {
          type: 'string',
          enum: ['week', 'month', 'quarter', 'year'],
          description: 'Time range for the report.'
        },
        format: {
          type: 'string',
          enum: ['summary', 'detailed', 'csv'],
          description: 'Report format.'
        }
      },
      required: ['report_type', 'time_range']
    }
  },
  {
    name: 'generate_lesson_plan',
    description: 'Generate a comprehensive CAPS-aligned lesson plan for South African curriculum.',
    input_schema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Subject area (e.g., Mathematics, Life Skills, English)'
        },
        grade: {
          type: 'string',
          description: 'Grade level (e.g., Grade R, Grade 1-3)'
        },
        topic: {
          type: 'string',
          description: 'Specific topic or concept to teach'
        },
        duration: {
          type: 'number',
          description: 'Lesson duration in minutes (default 45)'
        },
        learning_outcomes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific learning outcomes to achieve'
        }
      },
      required: ['subject', 'grade', 'topic']
    }
  },
  {
    name: 'generate_stem_activity',
    description: 'Generate hands-on STEM activity (robotics, coding, electronics, engineering).',
    input_schema: {
      type: 'object',
      properties: {
        activity_type: {
          type: 'string',
          enum: ['robotics', 'coding', 'electronics', 'engineering', 'science_experiment'],
          description: 'Type of STEM activity'
        },
        age_group: {
          type: 'string',
          description: 'Target age group (e.g., 5-7, 8-10, 11-13)'
        },
        difficulty: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced'],
          description: 'Difficulty level'
        },
        materials: {
          type: 'array',
          items: { type: 'string' },
          description: 'Available materials/equipment'
        },
        duration: {
          type: 'number',
          description: 'Activity duration in minutes'
        }
      },
      required: ['activity_type', 'age_group', 'difficulty']
    }
  },
  {
    name: 'create_curriculum_module',
    description: 'Create a multi-week curriculum module with progressive lessons.',
    input_schema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Subject area or skill focus'
        },
        topic: {
          type: 'string',
          description: 'Overall module topic'
        },
        grade: {
          type: 'string',
          description: 'Grade level'
        },
        weeks: {
          type: 'number',
          description: 'Number of weeks for the module (default 4)'
        },
        lessons_per_week: {
          type: 'number',
          description: 'Number of lessons per week (default 3)'
        }
      },
      required: ['subject', 'topic', 'grade']
    }
  },
  {
    name: 'generate_digital_skills_lesson',
    description: 'Generate lesson for digital literacy, computer skills, or online safety.',
    input_schema: {
      type: 'object',
      properties: {
        skill_area: {
          type: 'string',
          enum: ['typing', 'internet_basics', 'online_safety', 'email', 'digital_citizenship', 'basic_coding', 'productivity_apps'],
          description: 'Digital skill to teach'
        },
        age_group: {
          type: 'string',
          description: 'Target age group'
        },
        prior_knowledge: {
          type: 'string',
          enum: ['none', 'basic', 'intermediate'],
          description: 'Students prior digital knowledge level'
        },
        duration: {
          type: 'number',
          description: 'Lesson duration in minutes'
        }
      },
      required: ['skill_area', 'age_group']
    }
  },
  {
    name: 'generate_worksheet',
    description: 'Generate printable worksheet with exercises and activities.',
    input_schema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Subject area'
        },
        topic: {
          type: 'string',
          description: 'Specific topic'
        },
        grade: {
          type: 'string',
          description: 'Grade level'
        },
        worksheet_type: {
          type: 'string',
          enum: ['practice', 'assessment', 'homework', 'revision', 'project'],
          description: 'Type of worksheet'
        },
        question_count: {
          type: 'number',
          description: 'Number of questions/activities (default 10)'
        }
      },
      required: ['subject', 'topic', 'grade', 'worksheet_type']
    }
  }
]

// Tool execution handlers
async function executeQueryDatabase(supabase: any, params: { query: string, explanation: string }) {
  // Validate it's a SELECT query
  const normalizedQuery = params.query.trim().toUpperCase()
  if (!normalizedQuery.startsWith('SELECT')) {
    return { error: 'Only SELECT queries are allowed. Use modify_database for changes.' }
  }
  
  try {
    const { data, error } = await supabase.rpc('execute_readonly_query', { 
      query_text: params.query 
    })
    
    if (error) {
      // Fallback: try direct query if RPC doesn't exist
      const result = await supabase.from('profiles').select('count').limit(1)
      return { 
        note: 'Direct SQL execution not available. Use Supabase queries.',
        suggestion: 'Reframe request to use Supabase client methods.'
      }
    }
    
    return { data, rowCount: data?.length || 0 }
  } catch (err) {
    return { error: String(err) }
  }
}

async function executePlatformStats(supabase: any, params: { time_range: string }) {
  const now = new Date()
  let startDate: Date
  
  switch (params.time_range) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0))
      break
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case 'quarter':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case 'year':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      break
    default:
      startDate = new Date(0)
  }
  
  // Fetch comprehensive stats
  const [users, preschools, schools, subscriptions, aiUsage] = await Promise.all([
    supabase.from('profiles').select('id, role, created_at').gte('created_at', startDate.toISOString()),
    supabase.from('preschools').select('id, is_active, created_at'),
    supabase.from('schools').select('id, is_active, created_at'),
    supabase.from('subscriptions').select('id, status, plan_id, seats_total'),
    supabase.from('ai_usage_logs').select('id, tokens_used, cost_usd').gte('created_at', startDate.toISOString())
  ])
  
  const totalUsers = users.data?.length || 0
  const usersByRole = (users.data || []).reduce((acc: Record<string, number>, u: any) => {
    acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {})
  
  const activePreschools = (preschools.data || []).filter((p: any) => p.is_active).length
  const activeSchools = (schools.data || []).filter((s: any) => s.is_active).length
  const activeSubscriptions = (subscriptions.data || []).filter((s: any) => s.status === 'active').length
  
  const totalAITokens = (aiUsage.data || []).reduce((sum: number, u: any) => sum + (u.tokens_used || 0), 0)
  const totalAICost = (aiUsage.data || []).reduce((sum: number, u: any) => sum + (u.cost_usd || 0), 0)
  
  return {
    time_range: params.time_range,
    users: {
      total: totalUsers,
      by_role: usersByRole
    },
    organizations: {
      preschools: { total: preschools.data?.length || 0, active: activePreschools },
      k12_schools: { total: schools.data?.length || 0, active: activeSchools }
    },
    subscriptions: {
      total: subscriptions.data?.length || 0,
      active: activeSubscriptions,
      total_seats: (subscriptions.data || []).reduce((sum: number, s: any) => sum + (s.seats_total || 0), 0)
    },
    ai_usage: {
      total_tokens: totalAITokens,
      estimated_cost_usd: totalAICost.toFixed(4)
    }
  }
}

async function executeListSchools(supabase: any, params: { filter?: string, limit?: number }) {
  const limit = params.limit || 50
  
  let preschoolQuery = supabase.from('preschools').select('*').limit(limit)
  let schoolQuery = supabase.from('schools').select('*').limit(limit)
  
  if (params.filter === 'active') {
    preschoolQuery = preschoolQuery.eq('is_active', true)
    schoolQuery = schoolQuery.eq('is_active', true)
  } else if (params.filter === 'inactive') {
    preschoolQuery = preschoolQuery.eq('is_active', false)
    schoolQuery = schoolQuery.eq('is_active', false)
  }
  
  const [preschools, schools] = await Promise.all([preschoolQuery, schoolQuery])
  
  return {
    preschools: preschools.data || [],
    k12_schools: schools.data || [],
    total: (preschools.data?.length || 0) + (schools.data?.length || 0)
  }
}

async function executeListUsers(supabase: any, params: { role?: string, school_id?: string, limit?: number }) {
  const limit = params.limit || 50
  
  let query = supabase.from('profiles').select('id, email, full_name, role, preschool_id, organization_id, created_at').limit(limit)
  
  if (params.role && params.role !== 'all') {
    query = query.eq('role', params.role)
  }
  
  if (params.school_id) {
    query = query.or(`preschool_id.eq.${params.school_id},organization_id.eq.${params.school_id}`)
  }
  
  const { data, error } = await query
  
  return { users: data || [], count: data?.length || 0, error: error?.message }
}

async function executeGitHubListPRs(params: { state?: string }) {
  if (!GITHUB_TOKEN) {
    return { error: 'GitHub integration not configured. Set GITHUB_TOKEN environment variable.' }
  }
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/DashSoil/NewDash/pulls?state=${params.state || 'open'}`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )
    
    if (!response.ok) {
      return { error: `GitHub API error: ${response.status}` }
    }
    
    const prs = await response.json()
    return {
      pull_requests: prs.map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user.login,
        created_at: pr.created_at,
        url: pr.html_url
      }))
    }
  } catch (err) {
    return { error: String(err) }
  }
}

async function executeGitHubSearchCode(params: { query: string, path?: string, extension?: string }) {
  if (!GITHUB_TOKEN) {
    return { error: 'GitHub integration not configured. Set GITHUB_TOKEN environment variable.' }
  }
  
  try {
    // Build search query
    let searchQuery = `${params.query} repo:DashSoil/NewDash`
    if (params.path) searchQuery += ` path:${params.path}`
    if (params.extension) searchQuery += ` extension:${params.extension}`
    
    const response = await fetch(
      `https://api.github.com/search/code?q=${encodeURIComponent(searchQuery)}&per_page=10`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.text-match+json'
        }
      }
    )
    
    if (!response.ok) {
      if (response.status === 403) {
        return { error: 'GitHub API rate limit exceeded. Try again later.' }
      }
      return { error: `GitHub API error: ${response.status}` }
    }
    
    const data = await response.json()
    return {
      total_count: data.total_count,
      files: data.items.map((item: any) => ({
        name: item.name,
        path: item.path,
        url: item.html_url,
        text_matches: item.text_matches?.map((m: any) => m.fragment).slice(0, 2)
      }))
    }
  } catch (err) {
    return { error: String(err) }
  }
}

async function executeGitHubGetFile(params: { path: string }) {
  if (!GITHUB_TOKEN) {
    return { error: 'GitHub integration not configured. Set GITHUB_TOKEN environment variable.' }
  }
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/DashSoil/NewDash/contents/${params.path}`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )
    
    if (!response.ok) {
      if (response.status === 404) {
        return { error: `File not found: ${params.path}` }
      }
      return { error: `GitHub API error: ${response.status}` }
    }
    
    const data = await response.json()
    
    // Decode base64 content
    const content = data.encoding === 'base64' 
      ? atob(data.content.replace(/\n/g, ''))
      : data.content
    
    // Return truncated content if too long
    const maxLength = 8000
    const truncated = content.length > maxLength
    
    return {
      name: data.name,
      path: data.path,
      size: data.size,
      content: truncated ? content.substring(0, maxLength) + '\n\n... [truncated]' : content,
      truncated,
      url: data.html_url
    }
  } catch (err) {
    return { error: String(err) }
  }
}

async function executeGitHubGetCommits(params: { branch?: string, limit?: number }) {
  if (!GITHUB_TOKEN) {
    return { error: 'GitHub integration not configured. Set GITHUB_TOKEN environment variable.' }
  }
  
  try {
    const branch = params.branch || 'main'
    const limit = params.limit || 10
    
    const response = await fetch(
      `https://api.github.com/repos/DashSoil/NewDash/commits?sha=${branch}&per_page=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )
    
    if (!response.ok) {
      return { error: `GitHub API error: ${response.status}` }
    }
    
    const commits = await response.json()
    return {
      branch,
      commits: commits.map((c: any) => ({
        sha: c.sha.substring(0, 7),
        message: c.commit.message.split('\n')[0],
        author: c.commit.author.name,
        date: c.commit.author.date
      }))
    }
  } catch (err) {
    return { error: String(err) }
  }
}

async function executeEASListBuilds(params: { platform?: string, status?: string }) {
  if (!EAS_ACCESS_TOKEN) {
    return { error: 'EAS integration not configured. Set EAS_ACCESS_TOKEN environment variable.' }
  }
  
  try {
    // EAS API endpoint
    const response = await fetch(
      'https://api.expo.dev/v2/projects/edudash-pro/builds?limit=10',
      {
        headers: {
          'Authorization': `Bearer ${EAS_ACCESS_TOKEN}`,
          'Accept': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      return { 
        error: `EAS API error: ${response.status}`,
        suggestion: 'Verify EAS_ACCESS_TOKEN is valid and has correct permissions.'
      }
    }
    
    const data = await response.json()
    return { builds: data.data || [] }
  } catch (err) {
    return { error: String(err) }
  }
}

// Educational content generation functions
async function executeGenerateLessonPlan(params: any) {
  const {
    subject,
    grade,
    topic,
    duration = 45,
    learning_outcomes = []
  } = params

  // Generate comprehensive CAPS-aligned lesson plan using Claude
  const lessonPrompt = `Generate a comprehensive, CAPS-aligned lesson plan for:
Subject: ${subject}
Grade: ${grade}
Topic: ${topic}
Duration: ${duration} minutes
Learning Outcomes: ${learning_outcomes.length > 0 ? learning_outcomes.join(', ') : 'Standard CAPS outcomes'}

Structure the lesson plan with:
1. Learning objectives (aligned to CAPS)
2. Resources needed
3. Introduction (5-10 min)
4. Main teaching activities (20-30 min)
5. Group work or practical activities (10-15 min)
6. Conclusion and assessment (5-10 min)
7. Differentiation strategies
8. Assessment criteria

Make it practical, engaging, and classroom-ready.`

  return {
    lesson_plan: lessonPrompt, // In production, this would call Claude API
    subject,
    grade,
    topic,
    duration,
    caps_aligned: true,
    format: 'detailed_plan',
    note: 'Full AI generation pending - template returned'
  }
}

async function executeGenerateSTEMActivity(params: any) {
  const {
    activity_type,
    age_group,
    difficulty,
    materials = [],
    duration = 60
  } = params

  const stemPrompt = `Create a hands-on ${activity_type} activity for:
Age Group: ${age_group}
Difficulty: ${difficulty}
Available Materials: ${materials.length > 0 ? materials.join(', ') : 'Basic classroom materials'}
Duration: ${duration} minutes

Include:
1. Activity title and overview
2. Learning objectives (STEM skills)
3. Materials list
4. Step-by-step instructions
5. Expected outcomes
6. Extension activities
7. Safety considerations (if applicable)
8. Assessment rubric

Make it fun, educational, and achievable with basic resources.`

  return {
    stem_activity: stemPrompt,
    activity_type,
    age_group,
    difficulty,
    duration,
    note: 'Full AI generation pending - template returned'
  }
}

async function executeCreateCurriculumModule(params: any) {
  const {
    subject,
    topic,
    grade,
    weeks = 4,
    lessons_per_week = 3
  } = params

  const totalLessons = weeks * lessons_per_week

  return {
    module_overview: {
      subject,
      topic,
      grade,
      duration: `${weeks} weeks`,
      total_lessons: totalLessons,
      lessons_per_week
    },
    weekly_breakdown: Array.from({ length: weeks }, (_, i) => ({
      week: i + 1,
      theme: `Week ${i + 1} Theme`,
      lessons: Array.from({ length: lessons_per_week }, (_, j) => ({
        lesson: j + 1,
        title: `Lesson ${i * lessons_per_week + j + 1}`,
        objectives: [],
        activities: []
      }))
    })),
    note: 'Full curriculum generation pending - structure returned'
  }
}

async function executeGenerateDigitalSkillsLesson(params: any) {
  const {
    skill_area,
    age_group,
    prior_knowledge = 'basic',
    duration = 45
  } = params

  return {
    digital_skills_lesson: {
      skill_area,
      age_group,
      prior_knowledge,
      duration,
      sections: [
        'Introduction to digital skill',
        'Hands-on practice activities',
        'Safety and best practices',
        'Assessment and reflection'
      ]
    },
    note: 'Full lesson generation pending - template returned'
  }
}

async function executeGenerateWorksheet(params: any) {
  const {
    subject,
    topic,
    grade,
    worksheet_type,
    question_count = 10
  } = params

  return {
    worksheet: {
      title: `${subject} - ${topic}`,
      grade,
      type: worksheet_type,
      total_questions: question_count,
      sections: [
        { name: 'Multiple Choice', questions: Math.floor(question_count * 0.4) },
        { name: 'Short Answer', questions: Math.floor(question_count * 0.3) },
        { name: 'Problem Solving', questions: Math.floor(question_count * 0.3) }
      ]
    },
    note: 'Full worksheet generation pending - structure returned'
  }
}

// Execute tool calls
async function executeTool(supabase: any, toolName: string, toolInput: any): Promise<any> {
  switch (toolName) {
    case 'query_database':
      return executeQueryDatabase(supabase, toolInput)
    case 'get_platform_stats':
      return executePlatformStats(supabase, toolInput)
    case 'list_schools':
      return executeListSchools(supabase, toolInput)
    case 'list_users':
      return executeListUsers(supabase, toolInput)
    case 'github_list_prs':
      return executeGitHubListPRs(toolInput)
    case 'github_search_code':
      return executeGitHubSearchCode(toolInput)
    case 'github_get_file':
      return executeGitHubGetFile(toolInput)
    case 'github_get_commits':
      return executeGitHubGetCommits(toolInput)
    case 'eas_list_builds':
      return executeEASListBuilds(toolInput)
    case 'generate_lesson_plan':
      return executeGenerateLessonPlan(toolInput)
    case 'generate_stem_activity':
      return executeGenerateSTEMActivity(toolInput)
    case 'create_curriculum_module':
      return executeCreateCurriculumModule(toolInput)
    case 'generate_digital_skills_lesson':
      return executeGenerateDigitalSkillsLesson(toolInput)
    case 'generate_worksheet':
      return executeGenerateWorksheet(toolInput)
    default:
      return { error: `Tool ${toolName} not yet implemented` }
  }
}

// Call Claude with full capabilities
async function callClaudeWithTools(
  supabase: any,
  message: string,
  conversationHistory: any[] = [],
  maxTokens: number = 2048
): Promise<{ response: string, tool_calls?: any[], tokens_used?: number }> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }
  
  const systemPrompt = `You are Dash, the Super Admin AI Assistant for EduDash Pro.

You have FULL platform access and should:
- Be fast, concise, and friendly
- Answer questions directly without unnecessary preamble
- Use tools proactively to get real data
- Provide clear, actionable insights
- Alert about issues or opportunities

CRITICAL CONVERSATION RULES:
- NEVER re-introduce yourself in follow-up messages. The user already knows who you are.
- Skip phrases like "I'm Dash", "As your AI assistant", "I'm here to help" after the first message.
- Don't list your capabilities repeatedly - the user knows what you can do.
- Get straight to the answer or action.
- When using tools, let the loading indicator speak - don't announce what tool you're using.

Current date: ${new Date().toISOString().split('T')[0]}

Keep responses brief and to-the-point unless detailed analysis is requested.`

  const messages = [
    ...conversationHistory,
    { role: 'user', content: message }
  ]
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: SUPERADMIN_TOOLS,
      messages
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`)
  }
  
  const result = await response.json()
  
  // Process tool calls if any
  if (result.stop_reason === 'tool_use') {
    const toolResults = []
    
    for (const content of result.content) {
      if (content.type === 'tool_use') {
        console.log(`[superadmin-ai] Executing tool: ${content.name}`)
        const toolResult = await executeTool(supabase, content.name, content.input)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: content.id,
          content: JSON.stringify(toolResult, null, 2)
        })
      }
    }
    
    // Continue conversation with tool results
    const followUpResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          ...messages,
          { role: 'assistant', content: result.content },
          { role: 'user', content: toolResults }
        ]
      })
    })
    
    if (!followUpResponse.ok) {
      throw new Error(`Follow-up API error: ${followUpResponse.status}`)
    }
    
    const followUpResult = await followUpResponse.json()
    const textContent = followUpResult.content.find((c: any) => c.type === 'text')
    
    return {
      response: textContent?.text || 'Operation completed.',
      tool_calls: result.content.filter((c: any) => c.type === 'tool_use'),
      tokens_used: (result.usage?.input_tokens || 0) + (followUpResult.usage?.input_tokens || 0) +
                   (result.usage?.output_tokens || 0) + (followUpResult.usage?.output_tokens || 0)
    }
  }
  
  // Extract text response
  const textContent = result.content.find((c: any) => c.type === 'text')
  
  return {
    response: textContent?.text || 'No response generated.',
    tokens_used: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0)
  }
}

// Main handler
serve(async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }
  
  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = authHeader.replace('Bearer ', '')
    
    // Verify user is super admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (!profile || (profile.role !== 'super_admin' && profile.role !== 'superadmin')) {
      return new Response(JSON.stringify({ error: 'Super admin access required' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    // Parse request
    const body: SuperAdminRequest = await req.json()
    
    // Validate input length
    if (body.message && body.message.length > 10000) {
      return new Response(JSON.stringify({ error: 'Message too long (max 10,000 characters)' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    // Log command with detailed metadata
    const commandLogEntry = await supabase.from('superadmin_command_log').insert({
      admin_id: user.id,
      command_type: body.action === 'chat' ? 'query' : body.action,
      command_input: body.message || body.query || JSON.stringify(body.operation),
      status: 'processing',
      metadata: {
        timestamp: new Date().toISOString(),
        user_agent: req.headers.get('User-Agent'),
        ip_address: req.headers.get('X-Forwarded-For') || 'unknown'
      }
    }).select().single()
    
    const logId = commandLogEntry.data?.id
    
    // Handle chat action with full AI
    if (body.action === 'chat' && body.message) {
      try {
        const maxTokens = body.max_tokens || 2048
        const result = await callClaudeWithTools(supabase, body.message, body.history || [], maxTokens)
        
        // Update log with success and tool usage
        if (logId) {
          await supabase.from('superadmin_command_log').update({
            status: 'success',
            result: result.response,
            metadata: {
              tools_used: result.tool_calls?.map((t: any) => t.name) || [],
              tokens_used: result.tokens_used,
              completed_at: new Date().toISOString()
            }
          }).eq('id', logId)
        }
        
        return new Response(JSON.stringify({
          success: true,
          response: result.response,
          tool_calls: result.tool_calls,
          tokens_used: result.tokens_used
        }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
      } catch (err) {
        // Log error
        if (logId) {
          await supabase.from('superadmin_command_log').update({
            status: 'error',
            result: String(err)
          }).eq('id', logId)
        }
        throw err
      }
    }
    
    // Direct database query
    if (body.action === 'query_database' && body.query) {
      const result = await executeQueryDatabase(supabase, { query: body.query, explanation: 'Direct query' })
      
      return new Response(JSON.stringify({
        success: true,
        ...result
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
    
  } catch (err) {
    console.error('[superadmin-ai] Error:', err)
    return new Response(JSON.stringify({ 
      error: 'Internal error', 
      message: String(err) 
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }
})
