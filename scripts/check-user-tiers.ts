#!/usr/bin/env tsx
/**
 * EduDashPro User Tier Checker
 * 
 * Checks the current subscription tier for teachers and principals
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration')
  console.error('Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface UserTierInfo {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  organization_id: string
  organization_name: string
  plan_tier: string
  seat_status: string
  seat_limit: number
  seats_used: number
  created_at: string
  last_login_at: string
}

async function checkUserTiers() {
  console.log('🔍 Checking EduDashPro User Tiers...\n')

  try {
    // Query users with their organization membership details
    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        organization_id,
        organization_memberships!inner(
          organization_id,
          plan_tier,
          seat_status,
          seat_limit,
          seats_used,
          organizations(name)
        ),
        created_at,
        last_login_at
      `)
      .in('role', ['teacher', 'principal_admin'])
      .eq('organization_memberships.seat_status', 'active')
      .order('role')
      .order('last_login_at', { ascending: false })

    if (error) {
      throw error
    }

    if (!users || users.length === 0) {
      console.log('📝 No active teachers or principals found.')
      return
    }

    // Process and display results
    const processedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      organization_id: user.organization_id,
      organization_name: (user.organization_memberships as any)?.organizations?.name || 'Unknown',
      plan_tier: (user.organization_memberships as any)?.plan_tier || 'free',
      seat_status: (user.organization_memberships as any)?.seat_status || 'inactive',
      seat_limit: (user.organization_memberships as any)?.seat_limit || 0,
      seats_used: (user.organization_memberships as any)?.seats_used || 0,
      created_at: user.created_at,
      last_login_at: user.last_login_at
    })) as UserTierInfo[]

    // Group by role
    const teachers = processedUsers.filter(u => u.role === 'teacher')
    const principals = processedUsers.filter(u => u.role === 'principal_admin')

    // Display results
    displayUserTiers('👩‍🏫 TEACHERS', teachers)
    displayUserTiers('👨‍💼 PRINCIPALS', principals)

    // Summary statistics
    displaySummaryStats(processedUsers)

    // Generate tier badge data for development
    generateTierBadgeData(processedUsers)

  } catch (error) {
    console.error('❌ Error checking user tiers:', error)
    process.exit(1)
  }
}

function displayUserTiers(title: string, users: UserTierInfo[]) {
  if (users.length === 0) {
    console.log(`${title}: No users found\n`)
    return
  }

  console.log(`${title} (${users.length} users)`)
  console.log('═'.repeat(60))

  users.forEach((user, index) => {
    const tierEmoji = getTierEmoji(user.plan_tier)
    const statusEmoji = user.seat_status === 'active' ? '✅' : '⚠️'
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'No name'
    const lastLogin = user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'
    
    console.log(`${index + 1}. ${statusEmoji} ${name}`)
    console.log(`   📧 ${user.email}`)
    console.log(`   ${tierEmoji} Tier: ${user.plan_tier.toUpperCase()}`)
    console.log(`   🏢 ${user.organization_name}`)
    console.log(`   💺 Seats: ${user.seats_used}/${user.seat_limit}`)
    console.log(`   🕒 Last Login: ${lastLogin}`)
    console.log()
  })
}

function displaySummaryStats(users: UserTierInfo[]) {
  console.log('📊 TIER DISTRIBUTION SUMMARY')
  console.log('═'.repeat(40))

  const tierCounts = users.reduce((acc, user) => {
    acc[user.plan_tier] = (acc[user.plan_tier] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const roleCounts = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\n🎯 By Tier:')
  Object.entries(tierCounts).forEach(([tier, count]) => {
    const emoji = getTierEmoji(tier)
    console.log(`   ${emoji} ${tier.toUpperCase()}: ${count} users`)
  })

  console.log('\n👥 By Role:')
  Object.entries(roleCounts).forEach(([role, count]) => {
    const emoji = role === 'teacher' ? '👩‍🏫' : '👨‍💼'
    console.log(`   ${emoji} ${role.replace('_', ' ').toUpperCase()}: ${count} users`)
  })

  const totalSeatsUsed = users.reduce((sum, user) => sum + user.seats_used, 0)
  const totalSeatsAvailable = users.reduce((sum, user) => sum + user.seat_limit, 0)
  
  console.log(`\n💺 Total Seats: ${totalSeatsUsed}/${totalSeatsAvailable} used`)
  console.log()
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

function generateTierBadgeData(users: UserTierInfo[]) {
  console.log('🎨 TIER BADGE DATA FOR DEVELOPMENT')
  console.log('═'.repeat(50))
  
  const uniqueTiers = [...new Set(users.map(u => u.plan_tier))]
  
  console.log('// Tier badge configuration for greeting cards')
  console.log('export const TIER_BADGES = {')
  
  uniqueTiers.forEach(tier => {
    const emoji = getTierEmoji(tier)
    const color = getTierColor(tier)
    const userCount = users.filter(u => u.plan_tier === tier).length
    
    console.log(`  ${tier}: {`)
    console.log(`    emoji: '${emoji}',`)
    console.log(`    label: '${tier.toUpperCase()}',`)
    console.log(`    color: '${color}',`)
    console.log(`    userCount: ${userCount}`)
    console.log(`  },`)
  })
  
  console.log('};')
  console.log()
  
  // Sample greeting cards data
  console.log('// Sample user data for testing tier badges')
  console.log('export const SAMPLE_USERS = [')
  users.slice(0, 3).forEach(user => {
    console.log(`  {`)
    console.log(`    id: '${user.id}',`)
    console.log(`    name: '${user.first_name || ''} ${user.last_name || ''}',`)
    console.log(`    role: '${user.role}',`)
    console.log(`    tier: '${user.plan_tier}',`)
    console.log(`    organization: '${user.organization_name}'`)
    console.log(`  },`)
  })
  console.log('];')
  console.log()
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

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  checkUserTiers().catch(console.error)
}

export { checkUserTiers, getTierEmoji, getTierColor }