/**
 * useTeacherWorkflow — Hook for managing agentic AI workflows
 *
 * Provides:
 *  - Available workflow templates (filtered by tier)
 *  - Workflow execution with real-time events
 *  - Active workflow tracking
 *  - Approval/cancellation controls
 *
 * @module hooks/useTeacherWorkflow
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  TeacherWorkflowEngine,
  getAvailableWorkflows,
} from '@/services/dash-ai/workflows'
import { WorkflowError } from '@/services/dash-ai/workflows/TeacherWorkflowEngine'
import type {
  TeacherWorkflowTemplateId,
  WorkflowTemplate,
  WorkflowExecution,
  WorkflowEvent,
} from '@/services/dash-ai/workflows/types'

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const workflowKeys = {
  all: ['workflows'] as const,
  active: (userId: string) => [...workflowKeys.all, 'active', userId] as const,
  execution: (id: string) => [...workflowKeys.all, 'execution', id] as const,
  templates: (tier: string) => [...workflowKeys.all, 'templates', tier] as const,
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseTeacherWorkflowOptions {
  userId: string | null | undefined
  organizationId: string | null | undefined
  /** User's subscription tier for template filtering */
  tier?: 'free' | 'starter' | 'premium' | 'enterprise'
  enabled?: boolean
}

interface UseTeacherWorkflowReturn {
  /** Available workflow templates for the user's tier */
  templates: WorkflowTemplate[]
  /** Currently active workflows */
  activeWorkflows: WorkflowExecution[]
  /** Real-time events from the current workflow */
  events: WorkflowEvent[]
  /** Start a new workflow */
  startWorkflow: (
    templateId: TeacherWorkflowTemplateId,
    params: Record<string, unknown>,
  ) => Promise<string>
  /** Approve a pending step */
  approveStep: (executionId: string, stepId: string) => Promise<boolean>
  /** Cancel a running workflow */
  cancelWorkflow: (executionId: string) => boolean
  /** Get a specific execution */
  getExecution: (executionId: string) => WorkflowExecution | undefined
  /** Whether a workflow is being started */
  isStarting: boolean
  /** Latest error */
  error: string | null
}

export function useTeacherWorkflow({
  userId,
  organizationId,
  tier = 'free',
  enabled = true,
}: UseTeacherWorkflowOptions): UseTeacherWorkflowReturn {
  const queryClient = useQueryClient()
  const [events, setEvents] = useState<WorkflowEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const eventsRef = useRef(events)
  eventsRef.current = events

  // ── Available templates ─────────────────────────────────────────────
  const templates = useMemo(() => getAvailableWorkflows(tier), [tier])

  // ── Active workflows ────────────────────────────────────────────────
  const activeQuery = useQuery({
    queryKey: workflowKeys.active(userId ?? ''),
    queryFn: () => TeacherWorkflowEngine.getActiveWorkflows(userId!),
    enabled: Boolean(userId) && enabled,
    refetchInterval: 5000, // Poll every 5s while workflows are active
    staleTime: 2000,
  })

  // ── Event handler ───────────────────────────────────────────────────
  const handleEvent = useCallback(
    (event: WorkflowEvent) => {
      setEvents((prev) => [...prev, event])

      // Invalidate active workflows on completion/failure
      if (
        event.type === 'workflow_completed' ||
        event.type === 'workflow_failed'
      ) {
        queryClient.invalidateQueries({
          queryKey: workflowKeys.active(userId ?? ''),
        })
      }
    },
    [queryClient, userId],
  )

  // ── Start workflow mutation ─────────────────────────────────────────
  const startMutation = useMutation({
    mutationFn: async ({
      templateId,
      params,
    }: {
      templateId: TeacherWorkflowTemplateId
      params: Record<string, unknown>
    }) => {
      setEvents([]) // Clear previous events
      setError(null)

      return TeacherWorkflowEngine.startWorkflow(
        templateId,
        userId!,
        organizationId!,
        params,
        handleEvent,
      )
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof WorkflowError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Workflow failed to start'
      setError(msg)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.active(userId ?? ''),
      })
    },
  })

  // ── Public API ──────────────────────────────────────────────────────
  const startWorkflow = useCallback(
    async (
      templateId: TeacherWorkflowTemplateId,
      params: Record<string, unknown>,
    ): Promise<string> => {
      if (!userId || !organizationId) {
        throw new Error('User and organization must be set')
      }
      return startMutation.mutateAsync({ templateId, params })
    },
    [userId, organizationId, startMutation],
  )

  const approveStep = useCallback(
    async (executionId: string, stepId: string): Promise<boolean> => {
      const result = await TeacherWorkflowEngine.approveStep(executionId, stepId)
      if (result) {
        queryClient.invalidateQueries({
          queryKey: workflowKeys.execution(executionId),
        })
      }
      return result
    },
    [queryClient],
  )

  const cancelWorkflow = useCallback(
    (executionId: string): boolean => {
      const result = TeacherWorkflowEngine.cancelWorkflow(executionId)
      if (result) {
        queryClient.invalidateQueries({
          queryKey: workflowKeys.active(userId ?? ''),
        })
      }
      return result
    },
    [queryClient, userId],
  )

  const getExecution = useCallback(
    (executionId: string): WorkflowExecution | undefined => {
      return TeacherWorkflowEngine.getExecution(executionId)
    },
    [],
  )

  return {
    templates,
    activeWorkflows: activeQuery.data ?? [],
    events,
    startWorkflow,
    approveStep,
    cancelWorkflow,
    getExecution,
    isStarting: startMutation.isPending,
    error,
  }
}
