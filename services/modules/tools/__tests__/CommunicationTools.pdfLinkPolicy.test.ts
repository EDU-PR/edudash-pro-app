import { registerCommunicationTools } from '@/services/modules/tools/CommunicationTools';
import type { AgentTool } from '@/services/modules/DashToolRegistry';

const createSignedUrlMock = jest.fn();
const generateFromStructuredDataMock = jest.fn();

jest.mock('@/services/DashPDFGenerator', () => ({
  getDashPDFGenerator: () => ({
    generateFromStructuredData: (...args: any[]) => generateFromStructuredDataMock(...args),
  }),
}));

jest.mock('@/lib/supabase', () => ({
  assertSupabase: () => ({
    storage: {
      from: () => ({
        createSignedUrl: (...args: any[]) => createSignedUrlMock(...args),
      }),
    },
  }),
}));

jest.mock('@/services/dash-ai/DashAICompat', () => ({
  DashAIAssistant: {
    getInstance: () => ({
      getCurrentConversationId: () => null,
    }),
  },
}));

function getExportPdfTool(): AgentTool {
  const tools: AgentTool[] = [];
  registerCommunicationTools((tool) => tools.push(tool));
  const target = tools.find((tool) => tool.name === 'export_pdf');
  if (!target) {
    throw new Error('export_pdf tool not registered');
  }
  return target;
}

describe('CommunicationTools generated PDF link policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns signed link when signed URL creation succeeds', async () => {
    const tool = getExportPdfTool();
    generateFromStructuredDataMock.mockResolvedValue({
      success: true,
      filename: 'doc.pdf',
      storagePath: 'org-1/doc.pdf',
      uri: 'file:///tmp/doc.pdf',
    });
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: 'https://example.com/storage/v1/object/sign/generated-pdfs/org-1/doc.pdf?token=abc' },
      error: null,
    });

    const result = await tool.execute({ title: 'Doc', content: 'Body' });

    expect(result.success).toBe(true);
    expect(result.linkType).toBe('signed');
    expect(result.signedUrl).toContain('/object/sign/generated-pdfs/');
    expect(result.downloadUrl).toBe(result.signedUrl);
    expect(result.warningReason).toBeUndefined();
    expect(result).not.toHaveProperty('publicUrl');
  });

  it('falls back to local link when signed URL fails and local URI exists', async () => {
    const tool = getExportPdfTool();
    generateFromStructuredDataMock.mockResolvedValue({
      success: true,
      filename: 'doc.pdf',
      storagePath: 'org-1/doc.pdf',
      uri: 'file:///tmp/doc.pdf',
    });
    createSignedUrlMock.mockResolvedValue({
      data: null,
      error: { message: 'signed URL failed' },
    });

    const result = await tool.execute({ title: 'Doc', content: 'Body' });

    expect(result.success).toBe(true);
    expect(result.linkType).toBe('local');
    expect(result.downloadUrl).toBe('file:///tmp/doc.pdf');
    expect(result.warningReason).toBe('signed_url_failed');
    expect(result).not.toHaveProperty('publicUrl');
  });

  it('returns local with explicit warning when storagePath is missing', async () => {
    const tool = getExportPdfTool();
    generateFromStructuredDataMock.mockResolvedValue({
      success: true,
      filename: 'doc.pdf',
      storagePath: '',
      uri: 'file:///tmp/doc.pdf',
    });

    const result = await tool.execute({ title: 'Doc', content: 'Body' });

    expect(result.success).toBe(true);
    expect(result.linkType).toBe('local');
    expect(result.downloadUrl).toBe('file:///tmp/doc.pdf');
    expect(result.warningReason).toBe('no_storage_path');
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });

  it('returns none when neither storagePath nor local fallback is available', async () => {
    const tool = getExportPdfTool();
    generateFromStructuredDataMock.mockResolvedValue({
      success: true,
      filename: 'doc.pdf',
      storagePath: '',
      uri: '',
    });

    const result = await tool.execute({ title: 'Doc', content: 'Body' });

    expect(result.success).toBe(true);
    expect(result.linkType).toBe('none');
    expect(result.downloadUrl).toBeUndefined();
    expect(result.warningReason).toBe('no_storage_path');
  });
});
