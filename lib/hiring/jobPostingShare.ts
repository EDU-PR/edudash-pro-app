import type { EmploymentType } from '@/types/hiring';

export type ShareableJobPosting = {
  id: string;
  title?: string | null;
  description?: string | null;
  requirements?: string | null;
  location?: string | null;
  employment_type?: EmploymentType | string | null;
  salary_range_min?: number | null;
  salary_range_max?: number | null;
};

export type ShareSchoolInfo = {
  name?: string | null;
  city?: string | null;
  province?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
};

export type WhatsAppMessageVariant = 'short' | 'detailed';

function normalizeText(value?: string | null) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncate(value: string, max = 220) {
  const v = normalizeText(value);
  if (!v) return '';
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1).trimEnd()}…`;
}

export function formatEmploymentType(raw?: string | null): string {
  const value = String(raw || '').toLowerCase();
  if (value === 'full_time' || value === 'full-time') return 'Full-Time';
  if (value === 'part_time' || value === 'part-time') return 'Part-Time';
  if (value === 'contract') return 'Contract';
  if (value === 'temporary') return 'Temporary';
  return 'Employment Type TBA';
}

export function formatSalaryRange(min?: number | null, max?: number | null): string {
  if (typeof min === 'number' && typeof max === 'number' && min > 0 && max > 0) {
    return `R${min} - R${max}`;
  }
  if (typeof min === 'number' && min > 0) return `From R${min}`;
  return 'Negotiable';
}

export function buildApplyLink(params: { baseUrl: string; jobId: string }) {
  const trimmed = params.baseUrl.replace(/\/+$/, '');
  return `${trimmed}/apply/${encodeURIComponent(params.jobId)}?utm_source=whatsapp&utm_medium=share&utm_campaign=hiring`;
}

export function buildWhatsAppMessage(params: {
  variant: WhatsAppMessageVariant;
  baseUrl: string;
  job: ShareableJobPosting;
  school?: ShareSchoolInfo | null;
}): string {
  const schoolName = normalizeText(params.school?.name);
  const schoolLocation = [normalizeText(params.school?.city), normalizeText(params.school?.province)]
    .filter(Boolean)
    .join(', ');

  const jobTitle = normalizeText(params.job.title) || 'Teaching Opportunity';
  const jobLocation = normalizeText(params.job.location) || 'Location TBA';
  const employmentType = formatEmploymentType(params.job.employment_type ? String(params.job.employment_type) : null);
  const salaryRange = formatSalaryRange(params.job.salary_range_min ?? null, params.job.salary_range_max ?? null);
  const applyLink = buildApplyLink({ baseUrl: params.baseUrl, jobId: params.job.id });

  if (params.variant === 'short') {
    const headline = schoolName
      ? `🎓 *${jobTitle}* at *${schoolName}*`
      : `🎓 *${jobTitle}*`;
    const loc = schoolLocation || jobLocation;
    return (
      `${headline}\n` +
      `🕒 ${employmentType}  |  📍 ${loc}\n` +
      `💰 ${salaryRange}\n\n` +
      `📝 Apply online (no account required): ${applyLink}\n\n` +
      `Posted via EduDash Pro Hiring Hub`
    );
  }

  const descriptionSnippet = truncate(params.job.description || '', 240);
  const requirementsSnippet = truncate(params.job.requirements || '', 220);

  const lines: string[] = [];
  lines.push('🎓 *New Teaching Opportunity!*');
  lines.push('');
  if (schoolName) {
    lines.push(`*School:* ${schoolName}`);
  }
  if (schoolLocation) {
    lines.push(`*School Location:* ${schoolLocation}`);
  }
  lines.push(`*Role:* ${jobTitle}`);
  lines.push(`*Type:* ${employmentType}`);
  lines.push(`*Location:* ${jobLocation}`);
  lines.push(`*Salary:* ${salaryRange}`);
  lines.push('');
  if (descriptionSnippet) {
    lines.push(`*About:* ${descriptionSnippet}`);
    lines.push('');
  }
  if (requirementsSnippet) {
    lines.push(`*Requirements:* ${requirementsSnippet}`);
    lines.push('');
  }
  lines.push(`📝 *Apply online (no account required):* ${applyLink}`);
  lines.push('');
  lines.push('Posted via EduDash Pro Hiring Hub');

  return lines.join('\n');
}

