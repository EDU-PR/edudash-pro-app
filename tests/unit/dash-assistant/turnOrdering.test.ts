import type { DashMessage } from '@/services/dash-ai/types';
import {
  appendAssistantMessageByTurn,
  normalizeMessagesByTurn,
} from '@/features/dash-assistant/turnOrdering';

describe('turnOrdering', () => {
  it('inserts assistant response directly after the matching user turn', () => {
    const messages: DashMessage[] = [
      {
        id: 'u-1',
        type: 'user',
        content: 'Turn 1 question',
        timestamp: 1,
        metadata: { turn_id: 'turn-1' },
      },
      {
        id: 'u-2',
        type: 'user',
        content: 'Turn 2 question',
        timestamp: 2,
        metadata: { turn_id: 'turn-2' },
      },
    ];
    const assistant: DashMessage = {
      id: 'a-1',
      type: 'assistant',
      content: 'Turn 1 answer',
      timestamp: 3,
      metadata: { turn_id: 'turn-1' },
    };

    const ordered = appendAssistantMessageByTurn(messages, assistant);
    expect(ordered.map((message) => message.id)).toEqual(['u-1', 'a-1', 'u-2']);
  });

  it('falls back to append when no matching turn exists', () => {
    const messages: DashMessage[] = [
      {
        id: 'u-1',
        type: 'user',
        content: 'Question',
        timestamp: 1,
      },
    ];
    const assistant: DashMessage = {
      id: 'a-1',
      type: 'assistant',
      content: 'Answer',
      timestamp: 2,
      metadata: { turn_id: 'missing-turn' },
    };

    const ordered = appendAssistantMessageByTurn(messages, assistant);
    expect(ordered.map((message) => message.id)).toEqual(['u-1', 'a-1']);
  });

  it('normalizes mixed server message arrays by turn id', () => {
    const messages: DashMessage[] = [
      {
        id: 'u-1',
        type: 'user',
        content: 'Question',
        timestamp: 1,
        metadata: { turn_id: 'turn-1' },
      },
      {
        id: 'u-2',
        type: 'user',
        content: 'Later question',
        timestamp: 2,
        metadata: { turn_id: 'turn-2' },
      },
      {
        id: 'a-1',
        type: 'assistant',
        content: 'Answer for turn 1',
        timestamp: 3,
        metadata: { turn_id: 'turn-1' },
      },
    ];

    const ordered = normalizeMessagesByTurn(messages);
    expect(ordered.map((message) => message.id)).toEqual(['u-1', 'a-1', 'u-2']);
  });
});
