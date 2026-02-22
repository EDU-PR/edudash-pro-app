import { assertSupabase } from '@/lib/supabase'
import { getCombinedUsage, type AIUsageRecord } from '@/lib/ai/usage'
import { getOrgType, canUseAllocation, type OrgType } from '@/lib/subscriptionRules'
import { getDefaultModels } from '@/lib/ai/models'
import {
  type CapabilityTier,
  getCapabilityTier,
  normalizeTierName,
} from '@/lib/tiers'

export type AIQuotaFeature = 'lesson_generation' | 'grading_assistance' | 'homework_help' | 'transcription'

/**
 * Tier type for quota enforcement.
 * Re-exported from the canonical tier system in `@/lib/tiers`.
 */
export type Tier = CapabilityTier

export type QuotaMap = Record<AIQuotaFeature, number>

/**
 * Default monthly quotas keyed by CapabilityTier.
 * Aligned with TIER_QUOTAS in `@/lib/tiers` for the shared fields.
 */
const DEFAULT_MONTHLY_QUOTAS: Record<CapabilityTier, QuotaMap> = {
  free: { lesson_generation: 5, grading_assistance: 10, homework_help: 20, transcription: 5 },
  starter: { lesson_generation: 30, grading_assistance: 60, homework_help: 120, transcription: 30 },
  premium: { lesson_generation: 120, grading_assistance: 240, homework_help: 480, transcription: 120 },
  enterprise: { lesson_generation: 5000, grading_assistance: 10000, homework_help: 30000, transcription: 36000 }, // ~300 hours
}

export type EffectiveLimits = {
  tier: Tier
  quotas: QuotaMap
  source: 'default' | 'server' | 'org_allocation'
  overageRequiresPrepay: boolean
  modelOptions?: Array<{ id: string; name: string; provider: 'claude' | 'openai' | 'custom'; relativeCost: number }>
  orgType?: OrgType
  canOrgAllocate: boolean
}

async function getUserTier(): Promise<CapabilityTier> {
  try {
    const client = assertSupabase()
    const { data } = await client.auth.getUser()
    const userId = data?.user?.id
    
    // First try user_metadata (fastest)
    const metaTier = String((data?.user?.user_metadata as any)?.subscription_tier || '').toLowerCase()
    const normalizedMetaTier = getCapabilityTier(normalizeTierName(metaTier))
    if (normalizedMetaTier !== 'free') {
      return normalizedMetaTier
    }
    
    // Fallback: Check profiles.subscription_tier (single source of truth)
    if (userId) {
      const { data: profile } = await client
        .from('profiles')
        .select('subscription_tier, preschool_id, role')
        .eq('id', userId)
        .maybeSingle()
      
      if (profile?.subscription_tier) {
        const profileTier = getCapabilityTier(normalizeTierName(String(profile.subscription_tier).toLowerCase()))
        if (profileTier !== 'free') {
          return profileTier
        }
      }
      
      // For staff with 'free' tier, inherit from school
      const isStaff = ['teacher', 'principal', 'admin', 'principal_admin'].includes(profile?.role || '')
      if (isStaff && profile?.preschool_id) {
        const { data: school } = await client
          .from('preschools')
          .select('subscription_tier')
          .eq('id', profile.preschool_id)
          .maybeSingle()
        
        if (school?.subscription_tier) {
          return getCapabilityTier(normalizeTierName(String(school.subscription_tier).toLowerCase()))
        }
      }
    }
    
    return 'free'
  } catch (err) {
    console.warn('[getUserTier] Error fetching tier:', err)
    return 'free'
  }
}

async function getServerLimits(): Promise<Partial<EffectiveLimits> | null> {
  try {
    // Attempt to fetch server-defined limits and any org allocation
    const { data, error } = await assertSupabase().functions.invoke('ai-usage', { body: { action: 'limits' } as any })
    if (error) return null
    if (!data) return null

    const payload: any = data
    const quotas: QuotaMap | undefined = payload.quotas
    const overageRequiresPrepay: boolean = payload.overageRequiresPrepay !== false // default true
    const modelOptions = Array.isArray(payload.models)
      ? payload.models
      : getDefaultModels()

    const source: EffectiveLimits['source'] = payload.source === 'org_allocation' ? 'org_allocation' : 'server'

    return { quotas, overageRequiresPrepay, modelOptions, source }
  } catch {
    return null
  }
}

