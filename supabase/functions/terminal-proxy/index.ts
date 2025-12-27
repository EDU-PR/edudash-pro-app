/**
 * Terminal Proxy Edge Function
 * 
 * Securely executes allowlisted terminal commands via GitHub Actions.
 * This enables the "AI Coding Assistant" to run builds, tests, and other ops.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') || 'DashSoil/NewDash'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ALLOWLISTED COMMANDS (Security Model: Option A)
const ALLOWED_COMMANDS = [
  'npm run lint',
  'npm run typecheck',
  'npm test',
  'npm run build',
  'npm run build:android:preview',
  'npm run build:ios:preview',
  'supabase db push',
  'supabase db diff',
  'git status', // Simulated via API usually, but allowed here for dispatch
]

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // 1. Verify Authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Invalid token')
    }

    // 2. Verify Super Admin Role
    // In a real app, check public.user_roles or app_metadata
    // For now, we assume if they have the key, they are authorized (simplified)
    // But let's check app_metadata if possible
    const isSuperAdmin = user.app_metadata?.role === 'super_admin' || user.email?.includes('admin')
    if (!isSuperAdmin) {
      throw new Error('Unauthorized: Super Admin access required')
    }

    // 3. Parse Request
    const { command, args } = await req.json()
    const fullCommand = args ? `${command} ${args.join(' ')}` : command

    // 4. Validate Command
    const isAllowed = ALLOWED_COMMANDS.some(allowed => fullCommand.startsWith(allowed))
    if (!isAllowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Command not allowed: ${fullCommand}`,
          allowed_commands: ALLOWED_COMMANDS
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // 5. Execute (via GitHub Actions Dispatch)
    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN not configured')
    }

    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'terminal_command',
        client_payload: {
          command: fullCommand,
          user_id: user.id,
          user_email: user.email
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GitHub API error: ${errorText}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Command dispatched to GitHub Actions: ${fullCommand}`,
        status: 'queued'
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
