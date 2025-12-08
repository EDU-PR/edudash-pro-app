#!/usr/bin/env npx tsx
/**
 * Accurate Tier Checker based on your schema
 *
 * Strategy per user:
 * 1) If profiles.organization_id present -> organizations.plan_tier
 * 2) Else if profiles.preschool_id present ->
 *    2a) If subscriptions active for that school -> subscription_plans.tier via subscriptions.plan_id
 *    2b) Else preschools.subscription_tier
 * 3) Else users.subscription_tier (if available by email)
 * 4) Fallback 'free'
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

type Tier = 'free'|'starter'|'basic'|'premium'|'pro'|'enterprise'

function normalizeTier(x?: string | null): Tier {
  const t = String(x || '').toLowerCase()
  if (['free','starter','basic','premium','pro','enterprise'].includes(t)) return t as Tier
  if (t === 'trial' || t === 'trialing') return 'free'
  return 'free'
}

async function run() {
  console.log('🔎 Computing accurate tiers for teachers and principals...')

  // Get candidate users
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, preschool_id, organization_id, last_login_at')
    .in('role', ['teacher','principal','principal_admin'])
    .order('last_login_at', { ascending: false })

  if (error) throw error
  if (!profiles?.length) {
    console.log('No matching users found')
    return
  }

  // Collect ids
  const schoolIds = [...new Set(profiles.map(p => p.preschool_id).filter(Boolean))] as string[]
  const orgIds = [...new Set(profiles.map(p => p.organization_id).filter(Boolean))] as string[]

  // Fetch orgs
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, plan_tier')
    .in('id', orgIds)
  const orgMap = new Map((orgs||[]).map(o => [o.id, o.plan_tier as string]))

  // Fetch preschools
  const { data: schools } = await supabase
    .from('preschools')
    .select('id, subscription_tier')
    .in('id', schoolIds)
  const schoolMap = new Map((schools||[]).map(s => [s.id, s.subscription_tier as string]))

  // Fetch active subscriptions for those schools
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('id, school_id, plan_id, status')
    .in('school_id', schoolIds)
    .in('status', ['active','trialing'])
  const planIds = [...new Set((subs||[]).map(s => s.plan_id).filter(Boolean))] as string[]

  // Fetch subscription plans -> tier
  const { data: plans } = planIds.length ? await supabase
    .from('subscription_plans')
    .select('id, tier')
    .in('id', planIds) : { data: [] as any[] }
  const planMap = new Map((plans||[]).map(p => [p.id, p.tier as string]))

  // Map school_id -> plan tier if subscription exists
  const schoolPlanTier = new Map<string, string>()
  ;(subs||[]).forEach(s => {
    const t = planMap.get(s.plan_id)
    if (t) schoolPlanTier.set(s.school_id, t)
  })

  // For users table fallback by email
  const emails = profiles.map(p => p.email).filter(Boolean) as string[]
  const { data: usersTable } = emails.length ? await supabase
    .from('users')
    .select('email, subscription_tier')
    .in('email', emails) : { data: [] as any[] }
  const emailTier = new Map((usersTable||[]).map(u => [u.email, u.subscription_tier as string]))

  type Row = { name: string; email: string; role: string; tier: Tier; source: string }
  const rows: Row[] = []

  for (const p of profiles) {
    const name = `${p.first_name||''} ${p.last_name||''}`.trim() || 'Unknown'
    let tier: Tier = 'free'
    let source = 'fallback'

    if (p.organization_id && orgMap.has(p.organization_id)) {
      tier = normalizeTier(orgMap.get(p.organization_id))
      source = 'organizations.plan_tier'
    } else if (p.preschool_id) {
      if (schoolPlanTier.has(p.preschool_id)) {
        tier = normalizeTier(schoolPlanTier.get(p.preschool_id))
        source = 'subscriptions -> subscription_plans.tier'
      } else if (schoolMap.has(p.preschool_id)) {
        tier = normalizeTier(schoolMap.get(p.preschool_id))
        source = 'preschools.subscription_tier'
      }
    }

    if (tier === 'free') {
      const t2 = emailTier.get(p.email || '')
      if (t2) { tier = normalizeTier(t2); source = 'users.subscription_tier' }
    }

    rows.push({ name, email: p.email || '', role: p.role, tier, source })
  }

  const fmt = (r: Row) => `${r.name} <${r.email}>  ${r.role}  → ${r.tier.toUpperCase()}  (${r.source})`

  console.log('\n👩‍🏫 Teachers:')
  rows.filter(r => r.role === 'teacher').forEach(r => console.log('  -', fmt(r)))

  console.log('\n👨‍💼 Principals:')
  rows.filter(r => r.role === 'principal' || r.role === 'principal_admin').forEach(r => console.log('  -', fmt(r)))

  // Summary
  const counts = rows.reduce((m, r) => (m[r.tier] = (m[r.tier]||0)+1, m), {} as Record<Tier, number>)
  console.log('\n📊 Summary by tier:')
  ;(['free','starter','basic','premium','pro','enterprise'] as Tier[]).forEach(t => {
    if (counts[t]) console.log(`  ${t.toUpperCase()}: ${counts[t]}`)
  })
}

run().catch(e => { console.error(e); process.exit(1) })
