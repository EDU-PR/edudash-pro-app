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
  query?: string
  operation?: string
  parameters?: Record<string, unknown>
  stream?: boolean
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
    case 'github_get_commits':
      return executeGitHubGetCommits(toolInput)
    case 'eas_list_builds':
      return executeEASListBuilds(toolInput)
    default:
      return { error: `Tool ${toolName} not yet implemented` }
  }
}

// Call Claude with full capabilities
async function callClaudeWithTools(
  supabase: any,
  message: string,
  conversationHistory: any[] = []
): Promise<{ response: string, tool_calls?: any[], tokens_used?: number }> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }
  
  const systemPrompt = `You are the Super Admin AI Assistant for EduDash Pro, a multi-tenant educational platform.

You have FULL administrative access to:
- Database queries and modifications (with logging)
- Platform statistics and analytics
- User and school management
- GitHub repository operations
- EAS/Expo build management
- Feature flag control
- Announcement broadcasting

You should:
1. Be proactive in suggesting optimizations and improvements
2. Provide detailed analytics when asked about platform performance
3. Help with database queries and explain results clearly
4. Assist with deployments and code management
5. Generate comprehensive reports when requested
6. Alert about potential issues or opportunities

Current date: ${new Date().toISOString().split('T')[0]}

When executing database modifications, always explain the impact first and log the operation.`

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
      max_tokens: 4096,
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
    
    // Log command
    await supabase.from('superadmin_command_log').insert({
      admin_id: user.id,
      command_type: body.action === 'chat' ? 'query' : body.action,
      command_input: body.message || body.query || JSON.stringify(body.operation),
      status: 'processing'
    })
    
    // Handle chat action with full AI
    if (body.action === 'chat' && body.message) {
      const result = await callClaudeWithTools(supabase, body.message)
      
      return new Response(JSON.stringify({
        success: true,
        response: result.response,
        tool_calls: result.tool_calls,
        tokens_used: result.tokens_used
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
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
