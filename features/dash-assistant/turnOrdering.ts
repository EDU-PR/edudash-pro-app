import type { DashMessage } from '@/services/dash-ai/types';

const getTurnId = (message: DashMessage): string => {
  const metadata = (message.metadata || {}) as Record<string, unknown>;
  const turnId = metadata.turn_id;
  return typeof turnId === 'string' ? turnId.trim() : '';
};

export function appendAssistantMessageByTurn(
  messages: DashMessage[],
  assistantMessage: DashMessage
): DashMessage[] {
  const turnId = getTurnId(assistantMessage);
  const withoutDuplicate = messages.filter((message) => message.id !== assistantMessage.id);

  if (!turnId) {
    return [...withoutDuplicate, assistantMessage];
  }

  let userIndex = -1;
  for (let index = withoutDuplicate.length - 1; index >= 0; index -= 1) {
    const candidate = withoutDuplicate[index];
    if (candidate.type !== 'user') continue;
    if (getTurnId(candidate) === turnId) {
      userIndex = index;
      break;
    }
  }

  if (userIndex < 0) {
    return [...withoutDuplicate, assistantMessage];
  }

  const insertIndex = userIndex + 1;
  return [
    ...withoutDuplicate.slice(0, insertIndex),
    assistantMessage,
    ...withoutDuplicate.slice(insertIndex),
  ];
}

export function normalizeMessagesByTurn(messages: DashMessage[]): DashMessage[] {
  let ordered: DashMessage[] = [];
  for (const message of messages) {
    if (message.type === 'assistant') {
      ordered = appendAssistantMessageByTurn(ordered, message);
      continue;
    }
    ordered = [...ordered, message];
  }
  return ordered;
}
