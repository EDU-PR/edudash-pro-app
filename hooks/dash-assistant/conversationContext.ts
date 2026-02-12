import type { CapabilityTier } from '@/lib/tiers';
import type { ConversationContextMessage, DashMessage } from '@/services/dash-ai/types';

export interface ConversationContextOptions {
  maxMessages?: number;
  maxTokens?: number;
}

const DEFAULT_MAX_TOKENS = 8000;
const MESSAGE_OVERHEAD_TOKENS = 8;

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function resolveConversationWindowByTier(tier: CapabilityTier): { maxMessages: number; maxTokens: number } {
  switch (tier) {
    case 'free':
      return { maxMessages: 10, maxTokens: 6000 };
    case 'starter':
      return { maxMessages: 20, maxTokens: 8000 };
    case 'premium':
    case 'enterprise':
      return { maxMessages: 30, maxTokens: 10000 };
    default:
      return { maxMessages: 20, maxTokens: DEFAULT_MAX_TOKENS };
  }
}

function mapMessageRole(type: DashMessage['type']): 'user' | 'assistant' | null {
  if (type === 'user') return 'user';
  if (type === 'assistant' || type === 'task_result' || type === 'system') return 'assistant';
  return null;
}

function normalizeMessageContent(content: string | null | undefined): string {
  return String(content || '').replace(/\s+/g, ' ').trim();
}

export function buildConversationContext(
  messages: DashMessage[],
  options: ConversationContextOptions = {},
): ConversationContextMessage[] {
  const maxMessages = Math.max(1, options.maxMessages || 20);
  const maxTokens = Math.max(1000, options.maxTokens || DEFAULT_MAX_TOKENS);

  const context: ConversationContextMessage[] = [];
  let tokenBudget = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const role = mapMessageRole(message.type);
    if (!role) continue;

    const content = normalizeMessageContent(message.content);
    if (!content) continue;

    const messageTokens = estimateTokenCount(content) + MESSAGE_OVERHEAD_TOKENS;
    if (context.length >= maxMessages) break;
    if (context.length > 0 && tokenBudget + messageTokens > maxTokens) break;

    context.push({ role, content });
    tokenBudget += messageTokens;
  }

  return context.reverse();
}
