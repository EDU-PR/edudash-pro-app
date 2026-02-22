export type ToolRiskLevel = 'low' | 'medium' | 'high';

export type ToolTier =
  | 'free'
  | 'starter'
  | 'basic'
  | 'premium'
  | 'pro'
  | 'enterprise';

export type ToolRole =
  | 'parent'
  | 'student'
  | 'teacher'
  | 'principal'
  | 'principal_admin'
  | 'super_admin'
  | 'guest';

export interface ToolExecutionContext {
  userId?: string;
  role?: string;
  tier?: string;
  organizationId?: string | null;
  preschoolId?: string | null;
  hasOrganization?: boolean;
  isGuest?: boolean;
  profile?: Record<string, unknown> | null;
  user?: Record<string, unknown> | null;
  supabase?: unknown;
  supabaseClient?: unknown;
  trace_id?: string;
  traceId?: string;
  tool_plan?: Record<string, unknown>;
  confirmedTools?: string[];
  [key: string]: unknown;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
  requires_confirmation?: boolean;
  trace_id?: string;
}

export type DashToolOutcomeStatus = 'success' | 'degraded' | 'failed';

export type DashToolOutcomeSource =
  | 'caps_rpc'
  | 'caps_documents_fallback'
  | 'caps_runtime'
  | 'tool_registry';

export interface DashToolOutcome {
  status: DashToolOutcomeStatus;
  source: DashToolOutcomeSource;
  errorCode?: string;
  userSafeNote?: string;
  details?: Record<string, unknown>;
}

export interface UnifiedClientToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface UnifiedToolDefinition {
  name: string;
  description: string;
  category?: string;
  risk: ToolRiskLevel;
  requiresConfirmation?: boolean;
  parameters: Record<string, unknown>;
  requiredTier?: ToolTier;
  allowedRoles?: ToolRole[];
  source: 'module' | 'legacy';
}

export interface UnifiedToolRegistryStats {
  totalTools: number;
  moduleTools: number;
  legacyTools: number;
  recentExecutions: number;
  successRate: number;
}

export interface SupportCheckUserContextParams {
  include_open_tickets?: boolean;
}

export interface SupportCreateTicketParams {
  subject: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'open' | 'pending' | 'in_progress';
}

export interface SupportTicketSummary {
  id: string;
  subject: string;
  status?: string | null;
  priority?: string | null;
  created_at?: string | null;
}
