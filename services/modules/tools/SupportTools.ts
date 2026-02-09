/**
 * Support Tools for Dash AI
 *
 * Tools for support diagnostics and escalation into support_tickets.
 */

import type { AgentTool } from '../DashToolRegistry';

type AnySupabase = {
  from: (table: string) => any;
};

async function resolveSupabaseClient(context?: Record<string, unknown>): Promise<AnySupabase | null> {
  const fromContext = (context?.supabaseClient || context?.supabase) as AnySupabase | undefined;
  if (fromContext && typeof fromContext.from === 'function') {
    return fromContext;
  }

  try {
    const { assertSupabase } = await import('@/lib/supabase');
    return assertSupabase() as AnySupabase;
  } catch {
    return null;
  }
}

function normalizePriority(value?: string): 'low' | 'medium' | 'high' | 'urgent' {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'urgent') {
    return raw;
  }
  return 'medium';
}

function normalizeStatus(value?: string): 'open' | 'pending' | 'in_progress' {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'pending' || raw === 'in_progress') {
    return raw as 'pending' | 'in_progress';
  }
  return 'open';
}

function getPrimaryUserId(context?: Record<string, unknown>): string {
  const fromContext = context?.userId as string | undefined;
  const fromUser = (context?.user as any)?.id as string | undefined;
  const fromProfile = (context?.profile as any)?.id as string | undefined;
  return String(fromContext || fromUser || fromProfile || '').trim();
}

function getOrganizationId(context?: Record<string, unknown>): string | null {
  const value =
    (context?.organizationId as string | undefined) ||
    (context?.preschoolId as string | undefined) ||
    ((context?.profile as any)?.organization_id as string | undefined) ||
    ((context?.profile as any)?.preschool_id as string | undefined) ||
    null;
  return value ? String(value) : null;
}

export function registerSupportTools(register: (tool: AgentTool) => void): void {
  register({
    name: 'support_check_user_context',
    description:
      'Inspect support-relevant user context (role, organization linkage, and recent open tickets) before escalation.',
    parameters: {
      type: 'object',
      properties: {
        include_open_tickets: {
          type: 'boolean',
          description: 'Include latest open/pending support tickets (default: true).',
        },
      },
    },
    risk: 'low',
    execute: async (args, context) => {
      const supabase = await resolveSupabaseClient(context);
      const userId = getPrimaryUserId(context as Record<string, unknown> | undefined);
      const organizationId = getOrganizationId(context as Record<string, unknown> | undefined);
      const role = String((context as any)?.role || 'unknown');
      const tier = String((context as any)?.tier || 'unknown');

      if (!userId) {
        return {
          success: false,
          error: 'support_check_user_context requires an authenticated user context',
        };
      }

      const includeOpenTickets = args?.include_open_tickets !== false;
      let openTickets: Array<Record<string, unknown>> = [];

      if (includeOpenTickets && supabase) {
        try {
          const { data } = await supabase
            .from('support_tickets')
            .select('id, subject, status, priority, created_at')
            .eq('user_id', userId)
            .in('status', ['open', 'pending', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(5);
          openTickets = Array.isArray(data) ? data : [];
        } catch {
          // Non-fatal: continue without ticket list.
        }
      }

      return {
        success: true,
        user_context: {
          user_id: userId,
          role,
          tier,
          organization_id: organizationId,
          has_organization: Boolean(organizationId),
          open_ticket_count: openTickets.length,
          open_tickets: openTickets,
        },
      };
    },
  });

  register({
    name: 'support_create_ticket',
    description:
      'Create a support ticket for unresolved issues. Use after clarification/retry when the issue cannot be resolved autonomously.',
    parameters: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Short ticket subject line.',
        },
        description: {
          type: 'string',
          description: 'Detailed issue description including what was tried.',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Ticket priority (default: medium).',
        },
        status: {
          type: 'string',
          enum: ['open', 'pending', 'in_progress'],
          description: 'Initial support status (default: open).',
        },
      },
      required: ['subject', 'description'],
    },
    risk: 'medium',
    execute: async (args, context) => {
      const supabase = await resolveSupabaseClient(context);
      if (!supabase) {
        return {
          success: false,
          error: 'Supabase client not available for support_create_ticket',
        };
      }

      const userId = getPrimaryUserId(context as Record<string, unknown> | undefined);
      if (!userId) {
        return {
          success: false,
          error: 'support_create_ticket requires an authenticated user context',
        };
      }

      const organizationId = getOrganizationId(context as Record<string, unknown> | undefined);
      const subject = String(args?.subject || '').trim().slice(0, 160);
      const description = String(args?.description || '').trim();

      if (!subject || !description) {
        return {
          success: false,
          error: 'support_create_ticket requires both subject and description',
        };
      }

      const priority = normalizePriority(args?.priority);
      const status = normalizeStatus(args?.status);

      // Basic de-duplication for repeated retries in a short window.
      try {
        const { data: recentExisting } = await supabase
          .from('support_tickets')
          .select('id, subject, status, priority, created_at')
          .eq('user_id', userId)
          .eq('subject', subject)
          .order('created_at', { ascending: false })
          .limit(1);

        const recent = Array.isArray(recentExisting) && recentExisting.length > 0
          ? recentExisting[0]
          : null;
        if (recent?.created_at) {
          const ageMs = Date.now() - new Date(String(recent.created_at)).getTime();
          const statusValue = String(recent.status || '').toLowerCase();
          const stillOpen = statusValue === 'open' || statusValue === 'pending' || statusValue === 'in_progress';
          if (stillOpen && ageMs >= 0 && ageMs <= 15 * 60 * 1000) {
            return {
              success: true,
              ticket: recent,
              deduplicated: true,
              reference_id: recent.id,
              message: `Support ticket already exists: ${recent.id}`,
            };
          }
        }
      } catch {
        // Continue and try insert.
      }

      const insertPayload = {
        user_id: userId,
        preschool_id: organizationId,
        subject,
        description,
        priority,
        status,
      };

      const { data, error } = await supabase
        .from('support_tickets')
        .insert(insertPayload)
        .select('id, subject, status, priority, created_at')
        .single();

      if (error || !data) {
        return {
          success: false,
          error: error?.message || 'Failed to create support ticket',
        };
      }

      return {
        success: true,
        ticket: data,
        reference_id: data.id,
        deduplicated: false,
        message: `Support ticket created: ${data.id}`,
      };
    },
  });
}
