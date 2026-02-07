import { assertSupabase } from '@/lib/supabase';

export type JobPostingAISuggestions = {
  suggested_title?: string;
  description: string;
  requirements: string;
  highlights?: string[];
  whatsapp_short?: string;
  whatsapp_long?: string;
};

function coerceString(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, '').replace(/\t/g, ' ').replace(/[ ]{2,}/g, ' ').trim();
}

function toBulletList(value: string): string {
  const cleaned = value
    .split('\n')
    .map((line) => line.replace(/^[\s•*-]+/, '').trim())
    .filter(Boolean);

  if (!cleaned.length) return '';
  return cleaned.map((line) => `- ${line}`).join('\n');
}

function ensureSentence(value: string): string {
  const text = normalizeWhitespace(value);
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function isSuggestionShape(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  const description = value?.description;
  const requirements = value?.requirements;
  return typeof description === 'string' || typeof requirements === 'string';
}

function candidateToString(candidate: unknown): string {
  if (typeof candidate === 'string') return candidate;

  if (Array.isArray(candidate)) {
    const joined = candidate
      .map((entry: any) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry.text === 'string') return entry.text;
        if (entry && typeof entry.content === 'string') return entry.content;
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
    return joined;
  }

  if (candidate && typeof candidate === 'object') {
    if (isSuggestionShape(candidate)) {
      try {
        return JSON.stringify(candidate);
      } catch {
        return '';
      }
    }

    const direct = (candidate as any).text || (candidate as any).content || (candidate as any).message;
    if (typeof direct === 'string') return direct;
  }

  return '';
}

function extractContentFromAIResponse(data: any): string {
  if (typeof data === 'string') return data;
  if (isSuggestionShape(data)) {
    try {
      return JSON.stringify(data);
    } catch {
      return '';
    }
  }

  const candidates = [
    data?.content,
    data?.text,
    data?.response,
    data?.message,
    data?.output,
    data?.output_text,
    data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.text,
    data?.content?.[0]?.text,
    data?.result?.content,
    data?.result?.text,
    data?.result?.message,
    data?.data?.content,
    data?.data?.text,
    data?.data,
    data?.result,
  ];

  for (const candidate of candidates) {
    const text = candidateToString(candidate);
    if (text.trim()) {
      return text;
    }
  }

  // Last-resort attempt: stringify object payload if present.
  if (data && typeof data === 'object') {
    try {
      const json = JSON.stringify(data);
      return json === '{}' ? '' : json;
    } catch {
      return '';
    }
  }

  return '';
}

function normalizeJsonCandidate(candidate: string): string {
  return candidate
    .replace(/^\s*json\s*/i, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

function extractJsonCandidates(text: string): string[] {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const candidates: string[] = [];

  // Fenced JSON blocks
  const fencedRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let fencedMatch: RegExpExecArray | null = fencedRegex.exec(raw);
  while (fencedMatch) {
    if (fencedMatch[1]?.trim()) candidates.push(fencedMatch[1].trim());
    fencedMatch = fencedRegex.exec(raw);
  }

  // Full payload as-is (sometimes it's already plain JSON)
  candidates.push(raw);

  // First {...} block
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1).trim());
  }

  return Array.from(new Set(candidates.map((c) => normalizeJsonCandidate(c)).filter(Boolean)));
}

function tryParseJson(text: string): any | null {
  for (const candidate of extractJsonCandidates(text)) {
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }
  return null;
}

