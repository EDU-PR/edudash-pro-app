/**
 * Tool Execution
 *
 * Hook for tool shortcuts, auto-tool planning, and manual tool execution.
 *
 * @module hooks/dash-assistant/useToolExecution
 * @max-lines 200
 */

import { useCallback, useMemo } from 'react';
import type { DashMessage } from '@/services/dash-ai/types';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import { ToolRegistry } from '@/services/AgentTools';
import { formatToolResultMessage } from '@/lib/ai/toolUtils';
import { getDashToolShortcutsForRole } from '@/lib/ai/toolCatalog';
import { planToolCall, shouldAttemptToolPlan } from '@/lib/ai/toolPlanner';
import { assertSupabase } from '@/lib/supabase';

interface UseToolExecutionParams {
  profile: any;
  user: any;
  tier: string | undefined;
  dashInstance: IDashAIAssistant | null;
  setMessages: (v: DashMessage[] | ((prev: DashMessage[]) => DashMessage[])) => void;
  showAlert: (config: any) => void;
}

export function useToolExecution(params: UseToolExecutionParams) {
  const { profile, user, tier, dashInstance, setMessages, showAlert } = params;

  const toolShortcuts = useMemo(() => {
    const shortcuts = getDashToolShortcutsForRole(profile?.role || null);
    return shortcuts.filter((tool) => ToolRegistry.hasTool(tool.name));
  }, [profile?.role]);

  const autoToolShortcuts = useMemo(() => {
    return toolShortcuts.filter(
      (tool) =>
        tool.category === 'caps' ||
        tool.category === 'data' ||
        tool.category === 'navigation' ||
        (tool.category === 'communication' && tool.name === 'export_pdf'),
    );
  }, [toolShortcuts]);

  const plannerTools = useMemo(() => {
    return autoToolShortcuts
      .map((tool) => {
        const registryTool = ToolRegistry.getTool(tool.name);
        return {
          name: tool.name,
          description: tool.description || registryTool?.description || tool.label,
          parameters: registryTool?.parameters,
        };
      })
      .filter((tool) => !!tool.name);
  }, [autoToolShortcuts]);

  /**
   * Attempt automatic tool plan + execution for a user message.
   * Returns the tool context string to inject into the AI prompt, or null.
   */
  const tryAutoTool = useCallback(
    async (outgoingText: string): Promise<{ context: string; message: DashMessage } | null> => {
      if (!shouldAttemptToolPlan(outgoingText) || plannerTools.length === 0) return null;
      try {
        let supabaseClient: any = null;
        try {
          supabaseClient = assertSupabase();
        } catch {}
        if (!supabaseClient) return null;

        const plan = await planToolCall({
          supabaseClient,
          role: String(profile?.role || 'parent').toLowerCase(),
          message: outgoingText,
          tools: plannerTools,
        });
        if (!plan?.tool) return null;

        const toolTraceId = `dash_assistant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const execution = await ToolRegistry.execute(plan.tool, plan.parameters || {}, {
          profile,
          user,
          supabase: supabaseClient,
          role: String(profile?.role || 'parent').toLowerCase(),
          tier: tier || 'free',
          organizationId:
            (profile as any)?.organization_id || (profile as any)?.preschool_id || null,
          hasOrganization: Boolean(
            (profile as any)?.organization_id || (profile as any)?.preschool_id,
          ),
          isGuest: !user?.id,
          trace_id: toolTraceId,
          tool_plan: { source: 'useDashAssistant.auto_planner', tool: plan.tool },
        });

        const label =
          autoToolShortcuts.find((t) => t.name === plan.tool)?.label || plan.tool;
        const content = formatToolResultMessage(label, execution);
        const toolMessage: DashMessage = {
          id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'assistant',
          content,
          timestamp: Date.now(),
          metadata: { tool_name: plan.tool, tool_result: execution },
        };
        return { context: content, message: toolMessage };
      } catch (toolErr) {
        console.warn('[useToolExecution] Auto tool failed:', toolErr);
        return null;
      }
    },
    [plannerTools, autoToolShortcuts, profile, user, tier],
  );

  /** Manual tool run from the UI */
  const runTool = useCallback(
    async (toolName: string, toolParams: Record<string, any>) => {
      const tool = ToolRegistry.getTool(toolName);
      if (!tool) {
        showAlert({
          title: 'Tool Not Found',
          message: `The tool "${toolName}" is not available right now.`,
          type: 'warning',
          icon: 'alert-circle-outline',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        return;
      }

      let supabaseClient: any = null;
      try {
        supabaseClient = assertSupabase();
      } catch {}

      const context = {
        profile,
        user,
        supabase: supabaseClient,
        role: String(profile?.role || 'parent').toLowerCase(),
        tier: tier || 'free',
        organizationId:
          (profile as any)?.organization_id || (profile as any)?.preschool_id || null,
        hasOrganization: Boolean(
          (profile as any)?.organization_id || (profile as any)?.preschool_id,
        ),
        isGuest: !user?.id,
        trace_id: `dash_assistant_manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tool_plan: { source: 'useDashAssistant.runTool', tool: toolName },
      };

      const execution = await ToolRegistry.execute(toolName, toolParams, context);
      const label = tool.name || toolName;
      const content = formatToolResultMessage(label, execution);
      const toolMessage: DashMessage = {
        id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'assistant',
        content,
        timestamp: Date.now(),
        metadata: { tool_name: toolName, tool_result: execution },
      };
      setMessages((prev) => [...prev, toolMessage]);

      const convId = dashInstance?.getCurrentConversationId?.();
      if (dashInstance && convId) {
        try {
          await (dashInstance as any).addMessageToConversation(convId, toolMessage);
        } catch (error) {
          console.warn('[useToolExecution] Failed to persist tool message:', error);
        }
      }
    },
    [dashInstance, profile, user, showAlert, tier, setMessages],
  );

  return { toolShortcuts, autoToolShortcuts, plannerTools, tryAutoTool, runTool };
}
