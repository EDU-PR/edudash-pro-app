/**
 * DashToolRegistry
 *
 * Registers and executes AI tools/functions available to Dash.
 * Refactored to use modular tool files following WARP.md standards.
 */

import { logger } from '@/lib/logger';
import {
  registerDataAccessTools,
  registerCommunicationTools,
  registerCAPSTools,
  registerNavigationTools,
  registerSuperAdminTools,
} from './tools';

export interface AgentTool {
  name: string;
  description: string;
  parameters: any; // JSON Schema
  risk: 'low' | 'medium' | 'high';
  requiresConfirmation?: boolean;
  execute: (args: any, context?: any) => Promise<any>;
}

export class DashToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  // Register a new tool
  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
    logger.debug(`[DashToolRegistry] Registered tool: ${tool.name}`);
  }

  // Get tool specifications for LLM
  getToolSpecs(): Array<{
    name: string;
    description: string;
    input_schema: any;
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }

  // Get a specific tool
  getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  // Execute a tool
  async execute(
    toolName: string,
    args: any,
    context?: any
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool ${toolName} not found` };
    }

    try {
      const result = await tool.execute(args, context);
      return { success: true, result };
    } catch (error) {
      logger.error(`[DashToolRegistry] Tool ${toolName} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Register default tools from modular files
  private registerDefaultTools(): void {
    const registerFn = this.register.bind(this);
    
    // Register tools from modular files
    registerDataAccessTools(registerFn);
    registerCommunicationTools(registerFn);
    registerCAPSTools(registerFn);
    registerNavigationTools(registerFn);
    registerSuperAdminTools(registerFn);
    
    logger.info(`[DashToolRegistry] Registered ${this.tools.size} tools`);
  }

  // Get tools by risk level
  getToolsByRisk(riskLevel: 'low' | 'medium' | 'high'): AgentTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.risk === riskLevel);
  }

  // Get tool names for autocomplete
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  // Check if a tool exists
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  // Get count of registered tools
  getToolCount(): number {
    return this.tools.size;
  }

  // Get all tools as array
  getAllTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  dispose(): void {
    this.tools.clear();
  }
}

// Singleton instance for current architecture
export const ToolRegistry = new DashToolRegistry();
