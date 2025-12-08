#!/usr/bin/env -S node --experimental-modules
// Quick supabase access check (no secrets printed)
import { fileURLToPath } from 'url'
import path from 'path'

async function main() {
  try {
    const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
    const supabaseMod = await import(path.join(repoRoot, 'lib', 'supabase.js')).catch(async () => {
      // Try TS path via tsx when compiled on the fly
      const ts = await import('tsx')
      return await ts.createRequire(import.meta.url)(path.join(repoRoot, 'lib', 'supabase.ts'))
    })
    const { assertSupabase } = supabaseMod
    const client = assertSupabase()

    // Minimal sanity: call auth.getSession (should not throw). Do not print tokens.
    const { data, error } = await client.auth.getSession()
    if (error) {
      console.log('[check-supabase] Client OK, auth.getSession error (expected if no session):', error.message)
    } else {
      console.log('[check-supabase] Client OK, session present:', !!data?.session)
    }
  } catch (e) {
    console.error('[check-supabase] Failed:', e?.message || e)
    process.exit(1)
  }
}

main()
