type ToolExecutionResult = {
  success: boolean;
  result?: any;
  data?: any;
  error?: string;
};

const truncate = (value: string, max = 320) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
};

const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const prettifyToolLabel = (toolLabel: string) => {
  const normalized = String(toolLabel || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!normalized) return 'Tool';

  return titleCase(
    normalized
      .replace(/\b(get|fetch|run|execute|create|generate|build)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || normalized,
  );
};

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const buildSummaryFromPayload = (toolKey: string, payload: any): string | null => {
  if (!payload) return null;
  if (typeof payload === 'string') return truncate(payload);
  if (typeof payload !== 'object') return null;

  const summary = firstString(payload.summary, payload.message, payload.title, payload.status_message);
  if (summary) return truncate(summary);

  const grade = firstString(payload.grade, payload.grade_level);
  const subject = firstString(payload.subject, payload.topic);
  const count = typeof payload.count === 'number' ? payload.count : null;

  if (toolKey === 'get_caps_documents') {
    const detail = [grade ? `Grade ${String(grade).replace(/^grade\s*/i, '')}` : null, subject]
      .filter(Boolean)
      .join(' ');
    if (count === 0) return `No CAPS documents found${detail ? ` for ${detail}` : ''}.`;
    if (count !== null) return `Found ${count} CAPS document${count === 1 ? '' : 's'}${detail ? ` for ${detail}` : ''}.`;
    return `CAPS lookup finished${detail ? ` for ${detail}` : ''}.`;
  }

  if (Array.isArray(payload.documents)) {
    const n = payload.documents.length;
    return `Found ${n} document${n === 1 ? '' : 's'}.`;
  }

  if (Array.isArray(payload.recommendations)) {
    const n = payload.recommendations.length;
    return `Generated ${n} recommendation${n === 1 ? '' : 's'}.`;
  }

  if (count !== null) {
    const detail = [grade ? `Grade ${String(grade).replace(/^grade\s*/i, '')}` : null, subject]
      .filter(Boolean)
      .join(' ');
    return `${count} result${count === 1 ? '' : 's'} returned${detail ? ` for ${detail}` : ''}.`;
  }

  return null;
};

export function formatToolResultMessage(toolLabel: string, execution: ToolExecutionResult): string {
  const prettyToolLabel = prettifyToolLabel(toolLabel);

  if (!execution) {
    return `**${prettyToolLabel}** completed but returned no data.`;
  }

  if (!execution.success) {
    return `**${prettyToolLabel}** needs attention.\n\n${execution.error || 'Unknown error.'}`;
  }

  const payload = execution.result ?? execution.data;
  const toolKey = String(toolLabel || '').trim().toLowerCase().replace(/\s+/g, '_');
  const summary = buildSummaryFromPayload(toolKey, payload);

  if (summary) {
    return `**${prettyToolLabel}**\n\n${summary}`;
  }

  return `**${prettyToolLabel}** completed successfully.`;
}
