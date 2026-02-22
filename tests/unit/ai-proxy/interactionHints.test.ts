import {
  derivePlanModeMeta,
  deriveSuggestedActions,
} from '@/supabase/functions/ai-proxy/interactionHints';

describe('ai-proxy interaction hints', () => {
  it('activates guided plan mode from explicit implementation prompt', () => {
    const planMode = derivePlanModeMeta({
      metadata: {},
      latestUserPrompt: 'Please implement this plan for finance month parity.',
      assistantResponse: '',
    });

    expect(planMode).toBeDefined();
    expect(planMode?.active).toBe(true);
    expect(planMode?.stage).toBe('discover');
    expect((planMode?.required_questions || []).length).toBeGreaterThan(0);
  });

  it('respects explicit plan-mode metadata stage', () => {
    const planMode = derivePlanModeMeta({
      metadata: {
        planning_mode: 'guided',
        plan_mode_stage: 'spec',
        plan_mode: {
          required_questions: ['What are milestone deliverables?'],
        },
      },
      latestUserPrompt: 'Draft implementation notes',
      assistantResponse: 'Here is the specification.',
    });

    expect(planMode).toEqual({
      active: true,
      stage: 'spec',
      required_questions: ['What are milestone deliverables?'],
      completed: false,
    });
  });

  it('generates finance-safe suggestions with explicit month/audit guidance', () => {
    const suggested = deriveSuggestedActions({
      latestUserPrompt: 'Approve this POP payment for this month',
      assistantResponse: 'Please select the month before approval.',
      scope: 'principal',
      pendingToolCalls: 0,
      resolutionStatus: 'needs_clarification',
    });

    expect(suggested.length).toBeGreaterThan(0);
    expect(suggested.length).toBeLessThanOrEqual(4);
    expect(suggested).toContain('Verify student-month allocation before approval');
    expect(suggested).toContain('Record approval notes for the audit trail');
  });

  it('returns capped deduped suggestions for plan-mode responses', () => {
    const planMode = derivePlanModeMeta({
      metadata: { planning_mode: 'guided', plan_mode_stage: 'finalize' },
      latestUserPrompt: 'execution plan',
      assistantResponse: 'Ready to implement',
    });

    const suggested = deriveSuggestedActions({
      latestUserPrompt: 'execution plan',
      assistantResponse: 'Ready to implement',
      scope: 'admin',
      planMode,
      pendingToolCalls: 3,
      resolutionStatus: 'needs_clarification',
    });

    expect(suggested.length).toBeGreaterThan(0);
    expect(suggested.length).toBeLessThanOrEqual(4);
    expect(new Set(suggested).size).toBe(suggested.length);
  });
});
