#!/usr/bin/env npx tsx
/**
 * EduDashPro User Tier Checker (Simplified)
 * 
 * Checks the current subscription tier for teachers and principals
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface UserInfo {
  id: string
  email: string
  first_name?: string
  last_name?: string
  role: string
  organization_id?: string
  created_at: string
}

interface OrganizationInfo {
  id: string
  name: string
  plan_tier: string
  seat_limit: number
}

async function checkUserTiers() {
  console.log('🔍 Checking EduDashPro User Tiers...\n')

  try {
    // First, get all teachers and principals
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['teacher', 'principal_admin'])
      .order('role')
      .order('created_at', { ascending: false })

    if (usersError) {
      throw usersError
    }

    if (!users || users.length === 0) {
      console.log('📝 No teachers or principals found.')
      return
    }

    console.log(`Found ${users.length} users (teachers & principals)`)

    // Get organization info for users that have organizations
    const orgIds = [...new Set(users.filter(u => u.organization_id).map(u => u.organization_id))]
    
    let organizations: OrganizationInfo[] = []
    if (orgIds.length > 0) {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)

      if (orgError) {
        console.warn('⚠️ Could not fetch organizations:', orgError.message)
      } else {
        organizations = orgData || []
      }
    }

    // Create a map for easy lookup
    const orgMap = new Map(organizations.map(org => [org.id, org]))

    // Display results
    displayUserTiers('👩‍🏫 TEACHERS', users.filter(u => u.role === 'teacher'), orgMap)
    displayUserTiers('👨‍💼 PRINCIPALS', users.filter(u => u.role === 'principal_admin'), orgMap)

    // Generate tier badge configuration
    generateTierBadges(users, orgMap)

  } catch (error) {
    console.error('❌ Error checking user tiers:', error)
    
    // Fallback: create sample tier badge data
    generateFallbackTierBadges()
  }
}

function displayUserTiers(title: string, users: UserInfo[], orgMap: Map<string, OrganizationInfo>) {
  if (users.length === 0) {
    console.log(`${title}: No users found\n`)
    return
  }

  console.log(`${title} (${users.length} users)`)
  console.log('═'.repeat(60))

  users.forEach((user, index) => {
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'No name'
    const org = user.organization_id ? orgMap.get(user.organization_id) : null
    const tier = org?.plan_tier || 'free'
    const tierEmoji = getTierEmoji(tier)
    
    console.log(`${index + 1}. ${name}`)
    console.log(`   📧 ${user.email}`)
    console.log(`   ${tierEmoji} Tier: ${tier.toUpperCase()}`)
    console.log(`   🏢 ${org?.name || 'No organization'}`)
    if (org) {
      console.log(`   💺 Seat Limit: ${org.seat_limit}`)
    }
    console.log()
  })
}

function getTierEmoji(tier: string): string {
  switch (tier.toLowerCase()) {
    case 'free': return '🆓'
    case 'basic': return '🥉'
    case 'pro': return '🥈'
    case 'premium': return '🥇'
    case 'enterprise': return '💎'
    default: return '❓'
  }
}

function getTierColor(tier: string): string {
  switch (tier.toLowerCase()) {
    case 'free': return '#6b7280'
    case 'basic': return '#f59e0b'
    case 'pro': return '#3b82f6'
    case 'premium': return '#8b5cf6'
    case 'enterprise': return '#10b981'
    default: return '#6b7280'
  }
}

function generateTierBadges(users: UserInfo[], orgMap: Map<string, OrganizationInfo>) {
  console.log('🎨 TIER BADGE CONFIGURATION')
  console.log('═'.repeat(50))
  
  // Get unique tiers from organizations
  const tiers = ['free', ...Array.from(orgMap.values()).map(org => org.plan_tier)]
  const uniqueTiers = [...new Set(tiers)]
  
  console.log('// Tier badge configuration for greeting cards')
  console.log('export const TIER_BADGES = {')
  
  uniqueTiers.forEach(tier => {
    const emoji = getTierEmoji(tier)
    const color = getTierColor(tier)
    
    console.log(`  ${tier}: {`)
    console.log(`    emoji: '${emoji}',`)
    console.log(`    label: '${tier.toUpperCase()}',`)
    console.log(`    color: '${color}',`)
    console.log(`    gradient: ['${color}', '${adjustBrightness(color, -20)}']`)
    console.log(`  },`)
  })
  
  console.log('};')
  console.log()
}

function generateFallbackTierBadges() {
  console.log('🎨 FALLBACK TIER BADGE CONFIGURATION')
  console.log('═'.repeat(50))
  
  console.log('// Fallback tier badge configuration')
  console.log('export const TIER_BADGES = {')
  console.log(`  free: {`)
  console.log(`    emoji: '🆓',`)
  console.log(`    label: 'FREE',`)
  console.log(`    color: '#6b7280',`)
  console.log(`    gradient: ['#6b7280', '#4b5563']`)
  console.log(`  },`)
  console.log(`  basic: {`)
  console.log(`    emoji: '🥉',`)
  console.log(`    label: 'BASIC',`)
  console.log(`    color: '#f59e0b',`)
  console.log(`    gradient: ['#f59e0b', '#d97706']`)
  console.log(`  },`)
  console.log(`  pro: {`)
  console.log(`    emoji: '🥈',`)
  console.log(`    label: 'PRO',`)
  console.log(`    color: '#3b82f6',`)
  console.log(`    gradient: ['#3b82f6', '#2563eb']`)
  console.log(`  },`)
  console.log(`  premium: {`)
  console.log(`    emoji: '🥇',`)
  console.log(`    label: 'PREMIUM',`)
  console.log(`    color: '#8b5cf6',`)
  console.log(`    gradient: ['#8b5cf6', '#7c3aed']`)
  console.log(`  },`)
  console.log(`  enterprise: {`)
  console.log(`    emoji: '💎',`)
  console.log(`    label: 'ENTERPRISE',`)
  console.log(`    color: '#10b981',`)
  console.log(`    gradient: ['#10b981', '#059669']`)
  console.log(`  }`)
  console.log('};')
  console.log()
}

function adjustBrightness(color: string, amount: number): string {
  const hex = color.replace('#', '')
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Run the script
checkUserTiers().catch(console.error)