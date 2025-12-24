/**
 * SuperAdmin Tools for Dash AI Agent
 * 
 * Tools for platform-wide administration including user management,
 * organization control, subscription handling, and system monitoring.
 * 
 * Risk levels:
 * - low: Read-only operations
 * - medium: Modifications that can be reverted
 * - high: Destructive or security-sensitive operations
 * 
 * @module services/modules/tools/SuperAdminTools
 */

import { logger } from '@/lib/logger';
import type { AgentTool } from '../DashToolRegistry';

export function registerSuperAdminTools(register: (tool: AgentTool) => void): void {
  
  // ============================================================================
  // USER MANAGEMENT TOOLS
  // ============================================================================
  
  register({
    name: 'superadmin_list_users',
    description: 'List all users with filtering by role, status, school, or search query. Returns user counts and paginated results.',
    parameters: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          description: 'Filter by user role (superadmin, admin, principal, teacher, parent, student)'
        },
        status: {
          type: 'string',
          enum: ['active', 'suspended', 'pending'],
          description: 'Filter by account status'
        },
        school_id: {
          type: 'string',
          description: 'Filter by school/organization ID'
        },
        search: {
          type: 'string',
          description: 'Search term for name or email'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 50)'
        },
        offset: {
          type: 'number',
          description: 'Pagination offset'
        }
      }
    },
    risk: 'low',
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        // Verify superadmin access
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        const { data, error } = await supabase.rpc('get_all_users_for_superadmin', {
          p_role: args.role || null,
          p_status: args.status || null,
          p_school_id: args.school_id || null,
          p_search: args.search || null,
          p_limit: args.limit || 50,
          p_offset: args.offset || 0
        });
        
        if (error) return { success: false, error: error.message };
        
        return {
          success: true,
          count: data?.length || 0,
          users: data || []
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  register({
    name: 'superadmin_suspend_user',
    description: 'Suspend a user account, preventing them from logging in. Cannot suspend superadmin accounts.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'The UUID of the user to suspend'
        },
        reason: {
          type: 'string',
          description: 'Reason for suspension (will be logged)'
        }
      },
      required: ['user_id', 'reason']
    },
    risk: 'high',
    requiresConfirmation: true,
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        const { data, error } = await supabase.rpc('superadmin_suspend_user', {
          target_user_id: args.user_id,
          suspension_reason: args.reason
        });
        
        if (error) return { success: false, error: error.message };
        
        return { success: true, message: 'User suspended successfully', data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  register({
    name: 'superadmin_reactivate_user',
    description: 'Reactivate a previously suspended user account.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'The UUID of the user to reactivate'
        }
      },
      required: ['user_id']
    },
    risk: 'medium',
    requiresConfirmation: true,
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        const { data, error } = await supabase.rpc('superadmin_reactivate_user', {
          target_user_id: args.user_id
        });
        
        if (error) return { success: false, error: error.message };
        
        return { success: true, message: 'User reactivated successfully', data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  register({
    name: 'superadmin_update_user_role',
    description: 'Change a user\'s role. Cannot modify superadmin roles.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'The UUID of the user'
        },
        new_role: {
          type: 'string',
          enum: ['admin', 'principal', 'teacher', 'parent', 'student'],
          description: 'The new role to assign'
        }
      },
      required: ['user_id', 'new_role']
    },
    risk: 'high',
    requiresConfirmation: true,
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        const { data, error } = await supabase.rpc('superadmin_update_user_role', {
          target_user_id: args.user_id,
          new_role: args.new_role
        });
        
        if (error) return { success: false, error: error.message };
        
        return { success: true, message: `User role updated to ${args.new_role}`, data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  // ============================================================================
  // SYSTEM MONITORING TOOLS
  // ============================================================================

  register({
    name: 'superadmin_get_system_health',
    description: 'Get comprehensive system health metrics including database status, API latency, error rates, and active sessions.',
    parameters: {
      type: 'object',
      properties: {}
    },
    risk: 'low',
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        const { data, error } = await supabase.rpc('get_system_health_metrics');
        
        if (error) return { success: false, error: error.message };
        
        return { success: true, health: data?.data || data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  register({
    name: 'superadmin_get_error_logs',
    description: 'Retrieve recent error logs with optional filtering by severity and time range.',
    parameters: {
      type: 'object',
      properties: {
        hours_back: {
          type: 'number',
          description: 'Number of hours to look back (default: 24)'
        },
        severity: {
          type: 'string',
          enum: ['error', 'warning', 'info'],
          description: 'Filter by log severity'
        },
        limit: {
          type: 'number',
          description: 'Maximum logs to return (default: 100)'
        }
      }
    },
    risk: 'low',
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        const { data, error } = await supabase.rpc('get_recent_error_logs', {
          hours_back: args.hours_back || 24
        });
        
        if (error) return { success: false, error: error.message };
        
        let logs = data?.data?.logs || [];
        if (args.severity) {
          logs = logs.filter((l: any) => l.level === args.severity);
        }
        if (args.limit) {
          logs = logs.slice(0, args.limit);
        }
        
        return { success: true, count: logs.length, logs };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  register({
    name: 'superadmin_get_platform_stats',
    description: 'Get comprehensive platform statistics including user counts, organization metrics, revenue, and growth data.',
    parameters: {
      type: 'object',
      properties: {}
    },
    risk: 'low',
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        const { data, error } = await supabase.rpc('get_superadmin_dashboard_data');
        
        if (error) return { success: false, error: error.message };
        
        return { success: true, stats: data?.data || data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  // ============================================================================
  // FEATURE FLAG TOOLS
  // ============================================================================

  register({
    name: 'superadmin_list_feature_flags',
    description: 'List all feature flags with their current status, rollout percentage, and target configurations.',
    parameters: {
      type: 'object',
      properties: {
        environment: {
          type: 'string',
          enum: ['production', 'staging', 'development'],
          description: 'Filter by environment'
        }
      }
    },
    risk: 'low',
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        let query = supabase.from('feature_flags').select('*');
        if (args.environment) {
          query = query.eq('environment', args.environment);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) return { success: false, error: error.message };
        
        return { success: true, count: data?.length || 0, flags: data || [] };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  register({
    name: 'superadmin_toggle_feature_flag',
    description: 'Enable or disable a feature flag.',
    parameters: {
      type: 'object',
      properties: {
        flag_id: {
          type: 'string',
          description: 'The ID of the feature flag'
        },
        enabled: {
          type: 'boolean',
          description: 'Whether to enable (true) or disable (false) the flag'
        }
      },
      required: ['flag_id', 'enabled']
    },
    risk: 'medium',
    requiresConfirmation: true,
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        const { data, error } = await supabase
          .from('feature_flags')
          .update({ enabled: args.enabled, updated_at: new Date().toISOString() })
          .eq('id', args.flag_id)
          .select()
          .single();
        
        if (error) return { success: false, error: error.message };
        
        // Log to audit
        await supabase.from('audit_logs').insert({
          action: 'feature_flag_toggle',
          actor_id: profile.id,
          details: { flag_id: args.flag_id, enabled: args.enabled }
        });
        
        return { success: true, message: `Feature flag ${args.enabled ? 'enabled' : 'disabled'}`, flag: data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  // ============================================================================
  // AI QUOTA MANAGEMENT TOOLS
  // ============================================================================

  register({
    name: 'superadmin_get_ai_usage_stats',
    description: 'Get AI usage statistics across the entire platform or for a specific school.',
    parameters: {
      type: 'object',
      properties: {
        school_id: {
          type: 'string',
          description: 'Optional: Filter by specific school ID'
        },
        days_back: {
          type: 'number',
          description: 'Number of days to analyze (default: 30)'
        }
      }
    },
    risk: 'low',
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        const { data, error } = await supabase.rpc('get_superadmin_ai_usage_cost', {
          days_back: args.days_back || 30
        });
        
        if (error) return { success: false, error: error.message };
        
        return { success: true, usage: data?.data || data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  register({
    name: 'superadmin_update_ai_quota',
    description: 'Update AI quota limits for a specific school or user tier.',
    parameters: {
      type: 'object',
      properties: {
        target_type: {
          type: 'string',
          enum: ['school', 'tier'],
          description: 'Whether to update a school or tier quota'
        },
        target_id: {
          type: 'string',
          description: 'School ID or tier name'
        },
        daily_limit: {
          type: 'number',
          description: 'New daily token limit'
        },
        monthly_limit: {
          type: 'number',
          description: 'New monthly token limit'
        }
      },
      required: ['target_type', 'target_id']
    },
    risk: 'medium',
    requiresConfirmation: true,
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        // Update quota based on target type
        const updates: any = { updated_at: new Date().toISOString() };
        if (args.daily_limit) updates.daily_limit = args.daily_limit;
        if (args.monthly_limit) updates.monthly_limit = args.monthly_limit;
        
        const { data, error } = await supabase
          .from('user_ai_tiers')
          .update(updates)
          .eq(args.target_type === 'school' ? 'organization_id' : 'tier', args.target_id)
          .select();
        
        if (error) return { success: false, error: error.message };
        
        return { success: true, message: 'AI quota updated', data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  // ============================================================================
  // ANNOUNCEMENT TOOLS
  // ============================================================================

  register({
    name: 'superadmin_create_announcement',
    description: 'Create a platform-wide announcement that will be shown to all users or targeted groups.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Announcement title'
        },
        content: {
          type: 'string',
          description: 'Announcement content (supports markdown)'
        },
        type: {
          type: 'string',
          enum: ['info', 'warning', 'maintenance', 'feature', 'urgent'],
          description: 'Type of announcement'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Priority level'
        },
        target_roles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Target roles (empty = all users)'
        },
        expires_at: {
          type: 'string',
          description: 'ISO date when announcement expires'
        }
      },
      required: ['title', 'content', 'type']
    },
    risk: 'medium',
    requiresConfirmation: true,
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        const { data, error } = await supabase
          .from('platform_announcements')
          .insert({
            title: args.title,
            content: args.content,
            type: args.type,
            priority: args.priority || 'medium',
            target_roles: args.target_roles || [],
            expires_at: args.expires_at || null,
            created_by: profile.id,
            is_active: true
          })
          .select()
          .single();
        
        if (error) return { success: false, error: error.message };
        
        return { success: true, message: 'Announcement created', announcement: data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  register({
    name: 'superadmin_list_announcements',
    description: 'List all platform announcements with optional filtering.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'all'],
          description: 'Filter by status'
        },
        type: {
          type: 'string',
          description: 'Filter by announcement type'
        }
      }
    },
    risk: 'low',
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        let query = supabase.from('platform_announcements').select('*');
        
        if (args.status && args.status !== 'all') {
          query = query.eq('is_active', args.status === 'active');
        }
        if (args.type) {
          query = query.eq('type', args.type);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) return { success: false, error: error.message };
        
        return { success: true, count: data?.length || 0, announcements: data || [] };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  // ============================================================================
  // SUBSCRIPTION TOOLS
  // ============================================================================

  register({
    name: 'superadmin_list_subscriptions',
    description: 'List all subscriptions with filtering options.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'cancelled', 'expired', 'trial'],
          description: 'Filter by subscription status'
        },
        plan: {
          type: 'string',
          description: 'Filter by plan tier'
        },
        limit: {
          type: 'number',
          description: 'Maximum results'
        }
      }
    },
    risk: 'low',
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        let query = supabase
          .from('subscriptions')
          .select('*, preschools(name), schools(name)');
        
        if (args.status) {
          query = query.eq('status', args.status);
        }
        if (args.plan) {
          query = query.eq('plan_id', args.plan);
        }
        
        query = query.limit(args.limit || 100);
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) return { success: false, error: error.message };
        
        return { success: true, count: data?.length || 0, subscriptions: data || [] };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  register({
    name: 'superadmin_update_subscription_status',
    description: 'Update the status of a subscription (activate, cancel, expire).',
    parameters: {
      type: 'object',
      properties: {
        subscription_id: {
          type: 'string',
          description: 'The subscription ID'
        },
        new_status: {
          type: 'string',
          enum: ['active', 'cancelled', 'expired'],
          description: 'New status'
        },
        reason: {
          type: 'string',
          description: 'Reason for status change'
        }
      },
      required: ['subscription_id', 'new_status']
    },
    risk: 'high',
    requiresConfirmation: true,
    execute: async (args, context) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        const { isSuperAdmin } = await import('@/lib/roleUtils');
        
        const profile = context?.profile;
        if (!profile || !isSuperAdmin(profile.role)) {
          return { success: false, error: 'SuperAdmin access required' };
        }
        
        const { data, error } = await supabase
          .from('subscriptions')
          .update({ 
            status: args.new_status,
            updated_at: new Date().toISOString()
          })
          .eq('id', args.subscription_id)
          .select()
          .single();
        
        if (error) return { success: false, error: error.message };
        
        // Log to audit
        await supabase.from('audit_logs').insert({
          action: 'subscription_status_change',
          actor_id: profile.id,
          details: { 
            subscription_id: args.subscription_id, 
            new_status: args.new_status,
            reason: args.reason 
          }
        });
        
        return { success: true, message: `Subscription status updated to ${args.new_status}`, subscription: data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  });

  logger.info('[SuperAdminTools] Registered SuperAdmin tools');
}
