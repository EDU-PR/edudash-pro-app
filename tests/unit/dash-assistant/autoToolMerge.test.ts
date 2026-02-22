import type { DashMessage } from '@/services/dash-ai/types';
import {
  mergeAutoToolExecutionIntoResponse,
  type AutoToolExecution,
} from '@/features/dash-assistant/autoToolMerge';
import { appendAssistantMessageByTurn } from '@/features/dash-assistant/turnOrdering';

describe('autoToolMerge', () => {
  const baseResponse: DashMessage = {
    id: 'assistant-1',
    type: 'assistant',
    content: 'Long server response that should be compacted for PDF previews.',
    timestamp: 1,
    metadata: {
      turn_id: 'turn-1',
    },
  };

  const pdfExecution: AutoToolExecution = {
    toolName: 'export_pdf',
    toolArgs: { title: 'Math Worksheet' },
    summary: 'PDF ready to open.',
    execution: {
      success: true,
      result: {
        filename: 'worksheet.pdf',
        storagePath: 'org/worksheet.pdf',
        signedUrl: 'https://example.com/storage/v1/object/sign/generated-pdfs/org/worksheet.pdf?token=abc',
        linkType: 'signed',
      },
    },
  };

  it('merges auto-planner PDF metadata into the final assistant turn', () => {
    const merged = mergeAutoToolExecutionIntoResponse(baseResponse, pdfExecution);
    const metadata = (merged.metadata || {}) as Record<string, any>;

    expect(merged.content).toContain('Your PDF is ready');
    expect(metadata.tool_name).toBe('export_pdf');
    expect(metadata.tool_origin).toBe('auto_planner');
    expect(metadata.auto_tool_merged).toBe(true);
    expect(metadata.tool_result?.success).toBe(true);
    expect(metadata.pdf_artifact?.storagePath).toBe('org/worksheet.pdf');
  });

  it('keeps one assistant turn when appended after the user message', () => {
    const merged = mergeAutoToolExecutionIntoResponse(baseResponse, pdfExecution);
    const withUser: DashMessage[] = [
      {
        id: 'user-1',
        type: 'user',
        content: 'Generate a PDF',
        timestamp: 0,
        metadata: { turn_id: 'turn-1' },
      },
    ];
    const ordered = appendAssistantMessageByTurn(withUser, merged);

    expect(ordered).toHaveLength(2);
    expect(ordered[0].type).toBe('user');
    expect(ordered[1].type).toBe('assistant');
    expect(ordered[1].metadata?.tool_name).toBe('export_pdf');
  });
});
