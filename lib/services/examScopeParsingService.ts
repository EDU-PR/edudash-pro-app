import { assertSupabase } from '@/lib/supabase';

export interface ParseExamScopeInput {
  fileBase64: string;
  mimeType: string;
  fileName?: string;
  grade?: string;
  subject?: string;
}

export interface ParseExamScopeResult {
  success: boolean;
  scopeText: string;
  confidence: number | null;
  lowConfidence: boolean;
  topics: string[];
  issues: string[];
  rawResponse?: string;
}

type ScopePayload = {
  scope_text?: string;
  extracted_text?: string;
  topics?: unknown;
  confidence?: unknown;
  issues?: unknown;
  notes?: unknown;
};

const MAX_SCOPE_TEXT_CHARS = 1800;

function normalizeScopeText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_SCOPE_TEXT_CHARS);
}

function inferConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(2));
}

function normalizeTopics(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, 12);
}

function parseJsonCandidate(candidate: string): ScopePayload | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as ScopePayload;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as ScopePayload;
    } catch {
      return null;
    }
  }
}

function firstIssue(payload: ScopePayload | null): string | null {
  if (!payload) return null;
  if (Array.isArray(payload.issues)) {
    const issue = payload.issues.find((item) => typeof item === 'string' && item.trim().length > 0);
    return typeof issue === 'string' ? issue.trim() : null;
  }
  if (Array.isArray(payload.notes)) {
    const note = payload.notes.find((item) => typeof item === 'string' && item.trim().length > 0);
    return typeof note === 'string' ? note.trim() : null;
  }
  return null;
}

export async function parseExamScopeFromUpload(input: ParseExamScopeInput): Promise<ParseExamScopeResult> {
  const normalizedMime = String(input.mimeType || '').toLowerCase();
  const supported = normalizedMime.startsWith('image/') || normalizedMime === 'application/pdf';
  if (!supported) {
    return {
      success: false,
      scopeText: '',
      confidence: null,
      lowConfidence: true,
      topics: [],
      issues: ['Scope parsing supports image files and PDFs only.'],
    };
  }

  const base64 = String(input.fileBase64 || '').trim();
  if (!base64) {
    return {
      success: false,
      scopeText: '',
      confidence: null,
      lowConfidence: true,
      topics: [],
      issues: ['Could not read file bytes for OCR parsing.'],
    };
  }

  const prompt = [
    'You are extracting a class scope/delimitation document for exam generation.',
    '',
    'Return ONLY valid JSON with this schema:',
    '{"scope_text":"string","topics":["topic1"],"confidence":0.0,"issues":["optional warning"]}',
    '',
    'Rules:',
    '- scope_text: clean text containing syllabus topics, pages, and constraints useful for generating a school exam.',
    '- topics: short bullet-style topic labels derived from the scope.',
    '- confidence: number between 0 and 1.',
    '- issues: optional array with uncertainty warnings.',
    '- Keep scope_text concise and factual (no markdown, no extra commentary).',
    `- Grade context: ${input.grade || 'unknown'}`,
    `- Subject context: ${input.subject || 'unknown'}`,
  ].join('\n');

  try {
    const supabase = assertSupabase();
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body: {
        service_type: 'image_analysis',
        payload: {
          prompt,
          images: [{ data: base64, media_type: normalizedMime || 'image/jpeg' }],
          ocr_mode: true,
          ocr_task: 'document',
          ocr_response_format: 'json',
        },
        stream: false,
        enable_tools: false,
        metadata: {
          source: 'exam_scope_parser',
          file_name: input.fileName || null,
          grade: input.grade || null,
          subject: input.subject || null,
        },
      },
    });

    if (error) {
      return {
        success: false,
        scopeText: '',
        confidence: null,
        lowConfidence: true,
        topics: [],
        issues: [error.message || 'Scope OCR parsing failed.'],
      };
    }

    const payload = (data || {}) as {
      content?: string;
      analysis?: string;
      extracted_text?: string;
      ocr?: {
        analysis?: string;
        extracted_text?: string;
        confidence?: number;
      };
    };

    const textCandidates = [
      typeof payload.content === 'string' ? payload.content : null,
      typeof payload.ocr?.analysis === 'string' ? payload.ocr.analysis : null,
      typeof payload.ocr?.extracted_text === 'string' ? payload.ocr.extracted_text : null,
      typeof payload.analysis === 'string' ? payload.analysis : null,
      typeof payload.extracted_text === 'string' ? payload.extracted_text : null,
      payload.ocr ? JSON.stringify(payload.ocr) : null,
      JSON.stringify(data || {}),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    let parsedPayload: ScopePayload | null = null;
    let rawResponse = '';
    for (const candidate of textCandidates) {
      const parsed = parseJsonCandidate(candidate);
      if (parsed) {
        parsedPayload = parsed;
        rawResponse = candidate;
        break;
      }
    }

    const rawScope = parsedPayload?.scope_text || parsedPayload?.extracted_text || payload.ocr?.analysis || payload.ocr?.extracted_text || payload.analysis || payload.extracted_text || '';
    const scopeText = normalizeScopeText(rawScope);
    const topics = normalizeTopics(parsedPayload?.topics);
    const parsedConfidence = inferConfidence(parsedPayload?.confidence);
    const confidence = parsedConfidence ?? inferConfidence(payload.ocr?.confidence ?? null);
    const lowConfidence = confidence !== null ? confidence < 0.65 : false;

    const issues: string[] = [];
    const payloadIssue = firstIssue(parsedPayload);
    if (payloadIssue) issues.push(payloadIssue);
    if (!scopeText) issues.push('OCR parsing returned no usable scope text.');
    if (lowConfidence) {
      issues.push('OCR confidence is low. Review and correct extracted scope text before generating.');
    }

    return {
      success: scopeText.length > 0,
      scopeText,
      confidence,
      lowConfidence,
      topics,
      issues,
      rawResponse,
    };
  } catch (error) {
    return {
      success: false,
      scopeText: '',
      confidence: null,
      lowConfidence: true,
      topics: [],
      issues: [error instanceof Error ? error.message : 'Scope OCR parsing failed unexpectedly.'],
    };
  }
}
