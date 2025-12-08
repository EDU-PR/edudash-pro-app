/**
 * Approval Workflow Service
 * 
 * REFACTORED: This file now re-exports from modular services in ./approvals/
 * 
 * Split for WARP.md compliance (files must be ≤500 lines):
 * - services/approvals/types.ts - Type definitions
 * - services/approvals/POPWorkflowService.ts - Proof of Payment workflows
 * - services/approvals/PettyCashWorkflowService.ts - Petty cash requests
 * - services/approvals/ApprovalNotificationService.ts - Push notifications
 * - services/approvals/ApprovalWorkflowService.ts - Unified service
 * 
 * Usage remains the same:
 *   import { ApprovalWorkflowService } from './services/ApprovalWorkflowService';
 */

// Re-export everything from modular approvals
export * from './approvals';
export { ApprovalWorkflowService } from './approvals/ApprovalWorkflowService';
