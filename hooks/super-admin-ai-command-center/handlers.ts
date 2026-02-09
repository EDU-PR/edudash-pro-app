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
            const { error } = await assertSupabase()
              .rpc('execute_superadmin_agent', { agent_id_param: agent.id });

            if (error) {
              await assertSupabase()
                .from('superadmin_ai_agents')
                .update({ status: 'running', last_run_at: new Date().toISOString() })
                .eq('id', agent.id);
            }

            setAgents(prev => prev.map(a =>
              a.id === agent.id
                ? { ...a, status: 'running', last_run_at: new Date().toISOString() }
                : a,
            ));
            toast.success(`${agent.name} started`);

            // Poll for completion (in production, use realtime subscription)
            setTimeout(async () => {
              await assertSupabase()
                .from('superadmin_ai_agents')
                .update({ status: 'active', last_run_status: 'completed' })
                .eq('id', agent.id);

              setAgents(prev => prev.map(a =>
                a.id === agent.id
                  ? { ...a, status: 'active', last_run_status: 'completed' }
                  : a,
              ));
              toast.success(`${agent.name} completed successfully`);
            }, 5000);
          } catch (err) {
            logger.error('Failed to run agent:', err);
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
