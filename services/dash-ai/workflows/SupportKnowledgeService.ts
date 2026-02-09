/**
 * SupportKnowledgeService
 *
 * Lightweight FAQ/KB retrieval with source snippets and confidence scoring.
 * Seeded from common support workflows described in operations docs.
 */

export interface SupportKnowledgeSnippet {
  source: string;
  title: string;
  snippet: string;
  score: number;
}

export interface SupportKnowledgeResult {
  snippets: SupportKnowledgeSnippet[];
  confidence_score: number;
}

interface KnowledgeEntry {
  id: string;
  source: string;
  title: string;
  content: string;
  tags: string[];
}

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: 'payment_pop_upload_limit',
    source: 'kb://troubleshooting/upload-failures.md',
    title: 'Proof Of Payment Upload Failed',
    content:
      'If proof of payment upload fails, check file size and format. Use JPG/PNG/PDF and keep files under the app limit. Retry on stable network and re-open the upload screen.',
    tags: ['payment', 'proof', 'upload', 'file', 'size', 'failed'],
  },
  {
    id: 'payment_not_reflecting',
    source: 'kb://troubleshooting/payment-issues.md',
    title: 'Payment Not Reflecting',
    content:
      'When a payment is not reflected yet, verify payment reference, check pending verification status, and allow processing time. If still missing, escalate with receipt details.',
    tags: ['payment', 'fees', 'pending', 'verification', 'reference'],
  },
  {
    id: 'teacher_class_visibility',
    source: 'kb://troubleshooting/class-assignment.md',
    title: 'Teacher Cannot See Class',
    content:
      'If a teacher cannot see a class, confirm role assignment, class linkage, and organization membership. Re-sync assignments after role or class changes.',
    tags: ['teacher', 'class', 'assignment', 'role', 'organization'],
  },
  {
    id: 'homework_help_flow',
    source: 'kb://features/homework-grading.md',
    title: 'Homework Assistance Flow',
    content:
      'For homework help, identify grade and topic first, provide one guided step at a time, and ask a short check question before moving to the next step.',
    tags: ['homework', 'tutor', 'grade', 'topic', 'guided'],
  },
  {
    id: 'support_escalation',
    source: 'kb://getting-started/support-escalation.md',
    title: 'Escalating To Human Support',
    content:
      'If the issue is unresolved, create a support ticket with subject, clear description, and user context. Share ticket reference and expected response window.',
    tags: ['support', 'ticket', 'escalate', 'human', 'unresolved'],
  },
  {
    id: 'login_session_recovery',
    source: 'kb://troubleshooting/login-problems.md',
    title: 'Session And Login Recovery',
    content:
      'For session problems, ask the user to sign out and sign in again, then retry the action. If authentication persists, reset credentials via support workflow.',
    tags: ['login', 'auth', 'session', 'sign in', 'reset'],
  },
];

function tokenize(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function scoreEntry(entry: KnowledgeEntry, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  const contentTokens = new Set(tokenize(`${entry.title} ${entry.content}`));
  const tagTokens = new Set(entry.tags.map((tag) => tag.toLowerCase()));

  let matches = 0;
  let tagMatches = 0;
  for (const token of queryTokens) {
    if (contentTokens.has(token)) matches += 1;
    if (tagTokens.has(token)) tagMatches += 1;
  }

  const lexicalCoverage = matches / queryTokens.length;
  const tagBoost = tagMatches > 0 ? Math.min(0.2, (tagMatches / queryTokens.length) * 0.25) : 0;
  return Math.max(0, lexicalCoverage + tagBoost);
}

function normalizeSnippet(content: string, maxLength = 220): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
}

export function searchSupportKnowledge(
  query: string,
  options: { limit?: number; minScore?: number } = {},
): SupportKnowledgeResult {
  const limit = Math.max(1, Math.min(8, options.limit ?? 3));
  const minScore = Math.max(0, Math.min(1, options.minScore ?? 0.18));
  const queryTokens = tokenize(query);

  const ranked = KNOWLEDGE_BASE
    .map((entry) => {
      const score = scoreEntry(entry, queryTokens);
      return { entry, score };
    })
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (ranked.length === 0) {
    return {
      snippets: [],
      confidence_score: 0.18,
    };
  }

  const snippets: SupportKnowledgeSnippet[] = ranked.map((item) => ({
    source: item.entry.source,
    title: item.entry.title,
    snippet: normalizeSnippet(item.entry.content),
    score: Number(item.score.toFixed(3)),
  }));

  const topScore = ranked[0]?.score ?? 0;
  const coverage = ranked.length / limit;
  const confidence = Math.min(0.95, Math.max(0.25, topScore * 0.75 + coverage * 0.25));

  return {
    snippets,
    confidence_score: Number(confidence.toFixed(2)),
  };
}

export function getSupportKnowledgeSeedCount(): number {
  return KNOWLEDGE_BASE.length;
}
