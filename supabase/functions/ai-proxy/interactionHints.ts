export type PlanModeStage = 'discover' | 'spec' | 'finalize';

export type PlanModeMeta = {
  active: boolean;
  stage: PlanModeStage;
  required_questions: string[];
  completed: boolean;
};

const PLAN_INTENT_PATTERNS: RegExp[] = [
  /\bplease\s+implement\s+this\s+plan\b/i,
  /\bimplement\s+this\s+plan\b/i,
  /\bplan\s+implementation\b/i,
  /\bimplementation\s+plan\b/i,
  /\bexecution\s+plan\b/i,
  /\bplan\s+for\b/i,
];

const PLAN_STAGE_QUESTIONS: Record<PlanModeStage, string[]> = {
  discover: [
    'What outcome should this plan achieve?',
    'What constraints or blockers must be respected?',
    'What timeline or deadline should we target?',
  ],
  spec: [
    'What are the exact deliverables for each phase?',
    'Which acceptance checks define done?',
    'Which dependencies must be completed first?',
  ],
  finalize: [
    'Who owns each task and deadline?',
    'What rollout and rollback steps are required?',
    'What validation checks are required before release?',
  ],
};

function normalizeStage(value: unknown): PlanModeStage | null {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'discover' || raw === 'spec' || raw === 'finalize') return raw;
  return null;
}

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase();
    if (raw === 'true' || raw === '1' || raw === 'yes') return true;
    if (raw === 'false' || raw === '0' || raw === 'no') return false;
  }
  return null;
}

function detectPlanIntentFromPrompt(prompt: string): boolean {
  const normalized = String(prompt || '').trim();
  if (!normalized) return false;
  return PLAN_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function inferStageFromText(text: string): PlanModeStage {
  const normalized = String(text || '').toLowerCase();
  if (
    /\b(final|ready to implement|ship|rollout|deploy|go live|release)\b/.test(normalized)
  ) {
    return 'finalize';
  }
  if (
    /\b(spec|architecture|milestone|deliverable|acceptance|validation|test plan)\b/.test(normalized)
  ) {
    return 'spec';
  }
  return 'discover';
}

export function derivePlanModeMeta(params: {
  metadata?: Record<string, unknown>;
  latestUserPrompt?: string | null;
  assistantResponse?: string | null;
}): PlanModeMeta | undefined {
  const metadata = params.metadata || {};
  const metadataPlanMode = metadata.plan_mode && typeof metadata.plan_mode === 'object'
    ? (metadata.plan_mode as Record<string, unknown>)
    : null;

  const explicitActive = coerceBoolean(metadata.plan_mode_active) ??
    coerceBoolean(metadata.planning_intent) ??
    (metadata.planning_mode === 'guided' ? true : null) ??
    (metadataPlanMode ? coerceBoolean(metadataPlanMode.active) : null);

  const promptPlanIntent = detectPlanIntentFromPrompt(String(params.latestUserPrompt || ''));
  const active = explicitActive ?? promptPlanIntent;
  if (!active) return undefined;

  const explicitStage =
    normalizeStage(metadata.plan_mode_stage) ||
    normalizeStage(metadataPlanMode?.stage);
  const inferredStage = inferStageFromText(
    `${String(params.latestUserPrompt || '')}\n${String(params.assistantResponse || '')}`
  );
  const stage = explicitStage || inferredStage;

  const metadataRequired = Array.isArray(metadataPlanMode?.required_questions)
    ? metadataPlanMode?.required_questions
    : Array.isArray(metadata.required_questions)
      ? metadata.required_questions
      : null;
  const requiredQuestions = (
    metadataRequired
      ? metadataRequired.map((item) => String(item || '').trim())
      : PLAN_STAGE_QUESTIONS[stage]
  ).filter((item) => item.length > 0).slice(0, 5);

  const completed = coerceBoolean(metadataPlanMode?.completed) ??
    coerceBoolean(metadata.plan_mode_completed) ??
    (stage === 'finalize' &&
      /\b(finalized|ready to implement|implementation checklist ready)\b/i.test(
        String(params.assistantResponse || '')
      ));

  return {
    active: true,
    stage,
    required_questions: requiredQuestions,
    completed: Boolean(completed),
  };
}

function pushUnique(target: string[], value: string) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return;
  if (!target.includes(normalized)) target.push(normalized);
}

function isFinanceContext(prompt: string, assistantResponse: string): boolean {
  const merged = `${prompt}\n${assistantResponse}`.toLowerCase();
  return /\b(finance|pop|payment|receivable|approval|billing month|audit)\b/.test(merged);
}

export function deriveSuggestedActions(params: {
  latestUserPrompt?: string | null;
  assistantResponse?: string | null;
  scope?: string | null;
  planMode?: PlanModeMeta;
  pendingToolCalls?: number;
  resolutionStatus?: string | null;
}): string[] {
  const prompt = String(params.latestUserPrompt || '');
  const assistantResponse = String(params.assistantResponse || '');
  const scope = String(params.scope || '').toLowerCase();
  const planMode = params.planMode;
  const actions: string[] = [];

  if (planMode?.active) {
    if (planMode.stage === 'discover') {
      pushUnique(actions, 'Define the outcome and success criteria');
      pushUnique(actions, 'List constraints, blockers, and assumptions');
      pushUnique(actions, 'Confirm timeline and key owners');
    } else if (planMode.stage === 'spec') {
      pushUnique(actions, 'Break the work into milestones');
      pushUnique(actions, 'Add acceptance checks per milestone');
      pushUnique(actions, 'Identify dependencies and sequencing');
    } else {
      pushUnique(actions, 'Generate the final implementation checklist');
      pushUnique(actions, 'Prepare rollout and rollback steps');
      pushUnique(actions, 'Run QA validation before release');
    }
  }

  const financeContext = isFinanceContext(prompt, assistantResponse);
  if ((scope === 'principal' || scope === 'admin') && financeContext) {
    pushUnique(actions, 'Verify student-month allocation before approval');
    pushUnique(actions, 'Confirm POP category and amount match');
    pushUnique(actions, 'Record approval notes for the audit trail');
  }

  if ((params.pendingToolCalls || 0) > 0) {
    pushUnique(actions, 'Run suggested tools to fetch missing data');
  }
  if (String(params.resolutionStatus || '') === 'needs_clarification') {
    pushUnique(actions, 'Answer the clarification question to continue');
  }

  if (!planMode?.active && actions.length < 3) {
    if (scope === 'student' || scope === 'parent') {
      pushUnique(actions, 'Explain this in simpler steps');
      pushUnique(actions, 'Give me one worked example');
      pushUnique(actions, 'Create a short practice task');
    } else {
      pushUnique(actions, 'Summarize this into an action checklist');
      pushUnique(actions, 'Highlight risks and mitigations');
      pushUnique(actions, 'Draft a message for stakeholders');
    }
  }

  return actions.slice(0, 4);
}
