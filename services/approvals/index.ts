/**
 * Approval Workflows - Index
 * 
 * Re-exports all approval workflow services for easy importing
 * Split from monolithic ApprovalWorkflowService for WARP.md compliance
 * 
 * Usage:
 *   import { ApprovalWorkflowService } from './services/approvals';
 *   // or import specific services
 *   import { POPWorkflowService, PettyCashWorkflowService } from './services/approvals';
 */

// Types
export * from './types';

// Services
export { POPWorkflowService } from './POPWorkflowService';
export { PettyCashWorkflowService } from './PettyCashWorkflowService';
export { ApprovalNotificationService } from './ApprovalNotificationService';

// Re-export unified service for backwards compatibility
export { ApprovalWorkflowService } from './ApprovalWorkflowService';
