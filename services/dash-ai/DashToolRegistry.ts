/**
 * DashToolRegistry (Compatibility Shim)
 *
 * Legacy static API kept for existing Dash AI tooling/tests.
 * Implementation now delegates to UnifiedToolRegistry.
 */

import { unifiedToolRegistry } from '@/services/tools/UnifiedToolRegistry';
import type {
  Tool,
  ToolCategory,
  RiskLevel,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolRegistryStats,
} from './types';

const EMPTY_CATEGORY_COUNTS = (): Record<ToolCategory, number> => ({
  database: 0,
  navigation: 0,
  file: 0,
  communication: 0,
  report: 0,
  analysis: 0,
  education: 0,
  profile: 0,
});

const EMPTY_RISK_COUNTS = (): Record<RiskLevel, number> => ({
  low: 0,
  medium: 0,
  high: 0,
});

export class DashToolRegistry {
  static registerTool(tool: Tool): void {
    unifiedToolRegistry.registerLegacyTool(tool);
  }

  static getAvailableTools(role: string, tier: string): Tool[] {
    return unifiedToolRegistry.listLegacy(role, tier);
  }

  static getClaudeTools(role: string, tier: string): Array<{
    name: string;
    description: string;
    input_schema: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  }> {
    return this.getAvailableTools(role, tier).map((tool) => tool.claudeToolDefinition);
  }

  static async executeTool(
    toolId: string,
    parameters: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const result = await unifiedToolRegistry.execute(toolId, parameters, context as any);
    return {
      success: result.success,
      data: result.result,
      error: result.error,
      metadata: result.metadata,
    };
  }

  static getTool(toolId: string): Tool | undefined {
    return unifiedToolRegistry.getLegacyTool(toolId);
  }

  static getAllTools(): Tool[] {
    return unifiedToolRegistry.listLegacy('super_admin', 'enterprise');
  }

  static getToolsByCategory(category: ToolCategory): Tool[] {
    return this.getAllTools().filter((tool) => tool.category === category);
  }

  static getToolsByRisk(riskLevel: RiskLevel): Tool[] {
    return this.getAllTools().filter((tool) => tool.riskLevel === riskLevel);
  }

  static getStats(): ToolRegistryStats {
    const tools = this.getAllTools();
    const toolsByCategory = EMPTY_CATEGORY_COUNTS();
    const toolsByRisk = EMPTY_RISK_COUNTS();

    tools.forEach((tool) => {
      toolsByCategory[tool.category] = (toolsByCategory[tool.category] || 0) + 1;
      toolsByRisk[tool.riskLevel] = (toolsByRisk[tool.riskLevel] || 0) + 1;
    });

    const unifiedStats = unifiedToolRegistry.getStats();

    return {
      totalTools: tools.length,
      toolsByCategory,
      toolsByRisk,
      recentExecutions: unifiedStats.recentExecutions,
      successRate: unifiedStats.successRate,
    };
  }

  static clear(): void {
    unifiedToolRegistry.clearLegacyTools();
  }
}
