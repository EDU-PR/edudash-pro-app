/**
 * Handlers for AI Command Center agents, tasks, insights, integrations
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { toast } from '@/components/ui/ToastProvider';
import { router } from 'expo-router';
import type {
  AIAgent,
  AutonomousTask,
  AIInsight,
  Integration,
} from '@/lib/screen-styles/super-admin-ai-command-center.styles';
import type { SetState, ShowAlertFn } from './types';

const EXECUTION_POLL_INTERVAL_MS = 1200;
const EXECUTION_POLL_MAX_ATTEMPTS = 30;
const TERMINAL_EXECUTION_STATUSES = new Set(['completed', 'failed', 'cancelled', 'timeout']);

interface AgentExecutionRow {
  status: string | null;
  error_message: string | null;
  result: Record<string, unknown> | null;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function refreshAgentFromDb(
  agentId: string,
  setAgents: SetState<AIAgent[]>,
): Promise<AIAgent | null> {
  const { data, error } = await assertSupabase()
    .from('superadmin_ai_agents')
    .select('id,status,last_run_at,last_run_status,success_rate,total_runs')
    .eq('id', agentId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      logger.warn('SuperAdminAICommandCenter', 'Failed to refresh agent state from DB', error);
    }
    return null;
  }

  const patch = {
    status: (data.status || 'idle') as AIAgent['status'],
    last_run_at: data.last_run_at || undefined,
    last_run_status: data.last_run_status || undefined,
    success_rate: Number(data.success_rate || 0),
    total_runs: Number(data.total_runs || 0),
  };

  setAgents(prev => prev.map(agent => (
    agent.id === agentId ? { ...agent, ...patch } : agent
  )));

  return data as AIAgent;
}

async function pollExecutionUntilTerminal(
  executionId: string,
  agentId: string,
  setAgents: SetState<AIAgent[]>,
): Promise<{ status: string; summary?: string; error?: string }> {
  const supabase = assertSupabase();

  for (let attempt = 1; attempt <= EXECUTION_POLL_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase
      .from('superadmin_agent_executions')
      .select('status,error_message,result')
      .eq('id', executionId)
      .maybeSingle();

    if (error) {
      logger.warn('SuperAdminAICommandCenter', 'Failed to poll execution status', { executionId, error });
      await sleep(EXECUTION_POLL_INTERVAL_MS);
      continue;
    }

    const execution = (data || null) as AgentExecutionRow | null;
    const status = String(execution?.status || 'pending').toLowerCase();

    // If the backend still queues pending rows, try to process explicitly once.
    if (attempt === 1 && status === 'pending') {
      const { error: processError } = await supabase
        .rpc('process_superadmin_agent_execution', { execution_id_param: executionId });
      if (processError) {
        logger.info('SuperAdminAICommandCenter', 'Execution processor RPC unavailable or failed', processError.message);
      }
    }

    if (TERMINAL_EXECUTION_STATUSES.has(status)) {
      await refreshAgentFromDb(agentId, setAgents);
      const summary = typeof execution?.result?.summary === 'string'
        ? execution.result.summary
        : undefined;
      return {
        status,
        summary,
        error: execution?.error_message || undefined,
      };
    }

    await sleep(EXECUTION_POLL_INTERVAL_MS);
  }

  await refreshAgentFromDb(agentId, setAgents);
  return {
    status: 'timeout',
    error: 'Agent execution is still running in the background',
  };
}

export async function toggleAgent(
  agentId: string,
  agents: AIAgent[],
  setAgents: SetState<AIAgent[]>,
): Promise<void> {
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return;

  const newStatus = agent.status === 'disabled' ? 'active' : 'disabled';

  try {
    const { error } = await assertSupabase()
      .rpc('toggle_superadmin_agent', { agent_id_param: agentId, new_status: newStatus });

    if (error) {
      await assertSupabase()
        .from('superadmin_ai_agents')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', agentId);
    }

    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, status: newStatus } : a,
    ));
    toast.success(`${agent.name} ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
  } catch (err) {
    logger.error('Failed to toggle agent:', err);
    toast.error('Failed to update agent');
  }
}

export async function toggleTask(
  taskId: string,
  tasks: AutonomousTask[],
  setTasks: SetState<AutonomousTask[]>,
): Promise<void> {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  try {
    const { error } = await assertSupabase()
      .rpc('toggle_superadmin_task', { task_id_param: taskId, is_enabled_param: !task.is_enabled });

    if (error) {
      await assertSupabase()
        .from('superadmin_autonomous_tasks')
        .update({ is_enabled: !task.is_enabled, updated_at: new Date().toISOString() })
        .eq('id', taskId);
    }

    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, is_enabled: !t.is_enabled } : t,
    ));
    toast.success(`${task.name} ${!task.is_enabled ? 'enabled' : 'disabled'}`);
  } catch (err) {
    logger.error('Failed to toggle task:', err);
    toast.error('Failed to update task');
  }
}

export function runAgent(
  agent: AIAgent,
  setAgents: SetState<AIAgent[]>,
  showAlert: ShowAlertFn,
): void {
  showAlert({
    title: `Run ${agent.name}?`,
    message: 'This will execute the agent immediately outside its normal schedule.',
    type: 'warning',
    buttons: [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Run Now',
        onPress: async () => {
          try {
            setAgents(prev => prev.map(a =>
              a.id === agent.id
                ? { ...a, status: 'running', last_run_at: new Date().toISOString() }
                : a,
            ));

            const { data: executionId, error } = await assertSupabase()
              .rpc('execute_superadmin_agent', { agent_id_param: agent.id });

            if (error || typeof executionId !== 'string') {
              throw error || new Error('Execution was not created');
            }

            toast.success(`${agent.name} started`);

            const outcome = await pollExecutionUntilTerminal(executionId, agent.id, setAgents);
            if (outcome.status === 'completed') {
              toast.success(outcome.summary || `${agent.name} completed successfully`);
              return;
            }
            if (outcome.status === 'timeout') {
              toast.info(`${agent.name} is still running in the background`);
              return;
            }
            toast.error(outcome.error || `${agent.name} failed to complete`);
          } catch (err) {
            logger.error('SuperAdminAICommandCenter', 'Failed to run agent', err);
            await refreshAgentFromDb(agent.id, setAgents);
            toast.error('Failed to start agent');
          }
        },
      },
    ],
  });
}

export function handleInsightAction(insight: AIInsight): void {
  if (insight.action_route) {
    router.push(insight.action_route as any);
  } else {
    toast.info('Action not configured');
  }
}

export async function dismissInsight(
  insightId: string,
  userId: string | undefined,
  setInsights: SetState<AIInsight[]>,
): Promise<void> {
  try {
    await assertSupabase()
      .from('superadmin_platform_insights')
      .update({
        is_dismissed: true,
        dismissed_by: userId,
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', insightId);

    setInsights(prev => prev.filter(i => i.id !== insightId));
    toast.success('Insight dismissed');
  } catch (err) {
    logger.error('Failed to dismiss insight:', err);
  }
}

export function configureIntegration(
  integration: Integration,
  showAlert: ShowAlertFn,
): void {
  if (integration.integration_type === 'github') {
    showAlert({
      title: 'GitHub',
      message: 'Configure GitHub integration in super admin settings',
      type: 'info',
    });
  } else if (integration.integration_type === 'eas_expo') {
    showAlert({
      title: 'EAS/Expo',
      message: 'Configure EAS integration in super admin settings',
      type: 'info',
    });
  }
}
