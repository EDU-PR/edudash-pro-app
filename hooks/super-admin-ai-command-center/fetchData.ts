/**
 * Data fetching for AI Command Center
 */

import { assertSupabase } from '@/lib/supabase';
import type {
  AIAgent,
  AutonomousTask,
  AIInsight,
  Integration,
} from '@/lib/screen-styles/super-admin-ai-command-center.styles';

export interface FetchDataResult {
  agents: AIAgent[];
  tasks: AutonomousTask[];
  insights: AIInsight[];
  integrations: Integration[];
}

export async function fetchCommandCenterData(): Promise<FetchDataResult> {
  const supabase = assertSupabase();
  const result: FetchDataResult = { agents: [], tasks: [], insights: [], integrations: [] };

  // Agents
  const { data: agentsData, error: agentsError } = await supabase
    .rpc('get_superadmin_ai_agents');

  if (agentsError) {
    const { data } = await supabase
      .from('superadmin_ai_agents').select('*').order('name');
    if (data) result.agents = data;
  } else if (agentsData) {
    result.agents = agentsData;
  }

  // Autonomous tasks
  const { data: tasksData, error: tasksError } = await supabase
    .rpc('get_superadmin_autonomous_tasks');

  if (tasksError) {
    const { data } = await supabase
      .from('superadmin_autonomous_tasks').select('*').order('name');
    if (data) result.tasks = data;
  } else if (tasksData) {
    result.tasks = tasksData;
  }

  // Platform insights
  const { data: insightsData, error: insightsError } = await supabase
    .rpc('get_superadmin_platform_insights', { limit_count: 10 });

  if (insightsError) {
    const { data } = await supabase
      .from('superadmin_platform_insights').select('*')
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) result.insights = data;
  } else if (insightsData) {
    result.insights = insightsData;
  }

  // Integrations
  const { data: integrationsData, error: integrationsError } = await supabase
    .rpc('get_superadmin_integrations');

  if (integrationsError) {
    const { data } = await supabase
      .from('superadmin_integrations').select('*').order('name');
    if (data) result.integrations = data;
  } else if (integrationsData) {
    result.integrations = integrationsData;
  }

  return result;
}
