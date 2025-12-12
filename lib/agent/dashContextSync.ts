import { assertSupabase } from '@/lib/supabase'

export type DashContextTraits = Record<string, unknown>

export async function syncDashContext(params: { language?: string; traits?: DashContextTraits; sessionId?: string }) {
  try {
    const supabase = assertSupabase()
    const body = {
      detected_language: params.language || null,
      traits: params.traits || {},
      session_id: params.sessionId || undefined,
    }
    const { data, error } = await supabase.functions.invoke('dash-context-sync', { body })
    
    // Edge Function now always returns 200, check success in response body
    if (error) {
      // Network/invocation errors - silent fail (best-effort)
      return null
    }
    
    // Check if operation succeeded (response may have success: false but status 200)
    if (data && data.success === false) {
      // Silent fail - errors are logged server-side only
      return null
    }
    
    return data
  } catch (e) {
    // Silent fail: context sync is best-effort
    // Errors are logged server-side in Edge Function
    return null
  }
}