async function getUserRole(): Promise<string | null> {
  try {
    const { data } = await assertSupabase().auth.getUser()
    return (data?.user?.user_metadata as any)?.role || null
  } catch {
    return null
  }
}

export async function getEffectiveLimits(): Promise<EffectiveLimits> {
  const tier = await getUserTier()
  const server = await getServerLimits()
  const orgType = await getOrgType()
  const userRole = await getUserRole()

  const quotas = server?.quotas || DEFAULT_MONTHLY_QUOTAS[tier]
  const overageRequiresPrepay = server?.overageRequiresPrepay !== false
  const modelOptions = server?.modelOptions || getDefaultModels()
  const source: EffectiveLimits['source'] = server?.source || 'default'
  
  // Allow principals and principal_admins to manage AI quota allocation regardless of tier
  const isPrincipalRole = userRole === 'principal' || userRole === 'principal_admin'
  const canOrgAllocate = isPrincipalRole || await canUseAllocation(tier, orgType)

  return { tier, quotas, overageRequiresPrepay, modelOptions, source, orgType, canOrgAllocate }
}

export type QuotaStatus = {
  used: number
  limit: number
  remaining: number
}

export async function getQuotaStatus(feature: AIQuotaFeature): Promise<QuotaStatus> {
  // First check if user has a teacher allocation from principal
  try {
    console.log(`[Quota] Checking teacher allocation for ${feature}...`);
    const teacherAllocation = await getTeacherSpecificQuota(feature)
    if (teacherAllocation) {
      console.log(`[Quota] Using teacher allocation:`, teacherAllocation);
      return teacherAllocation
    }
    console.log(`[Quota] No teacher allocation found, falling back to general limits`);
  } catch (error) {
    console.warn('[Quota] Teacher allocation check failed, falling back to general limits:', error)
  }
  
  // Fallback to general subscription limits
  const limits = await getEffectiveLimits()
  const usage: AIUsageRecord = await getCombinedUsage()
  const used = usage[feature] || 0
  const limit = Math.max(0, limits.quotas[feature] || 0)
  const remaining = Math.max(0, limit - used)
  
  console.log(`[Quota] Using general subscription limits:`, {
    feature,
    used,
    limit,
    remaining,
    tier: limits.tier
  });
  
  return { used, limit, remaining }
}

export type CanUseResult = {
  allowed: boolean
  reason?: 'over_quota' | 'suspended' | 'not_enabled'
  requiresPrepay?: boolean
  status: QuotaStatus
  limits: EffectiveLimits
}

export async function canUseFeature(feature: AIQuotaFeature, count = 1): Promise<CanUseResult> {
  const limits = await getEffectiveLimits()
  const status = await getQuotaStatus(feature)
  const remainingAfter = status.remaining - count

  if (remainingAfter < 0) {
    return { allowed: false, reason: 'over_quota', requiresPrepay: limits.overageRequiresPrepay, status, limits }
  }

  return { allowed: true, status, limits }
}

/**
 * Check for teacher-specific quota allocation from principal
 * Returns null if no teacher allocation exists or user is not a teacher
 */
