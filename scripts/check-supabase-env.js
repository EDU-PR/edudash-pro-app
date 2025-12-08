#!/usr/bin/env node
// Env presence check for Supabase (no secrets printed)
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
const summary = {
  hasUrl: !!url,
  hasAnon: !!anon,
  urlLength: url ? url.length : 0,
  anonLength: anon ? anon.length : 0,
  urlPreview: url ? url.slice(0, 24) + '...' : 'MISSING',
}
console.log('[supabase-env]', summary)
