/**
 * Tool Registry Initialization
 * 
 * Import and register all available tools for Dash AI.
 * Call initializeTools() once on app startup.
 */

import { DashToolRegistry } from '../DashToolRegistry';
import { DatabaseQueryTool } from './DatabaseQueryTool';
import { CAPSCurriculumTool } from './CAPSCurriculumTool';
import { UserContextTool } from './UserContextTool';
import { TextbookContentTool } from './TextbookContentTool';

/**
 * Initialize all tools and register them with the registry
 */
export function initializeTools(): void {
  console.log('[Tools] Initializing agentic tools...');

  // Register Database Tools
  DashToolRegistry.registerTool(DatabaseQueryTool);

  // Register Educational Tools (CAPS Curriculum)
  DashToolRegistry.registerTool(CAPSCurriculumTool);
  DashToolRegistry.registerTool(TextbookContentTool);
  
  // Register User Context Tools
  DashToolRegistry.registerTool(UserContextTool);

  // TODO: Add more tools here as they're implemented:
  // DashToolRegistry.registerTool(NavigationTool);
  // DashToolRegistry.registerTool(ReportGenerationTool);
  // DashToolRegistry.registerTool(NotificationTool);

  const stats = DashToolRegistry.getStats();
  console.log(`[Tools] Initialized ${stats.totalTools} tools`);
  console.log(`[Tools] By category:`, stats.toolsByCategory);
  console.log(`[Tools] By risk:`, stats.toolsByRisk);
}

/**
 * Export tool registry for direct access
 */
export { DashToolRegistry } from '../DashToolRegistry';

/**
 * Export individual tools
 */
export { DatabaseQueryTool } from './DatabaseQueryTool';
export { CAPSCurriculumTool } from './CAPSCurriculumTool';
export { UserContextTool } from './UserContextTool';
export { TextbookContentTool } from './TextbookContentTool';
