import { buildConversationContext, estimateTokenCount, resolveConversationWindowByTier } from '@/hooks/dash-assistant/conversationContext';
import type { DashMessage } from '@/services/dash-ai/types';

const createMessage = (
  id: string,
  type: DashMessage['type'],
  content: string,
): DashMessage => ({
  id,
  type,
  content,
  timestamp: Number(id.replace(/\D/g, '') || Date.now()),
});

describe('conversationContext', () => {
  it('builds ordered user/assistant context and skips empty messages', () => {
    const context = buildConversationContext([
      createMessage('m1', 'system', 'session started'),
      createMessage('m2', 'user', 'Hello Dash'),
      createMessage('m3', 'assistant', 'Hello!'),
      createMessage('m4', 'task_result', 'Tool result summary'),
      createMessage('m5', 'user', '  '),
      createMessage('m6', 'assistant', 'How can I help?'),
    ], { maxMessages: 10, maxTokens: 500 });

    expect(context).toEqual([
      { role: 'assistant', content: 'session started' },
      { role: 'user', content: 'Hello Dash' },
      { role: 'assistant', content: 'Hello!' },
      { role: 'assistant', content: 'Tool result summary' },
      { role: 'assistant', content: 'How can I help?' },
    ]);
  });

  it('respects message and token budgets', () => {
    const context = buildConversationContext([
      createMessage('m1', 'user', 'one'),
      createMessage('m2', 'assistant', 'two'),
      createMessage('m3', 'user', 'three'),
      createMessage('m4', 'assistant', 'four'),
    ], { maxMessages: 2, maxTokens: 200 });

    expect(context).toEqual([
      { role: 'user', content: 'three' },
      { role: 'assistant', content: 'four' },
    ]);
  });

  it('estimates tokens and resolves tier windows', () => {
    expect(estimateTokenCount('abcd')).toBe(1);
    expect(estimateTokenCount('abcdefgh')).toBe(2);

    expect(resolveConversationWindowByTier('free').maxMessages).toBe(10);
    expect(resolveConversationWindowByTier('starter').maxMessages).toBe(20);
    expect(resolveConversationWindowByTier('premium').maxMessages).toBe(30);
  });
});
