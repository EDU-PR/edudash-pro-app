export const FULL_CHAT_QUIZ_INTENT_REGEX =
  /\b(quiz|test me|practice test|mock test|multiple choice|assessment|exam prep|revision quiz)\b/i;

export const FULL_CHAT_CHART_INTENT_REGEX =
  /\b(chart|graph|bar chart|line chart|pie chart|table|diagram|visuali[sz]e|worksheet|plot)\b/i;

export type FullChatIntent = 'quiz' | 'chart' | null;

export function classifyFullChatIntent(text: string): FullChatIntent {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return null;

  if (FULL_CHAT_QUIZ_INTENT_REGEX.test(normalized)) return 'quiz';
  if (FULL_CHAT_CHART_INTENT_REGEX.test(normalized)) return 'chart';
  return null;
}
