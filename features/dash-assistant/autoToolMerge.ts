import type { DashMessage } from '@/services/dash-ai/types';

const PDF_TOOL_NAMES = new Set([
  'export_pdf',
  'generate_worksheet',
  'generate_chart',
  'generate_pdf_from_prompt',
]);

const firstText = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const normalizeToolKey = (value: string): string => String(value || '').trim().toLowerCase();

const extractExecutionPayload = (execution: ToolExecutionResult): unknown => {
  return execution.result ?? execution.data ?? null;
};

const toPdfArtifact = (execution: ToolExecutionResult) => {
  const payload = extractExecutionPayload(execution);
  if (!payload || typeof payload !== 'object') return null;

  const root = payload as Record<string, unknown>;
  const nested = root.result && typeof root.result === 'object'
    ? root.result as Record<string, unknown>
    : null;
  const source = { ...root, ...(nested || {}) };

  const artifact = {
    storagePath: firstText(source.storagePath, source.storage_path),
    downloadUrl: firstText(
      source.downloadUrl,
      source.download_url,
      source.url,
      source.uri,
      source.publicUrl,
      source.public_url
    ),
    signedUrl: firstText(source.signedUrl, source.signed_url),
    filename: firstText(source.filename, source.file_name, source.name),
    linkType: firstText(source.linkType, source.link_type),
    warning: firstText(source.warning, source.warning_message),
  };

  if (!Object.values(artifact).some(Boolean)) return null;
  return artifact;
};

export type ToolExecutionResult = {
  success: boolean;
  result?: any;
  data?: any;
  error?: string;
};

export interface AutoToolExecution {
  toolName: string;
  toolArgs: Record<string, unknown>;
  execution: ToolExecutionResult;
  summary?: string;
}

export function mergeAutoToolExecutionIntoResponse(
  response: DashMessage,
  autoToolExecution: AutoToolExecution | null
): DashMessage {
  if (!autoToolExecution) return response;

  const metadata = {
    ...((response.metadata || {}) as Record<string, unknown>),
  } as Record<string, unknown>;
  const toolKey = normalizeToolKey(autoToolExecution.toolName);
  const payload = extractExecutionPayload(autoToolExecution.execution);
  const summaryFromPayload =
    payload && typeof payload === 'object'
      ? firstText(
          (payload as Record<string, unknown>).summary,
          (payload as Record<string, unknown>).message,
          (payload as Record<string, unknown>).status_message,
          (payload as Record<string, unknown>).title,
        )
      : undefined;
  const summary = autoToolExecution.summary || summaryFromPayload;

  metadata.tool_name = autoToolExecution.toolName;
  metadata.tool_result = {
    success: autoToolExecution.execution.success !== false,
    result: payload,
    error: autoToolExecution.execution.success === false
      ? firstText(autoToolExecution.execution.error) || 'Tool execution failed'
      : undefined,
  };
  metadata.tool_args = autoToolExecution.toolArgs || {};
  metadata.tool_summary = summary;
  metadata.tool_origin = 'auto_planner';
  metadata.auto_tool_merged = true;

  const isPdfTool = PDF_TOOL_NAMES.has(toolKey);
  const pdfArtifact = isPdfTool ? toPdfArtifact(autoToolExecution.execution) : null;
  if (pdfArtifact) {
    metadata.pdf_artifact = pdfArtifact;
  }

  if (isPdfTool && autoToolExecution.execution.success !== false) {
    const filename = pdfArtifact?.filename;
    return {
      ...response,
      content: filename
        ? `Your PDF is ready: ${filename}. Tap Preview PDF to open it.`
        : 'Your PDF is ready. Tap Preview PDF to open it.',
      metadata: metadata as any,
    };
  }

  return {
    ...response,
    metadata: metadata as any,
  };
}
