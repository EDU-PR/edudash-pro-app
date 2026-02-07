import { assertSupabase } from '@/lib/supabase';

export type JobPostingAISuggestions = {
  suggested_title?: string;
  description: string;
  requirements: string;
  highlights?: string[];
  whatsapp_short?: string;
  whatsapp_long?: string;
};

function extractJsonCandidate(text: string): string | null {
  const raw = String(text || '').trim();
  if (!raw) return null;

  // Try fenced json first
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  // Fallback: first {...} block
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  return null;
}

function coerceString(value: unknown): string {
  return String(value ?? '').trim();
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

    const content = String(data?.content || '');
    const jsonCandidate = extractJsonCandidate(content) || content;
    let parsed: any;
    try {
      parsed = JSON.parse(jsonCandidate);
    } catch (_e) {
      throw new Error('AI response was not valid JSON. Try again.');
    }

    const description = coerceString(parsed?.description);
    const requirements = coerceString(parsed?.requirements);
    if (!description || !requirements) {
      throw new Error('AI response missing description/requirements. Try again.');
    }

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

    const content = String(data?.content || '').trim();
    if (!content) throw new Error('AI returned an empty message');
    return content;
  }
}

