import { unifiedToolRegistry } from '@/services/tools/UnifiedToolRegistry';

export type AgentTool = ReturnType<typeof unifiedToolRegistry.getTool>;

/**
 * Backward-compatible adapter used by Dash Assistant/Orb flows.
 *
 * This now delegates to the canonical UnifiedToolRegistry so UI shortcuts,
 * planner candidates, and ai-proxy client tools all read from one source.
 */
export const ToolRegistry = {
  getTool(name: string) {
    return unifiedToolRegistry.getTool(name);
  },

  hasTool(name: string) {
    return unifiedToolRegistry.hasTool(name);
  },

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context?: Record<string, unknown>
  ) {
    return unifiedToolRegistry.execute(toolName, args, context || {});
  },

  getToolSpecs(role = 'parent', tier = 'free') {
    return unifiedToolRegistry.getToolSpecs(role, tier);
  },

  getToolNames(role = 'parent', tier = 'free') {
    return unifiedToolRegistry.list(role, tier).map((tool) => tool.name);
  },

  getAllTools(role = 'parent', tier = 'free') {
    return unifiedToolRegistry.list(role, tier);
  },

  getStats() {
    return unifiedToolRegistry.getStats();
  },
};

export const DashToolRegistry = ToolRegistry;
