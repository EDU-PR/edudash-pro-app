type ToolExecutionResult = {
  success: boolean;
  result?: any;
  error?: string;
};

const truncate = (value: string, max = 1800) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n...truncated`;
};

export function formatToolResultMessage(toolLabel: string, execution: ToolExecutionResult): string {
  if (!execution) {
    return `🔧 **${toolLabel}** finished but returned no data.`;
  }

  if (!execution.success) {
    return `🔧 **${toolLabel}** failed.\n\n${execution.error || 'Unknown error.'}`;
  }

  const payload = execution.result;
  const summary =
    (payload && typeof payload === 'object' && (payload.summary || payload.message)) ||
    (typeof payload === 'string' ? payload : null);

  let message = `🔧 **${toolLabel}** completed.`;
  if (summary) {
    message = `🔧 **${toolLabel}**\n\n${summary}`;
  }

  if (payload && typeof payload === 'object') {
    try {
      const json = JSON.stringify(payload, null, 2);
      if (json && json !== '{}' && json !== '[]') {
        message += `\n\n\`\`\`json\n${truncate(json)}\n\`\`\``;
      }
    } catch {
      // ignore JSON errors
    }
  }

  return message;
}
