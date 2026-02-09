import { AgentOrchestratorClass } from '../AgentOrchestrator';

describe('AgentOrchestrator quick-win behavior', () => {
  const perceptionFixture = {
    userId: 'teacher-1',
    userRole: 'teacher',
    userTier: 'starter',
    organizationId: 'org-1',
    confirmedTools: [],
    memories: [],
    toolSpecs: [],
    screenContext: { screen: 'teacher_dashboard' },
    knowledgeSnippets: [],
    knowledgeConfidence: 0.2,
    timestamp: '2026-02-08T12:00:00.000Z',
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('escalates unresolved goals to support tickets', async () => {
    const orchestrator = new AgentOrchestratorClass();

    jest.spyOn(orchestrator as any, 'perceive').mockResolvedValue(perceptionFixture);
    jest.spyOn(orchestrator as any, 'planNextStep').mockResolvedValue({
      content: 'Checking context',
      toolCalls: [{ name: 'support_check_user_context', arguments: {} }],
    });
    jest.spyOn(orchestrator as any, 'executePlannedTool').mockResolvedValue({
      success: true,
      result: { open_ticket_count: 0 },
    });
    jest.spyOn(orchestrator as any, 'validateStep').mockResolvedValue({
      shouldFinish: false,
      reason: 'low_confidence',
      confidenceScore: 0.82,
      needsClarification: false,
      escalationRecommended: true,
    });
    jest.spyOn(orchestrator as any, 'reflect').mockResolvedValue('Reflection');
    jest.spyOn(orchestrator as any, 'storeExecution').mockResolvedValue(undefined);
    const escalateSpy = jest
      .spyOn(orchestrator as any, 'escalateUnresolvedGoal')
      .mockResolvedValue({
        referenceId: 'ticket-123',
        message: 'Escalated to support.',
      });

    const result = await orchestrator.run({
      objective: 'Parent cannot upload proof of payment',
      constraints: { maxSteps: 1, maxTools: 1, timeout: 10000 },
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('ticket-123');
    expect(result.metadata?.resolution_status).toBe('escalated');
    expect(result.metadata?.escalation_reference_id).toBe('ticket-123');
    expect(escalateSpy).toHaveBeenCalledTimes(1);
  });

  it('asks a focused clarification question on verifier signal', async () => {
    const orchestrator = new AgentOrchestratorClass();

    jest.spyOn(orchestrator as any, 'perceive').mockResolvedValue(perceptionFixture);
    jest.spyOn(orchestrator as any, 'planNextStep').mockResolvedValue({
      content: 'Let me verify that.',
      toolCalls: [{ name: 'support_check_user_context', arguments: {} }],
    });
    jest.spyOn(orchestrator as any, 'executePlannedTool').mockResolvedValue({
      success: true,
      result: { open_ticket_count: 0 },
    });
    jest.spyOn(orchestrator as any, 'validateStep').mockResolvedValue({
      shouldFinish: false,
      reason: 'needs_clarification',
      confidenceScore: 0.55,
      needsClarification: true,
      clarificationQuestion: 'Which screen are you seeing this on?',
      escalationRecommended: false,
    });
    jest.spyOn(orchestrator as any, 'reflect').mockResolvedValue('Reflection');
    jest.spyOn(orchestrator as any, 'storeExecution').mockResolvedValue(undefined);
    const escalateSpy = jest.spyOn(orchestrator as any, 'escalateUnresolvedGoal');

    const result = await orchestrator.run({
      objective: 'Payments are not updating',
      constraints: { maxSteps: 2, maxTools: 2, timeout: 10000 },
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Which screen are you seeing this on?');
    expect(result.metadata?.resolution_status).toBe('needs_clarification');
    expect(escalateSpy).not.toHaveBeenCalled();
  });
});