function extractLabeledSection(text: string, labels: string[]): string {
  const normalized = text.replace(/\r/g, '\n');
  const labelPattern = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:${labelPattern})\\s*[:\\-]\\s*([\\s\\S]*?)(?=\\n\\s*[A-Za-z][A-Za-z ]{2,40}\\s*[:\\-]|$)`,
    'i'
  );
  const match = normalized.match(regex);
  return coerceString(match?.[1] || '');
}

function buildFallbackSuggestionsFromText(content: string, params: { jobTitle: string; orgType?: string | null }): JobPostingAISuggestions {
  const raw = String(content || '').trim();
  const labeledDescription = extractLabeledSection(raw, ['description', 'about the role', 'role description', 'job description', 'summary']);
  const labeledRequirements = extractLabeledSection(raw, ['requirements', 'minimum requirements', 'must have', 'qualifications']);
  const labeledShort = extractLabeledSection(raw, ['whatsapp short', 'short message', 'short']);
  const labeledLong = extractLabeledSection(raw, ['whatsapp long', 'long message', 'detailed']);

  const description = labeledDescription || ensureSentence(raw.slice(0, 1800));
  const requirementsRaw = labeledRequirements || '';
  const requirements = requirementsRaw
    ? toBulletList(requirementsRaw)
    : [
        `- Relevant qualification or training for ${coerceString(params.jobTitle) || 'this role'}`,
        '- Experience working in an education environment',
        '- Strong communication and teamwork',
        '- Police clearance (or willingness to obtain)',
      ].join('\n');

  const highlights = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-•*]\s+/.test(line))
    .map((line) => line.replace(/^[-•*]\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    description: description || `We are hiring a ${coerceString(params.jobTitle) || 'teacher'} for our ${coerceString(params.orgType) || 'school'}.`,
    requirements,
    highlights: highlights.length ? highlights : undefined,
    whatsapp_short: labeledShort || undefined,
    whatsapp_long: labeledLong || undefined,
  };
}

function normalizeSuggestions(parsed: any): JobPostingAISuggestions | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const description = coerceString(parsed?.description);
  const requirements = coerceString(parsed?.requirements);
  if (!description || !requirements) return null;

  const highlights = Array.isArray(parsed?.highlights)
    ? parsed.highlights.map((v: any) => coerceString(v)).filter(Boolean).slice(0, 6)
    : undefined;

  return {
    suggested_title: coerceString(parsed?.suggested_title) || undefined,
    description,
    requirements,
    highlights: highlights && highlights.length ? highlights : undefined,
    whatsapp_short: coerceString(parsed?.whatsapp_short) || undefined,
    whatsapp_long: coerceString(parsed?.whatsapp_long) || undefined,
  };
}

export class JobPostingAIService {
  static async suggest(params: {
    schoolName?: string | null;
    schoolLocation?: string | null;
    orgType?: 'preschool' | 'school' | 'organization' | string;
    jobTitle: string;
    employmentType?: string | null;
    jobLocation?: string | null;
    salaryRange?: string | null;
    existingDescription?: string | null;
    existingRequirements?: string | null;
  }): Promise<JobPostingAISuggestions> {
    const schoolName = coerceString(params.schoolName) || 'the school';
    const orgType = coerceString(params.orgType) || 'school';
    const schoolLocation = coerceString(params.schoolLocation);

    const prompt = [
      'You are an expert recruiter and HR writer for South African schools (especially preschools/ECD).',
      'Create high-quality hiring content for a job posting.',
      '',
      'OUTPUT FORMAT (important): Return ONLY valid minified JSON (no markdown) with keys:',
      '- suggested_title (string, optional)',
      '- description (string)',
      '- requirements (string)',
      '- highlights (array of 3-6 short strings, optional)',
      '- whatsapp_short (string, optional)',
      '- whatsapp_long (string, optional)',
      '',
      'STYLE:',
      '- Clear, modern, and professional. Warm but not cheesy.',
      '- South Africa context (e.g. ECD, safety, child protection).',
      '- Use short paragraphs and bullet lists (use "-" bullets).',
      '- Do not include any links.',
      '',
      'CONTEXT:',
      `- Organization type: ${orgType}`,
      `- School: ${schoolName}${schoolLocation ? ` (${schoolLocation})` : ''}`,
      `- Role: ${coerceString(params.jobTitle)}`,
      `- Employment type: ${coerceString(params.employmentType) || 'unspecified'}`,
      `- Job location: ${coerceString(params.jobLocation) || 'unspecified'}`,
      `- Salary: ${coerceString(params.salaryRange) || 'Negotiable/unspecified'}`,
      '',
      'EXISTING TEXT (if provided):',
      `- Existing description: ${coerceString(params.existingDescription) || '(none)'}`,
      `- Existing requirements: ${coerceString(params.existingRequirements) || '(none)'}`,
      '',
      'TASK:',
      '1) If existing text is present, improve it (clarity, structure, completeness) without changing meaning.',
      '2) If existing text is missing, draft it from scratch.',
      '3) Provide a WhatsApp short and long message (no links) that we can paste into WhatsApp.',
    ].join('\n');

    const { data, error } = await assertSupabase().functions.invoke('ai-proxy', {
      body: {
        scope: 'principal',
        service_type: 'dash_conversation',
        payload: { prompt },
        stream: false,
        enable_tools: false,
      },
    });

    if (error) {
      throw new Error(error.message || 'AI request failed');
    }

    // Sometimes ai-proxy already returns the structured fields directly.
    const directSuggestions =
      normalizeSuggestions(data) ||
      normalizeSuggestions(data?.data) ||
      normalizeSuggestions(data?.result);
    if (directSuggestions) {
      return directSuggestions;
    }

    const content = extractContentFromAIResponse(data);
    if (!content.trim()) {
      throw new Error('AI returned an empty response. Try again.');
    }

    // Preferred path: strict JSON response
    const parsed = tryParseJson(content);
    const normalized = normalizeSuggestions(parsed);
    if (normalized) {
      return normalized;
    }

    // Fallback path: salvage from non-JSON prose instead of failing hard.
    return buildFallbackSuggestionsFromText(content, {
      jobTitle: params.jobTitle,
      orgType: params.orgType,
    });
  }

  static async polishWhatsAppMessage(params: {
    baseMessage: string;
    schoolName?: string | null;
    jobTitle?: string | null;
  }): Promise<string> {
    const prompt = [
      'Rewrite this WhatsApp hiring message to be more clear, professional, and high-converting.',
      'Keep it concise. Do not add links. Keep emojis minimal.',
      '',
      `School: ${coerceString(params.schoolName) || 'N/A'}`,
      `Role: ${coerceString(params.jobTitle) || 'N/A'}`,
      '',
      'Return ONLY the rewritten message text.',
      '',
      'Message:',
      coerceString(params.baseMessage),
    ].join('\n');

    const { data, error } = await assertSupabase().functions.invoke('ai-proxy', {
      body: {
        scope: 'principal',
        service_type: 'dash_conversation',
        payload: { prompt },
        stream: false,
        enable_tools: false,
      },
    });

    if (error) {
      throw new Error(error.message || 'AI request failed');
    }

    const content = extractContentFromAIResponse(data).trim();
    if (!content) throw new Error('AI returned an empty message');
    return content.replace(/^```(?:text)?\s*/i, '').replace(/```$/i, '').trim();
  }
}
