#!/usr/bin/env -S node
import { assertSupabase } from '../lib/supabase'

async function main() {
  try {
    const client = assertSupabase()
    const { data, error } = await client.auth.getSession()
    if (error) {
      console.log('[check-supabase] Client OK, auth.getSession error (expected if no session):', error.message)
    } else {
      console.log('[check-supabase] Client OK, session present:', !!data?.session)
    }
  } catch (e: any) {
    console.error('[check-supabase] Failed:', e?.message || e)
    process.exit(1)
  }
}

main()
