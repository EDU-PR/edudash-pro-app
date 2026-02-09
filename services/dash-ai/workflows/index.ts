/**
 * Workflow module barrel export
 * @module services/dash-ai/workflows
 */

export { TeacherWorkflowEngine, WorkflowError } from './TeacherWorkflowEngine'
export { WORKFLOW_TEMPLATES, getAvailableWorkflows } from './templates'
export {
  searchSupportKnowledge,
  getSupportKnowledgeSeedCount,
} from './SupportKnowledgeService'
export type {
  SupportKnowledgeSnippet,
  SupportKnowledgeResult,
} from './SupportKnowledgeService'
export type {
  TeacherWorkflowTemplateId,
  WorkflowTemplate,
  WorkflowExecution,
  StepResult,
  WorkflowEvent,
  WorkflowStepTemplate,
  WorkflowParam,
} from './types'