export async function getTeacherSpecificQuota(feature: AIQuotaFeature): Promise<QuotaStatus | null> {
  try {
    console.log(`[Teacher Quota] Starting check for ${feature}`);
    
    const { assertSupabase } = await import('@/lib/supabase')
    const client = assertSupabase()
    
    // Get current user
    const { data: { user }, error: authError } = await client.auth.getUser()
    if (authError || !user) {
      console.log(`[Teacher Quota] No authenticated user:`, authError);
      return null;
    }
    
    console.log(`[Teacher Quota] User authenticated:`, user.id);
    
    // Get user profile from profiles table (not deprecated users table)
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, preschool_id, organization_id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    
    if (profileError) {
      console.warn(`[Teacher Quota] Profile lookup error:`, profileError);
      return null;
    }
    
    if (!profile) {
      console.log(`[Teacher Quota] No profile found for user`);
      return null;
    }
    
    // Only check teacher allocation for teacher role
    const isTeacher = profile.role === 'teacher' || profile.role === 'assistant_teacher'
    if (!isTeacher) {
      console.log(`[Teacher Quota] User is ${profile.role}, not a teacher - skipping teacher quota check`);
      return null;
    }
    
    // Use preschool_id or organization_id
    const schoolId = profile.preschool_id || profile.organization_id
    if (!schoolId) {
      console.log(`[Teacher Quota] User not associated with any school/organization`);
      return null;
    }
    
    console.log(`[Teacher Quota] Teacher profile found:`, {
      userId: profile.id,
      schoolId: schoolId,
      role: profile.role
    });
    
    // Ensure teacher allocation exists (create if needed)
    console.log(`[Teacher Quota] Ensuring allocation exists...`);
    const { getTeacherAllocation } = await import('@/lib/ai/allocation')
    const allocation = await getTeacherAllocation(schoolId, profile.id)
    
    if (!allocation) {
      console.log(`[Teacher Quota] Failed to create/find allocation`);
      return null;
    }
    
    if (!allocation.allocated_quotas) {
      console.log(`[Teacher Quota] Allocation has no quota data`);
      return null;
    }
    
    console.log(`[Teacher Quota] Allocation found:`, {
      teacherName: allocation.teacher_name,
      allocatedQuotas: allocation.allocated_quotas,
      usedQuotas: allocation.used_quotas
    });
    
    // Map feature to allocation quota type (matching database schema)
    const quotaMapping: Record<AIQuotaFeature, string> = {
      'lesson_generation': 'lesson_generation', // Lesson generation has its own quota pool
      'grading_assistance': 'grading_assistance', // Grading assistance has its own quota pool  
      'homework_help': 'homework_help', // Homework help has its own quota pool
      'transcription': 'transcription', // Voice transcription quota (chunks per month)
    }
    
    const quotaType = quotaMapping[feature]
    if (!quotaType) {
      console.warn(`[Teacher Quota] No quota mapping for feature: ${feature}`);
      return null;
    }
    
    if (typeof allocation.allocated_quotas[quotaType] === 'undefined') {
      console.warn(`[Teacher Quota] No quota data for type: ${quotaType}`);
      return null;
    }
    
    const allocatedLimit = allocation.allocated_quotas[quotaType] || 0
    const usedAmount = allocation.used_quotas?.[quotaType] || 0
    
    // Server-tracked usage is authoritative for cross-device consistency
    // Only fall back to local usage if server data is completely unavailable
    let effectiveUsed = usedAmount
    let localUsed = 0 // Initialize with default value
    
    if (usedAmount === 0) {
      // Fallback: check if we have any local usage (offline scenario)
      try {
        const { getCombinedUsage } = await import('@/lib/ai/usage')
        const usage = await getCombinedUsage()
        localUsed = usage[feature] || 0
        if (localUsed > 0) {
          console.warn(`[Teacher Quota] Using local usage fallback: ${localUsed} for ${feature}`);
          effectiveUsed = localUsed
        }
      } catch {
        // If getCombinedUsage fails, stick with server data
        effectiveUsed = usedAmount
        localUsed = 0
      }
    }
    
    const remaining = Math.max(0, allocatedLimit - effectiveUsed)
    
    console.log(`[Teacher Quota] Final calculation for ${feature}:`, {
      quotaType,
      allocatedLimit,
      serverUsed: usedAmount,
      localUsed,
      effectiveUsed,
      remaining,
      teacher: profile.id,
      preschool: profile.preschool_id,
      teacherName: allocation.teacher_name
    })
    
    return {
      used: effectiveUsed,
      limit: allocatedLimit,
      remaining
    }
    
  } catch (error) {
    console.error('[Teacher Quota] Error in getTeacherSpecificQuota:', error)
    return null
  }
}
