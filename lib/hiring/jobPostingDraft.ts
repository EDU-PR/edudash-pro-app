import { storage } from '@/lib/storage';
import type { EmploymentType } from '@/types/hiring';

export const JOB_POSTING_DRAFT_VERSION = 1 as const;

export type JobPostingDraftV1 = {
  version: 1;
  updated_at: string; // ISO
  preschool_id: string;
  user_id: string;

  title: string;
  description: string;
  requirements: string;
  salary_min: string;
  salary_max: string;
  location: string;
  employment_type: EmploymentType;
  expires_at: string;
  job_logo_url: string | null;
};

export function buildJobPostingDraftKey(params: { preschoolId: string; userId: string }) {
  return `job_posting_draft:v${JOB_POSTING_DRAFT_VERSION}:${params.preschoolId}:${params.userId}`;
}

export function isMeaningfulDraft(draft: Pick<JobPostingDraftV1, 'title' | 'description' | 'requirements' | 'salary_min' | 'salary_max' | 'location'>) {
  return Boolean(
    draft.title.trim() ||
      draft.description.trim() ||
      draft.requirements.trim() ||
      draft.salary_min.trim() ||
      draft.salary_max.trim() ||
      draft.location.trim()
  );
}

export async function loadJobPostingDraft(params: { preschoolId: string; userId: string }): Promise<JobPostingDraftV1 | null> {
  const key = buildJobPostingDraftKey(params);
  const raw = await storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<JobPostingDraftV1>;
    if (parsed.version !== JOB_POSTING_DRAFT_VERSION) return null;
    if (!parsed.updated_at || !parsed.preschool_id || !parsed.user_id) return null;
    return parsed as JobPostingDraftV1;
  } catch {
    return null;
  }
}

export async function saveJobPostingDraft(draft: JobPostingDraftV1): Promise<void> {
  const key = buildJobPostingDraftKey({ preschoolId: draft.preschool_id, userId: draft.user_id });
  await storage.setItem(key, JSON.stringify(draft));
}

export async function clearJobPostingDraft(params: { preschoolId: string; userId: string }): Promise<void> {
  const key = buildJobPostingDraftKey(params);
  await storage.removeItem(key);
}

