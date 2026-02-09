/**
 * Tests for services/dash-ai/workflows/templates.ts — workflow template registry
 */

import {
  WORKFLOW_TEMPLATES,
  getAvailableWorkflows,
  lessonPlanWorkflow,
  weeklyPrepWorkflow,
  batchGradingWorkflow,
  progressReportWorkflow,
} from '../templates'

describe('WORKFLOW_TEMPLATES', () => {
  it('exports 4 predefined templates', () => {
    expect(Object.keys(WORKFLOW_TEMPLATES)).toHaveLength(4)
  })

  it.each([
    'lesson_plan_generation',
    'weekly_preparation',
    'batch_grading',
    'progress_report_generation',
  ])('has template: %s', (id) => {
    expect(WORKFLOW_TEMPLATES[id]).toBeDefined()
    expect(WORKFLOW_TEMPLATES[id].id).toBe(id)
  })

  it('every template has required fields', () => {
    for (const template of Object.values(WORKFLOW_TEMPLATES)) {
      expect(template.name).toBeTruthy()
      expect(template.description).toBeTruthy()
      expect(template.requiredTier).toBeTruthy()
      expect(template.estimatedDuration).toBeGreaterThan(0)
      expect(template.steps.length).toBeGreaterThan(0)
      expect(template.requiredParams.length).toBeGreaterThan(0)
    }
  })

  it('every template has at least one approval step', () => {
    for (const template of Object.values(WORKFLOW_TEMPLATES)) {
      const approvalSteps = template.steps.filter(
        (s) => s.type === 'approval_required',
      )
      expect(approvalSteps.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('step dependencies reference valid step IDs', () => {
    for (const template of Object.values(WORKFLOW_TEMPLATES)) {
      const stepIds = new Set(template.steps.map((s) => s.id))
      for (const step of template.steps) {
        for (const dep of step.dependsOn ?? []) {
          expect(stepIds.has(dep)).toBe(true)
        }
      }
    }
  })
})

describe('getAvailableWorkflows', () => {
  it('free tier gets no workflows', () => {
    const available = getAvailableWorkflows('free')
    expect(available).toHaveLength(0)
  })

  it('starter tier gets lesson_plan and batch_grading', () => {
    const available = getAvailableWorkflows('starter')
    const ids = available.map((w) => w.id)
    expect(ids).toContain('lesson_plan_generation')
    expect(ids).toContain('batch_grading')
    expect(ids).not.toContain('weekly_preparation')
    expect(ids).not.toContain('progress_report_generation')
  })

  it('premium tier gets all 4 workflows', () => {
    const available = getAvailableWorkflows('premium')
    expect(available).toHaveLength(4)
  })

  it('enterprise tier gets all 4 workflows', () => {
    const available = getAvailableWorkflows('enterprise')
    expect(available).toHaveLength(4)
  })
})

describe('lessonPlanWorkflow', () => {
  it('has 6 steps in correct order', () => {
    expect(lessonPlanWorkflow.steps).toHaveLength(6)
    expect(lessonPlanWorkflow.steps[0].id).toBe('caps_alignment')
    expect(lessonPlanWorkflow.steps[5].id).toBe('save_lesson')
  })

  it('requires subject, grade, and topic', () => {
    const required = lessonPlanWorkflow.requiredParams.filter((p) => p.required)
    const keys = required.map((p) => p.key)
    expect(keys).toContain('subject')
    expect(keys).toContain('grade')
    expect(keys).toContain('topic')
  })

  it('has optional differentiation param', () => {
    const diffParam = lessonPlanWorkflow.optionalParams?.find(
      (p) => p.key === 'differentiation',
    )
    expect(diffParam).toBeDefined()
    expect(diffParam!.defaultValue).toBe('standard')
  })
})

describe('batchGradingWorkflow', () => {
  it('requires starter tier', () => {
    expect(batchGradingWorkflow.requiredTier).toBe('starter')
  })

  it('has a review_grades approval step', () => {
    const review = batchGradingWorkflow.steps.find(
      (s) => s.id === 'review_grades',
    )
    expect(review).toBeDefined()
    expect(review!.type).toBe('approval_required')
    expect(review!.requiresApproval).toBe(true)
  })

  it('pattern_analysis depends on ai_grade_batch', () => {
    const analysis = batchGradingWorkflow.steps.find(
      (s) => s.id === 'pattern_analysis',
    )
    expect(analysis!.dependsOn).toContain('ai_grade_batch')
  })
})
