/**
 * Teacher Workflow Types
 *
 * Extends the DashTask/DashTaskStep/DashAction foundation with
 * teacher-specific workflow templates and execution context.
 *
 * @module services/dash-ai/workflows/types
 */

import type { DashTask, DashTaskStep, DashAction } from '@/services/dash-ai/types'

// ---------------------------------------------------------------------------
// Workflow Template IDs
// ---------------------------------------------------------------------------

/** Predefined workflow templates available to teachers */
export type TeacherWorkflowTemplateId =
  | 'lesson_plan_generation'
  | 'weekly_preparation'
  | 'batch_grading'
  | 'progress_report_generation'
  | 'parent_communication'
  | 'curriculum_alignment_check'

// ---------------------------------------------------------------------------
// Workflow Execution
// ---------------------------------------------------------------------------

/** Execution state for a running workflow */
export interface WorkflowExecution {
  id: string
  templateId: TeacherWorkflowTemplateId
  task: DashTask
  /** Who initiated this workflow */
  initiatedBy: string
  /** The school/org context */
  organizationId: string
  /** Current execution phase */
  phase: 'planning' | 'executing' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled'
  /** Intermediate results from each step */
  stepResults: Map<string, StepResult>
  /** When execution started */
  startedAt: number
  /** When execution completed/failed */
  endedAt: number | null
  /** Token usage across all AI calls in this workflow */
  tokenUsage: {
    input: number
    output: number
    cost: number
  }
}

/** Result from a single workflow step */
export interface StepResult {
  stepId: string
  status: 'success' | 'failed' | 'skipped' | 'pending_approval'
  output: unknown
  error?: string
  duration: number  // ms
  tokensUsed?: number
}

// ---------------------------------------------------------------------------
// Workflow Template Definition
// ---------------------------------------------------------------------------

/** A reusable workflow template that can be instantiated into a DashTask */
export interface WorkflowTemplate {
  id: TeacherWorkflowTemplateId
  name: string
  description: string
  /** Minimum subscription tier required */
  requiredTier: 'free' | 'starter' | 'premium' | 'enterprise'
  /** Estimated total duration in minutes */
  estimatedDuration: number
  /** Steps in execution order */
  steps: WorkflowStepTemplate[]
  /** Parameters the teacher must provide to start the workflow */
  requiredParams: WorkflowParam[]
  /** Optional parameters with defaults */
  optionalParams?: WorkflowParam[]
}

/** A step within a workflow template */
export interface WorkflowStepTemplate {
  id: string
  name: string
  description: string
  type: DashTaskStep['type']
  /** Which AI service type to call for automated steps */
  serviceType?: string
  /** Tool IDs from DashToolRegistry to use */
  toolIds?: string[]
  /** Prompt template with {{param}} placeholders */
  promptTemplate?: string
  /** Validation rules for the step output */
  outputValidation?: {
    required: boolean
    schema?: Record<string, unknown>
  }
  /** Whether this step requires teacher approval before continuing */
  requiresApproval?: boolean
  /** Dependencies — step IDs that must complete first */
  dependsOn?: string[]
}

/** A parameter for a workflow template */
export interface WorkflowParam {
  key: string
  label: string
  type: 'string' | 'number' | 'select' | 'multiselect' | 'date' | 'boolean'
  options?: Array<{ label: string; value: string }>
  defaultValue?: unknown
  required?: boolean
  placeholder?: string
}

// ---------------------------------------------------------------------------
// Workflow Events (for real-time UI updates)
// ---------------------------------------------------------------------------

export type WorkflowEvent =
  | { type: 'step_started'; stepId: string; stepName: string }
  | { type: 'step_completed'; stepId: string; result: StepResult }
  | { type: 'step_failed'; stepId: string; error: string }
  | { type: 'approval_required'; stepId: string; stepName: string; preview: unknown }
  | { type: 'workflow_completed'; executionId: string; summary: string }
  | { type: 'workflow_failed'; executionId: string; error: string }
  | { type: 'progress_update'; stepId: string; progress: number; message: string }
