/**
 * hiringApplicationHelpers — Private helpers for the hiring application service.
 *
 * Extracted per WARP.md ≤500-line limit for services.
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { approveTeacher } from '@/lib/services/teacherApprovalService';
import type { ApplicationWithDetails } from '@/types/hiring';
import { ApplicationStatus, getApplicationStatusLabel } from '@/types/hiring';

type ApplicationStageNotificationMetadata = Record<string, unknown>;

interface ApplicationNotificationDetails {
  jobPostingId: string | null;
  preschoolId: string | null;
  candidateUserId: string | null;
  candidateEmail: string | null;
  candidateName: string;
  jobTitle: string;
}

interface AcceptedApplicationOnboardingContext {
  teacherId: string | null;
  preschoolId: string | null;
}

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------

export function getStageNotificationEvent(status: ApplicationStatus): string | null {
  const eventMap: Partial<Record<ApplicationStatus, string>> = {
    [ApplicationStatus.UNDER_REVIEW]: 'job_application_under_review',
    [ApplicationStatus.SHORTLISTED]: 'job_application_shortlisted',
    [ApplicationStatus.INTERVIEW_SCHEDULED]: 'job_interview_scheduled',
    [ApplicationStatus.OFFERED]: 'job_offer_sent',
    [ApplicationStatus.REJECTED]: 'job_application_rejected',
    [ApplicationStatus.ACCEPTED]: 'job_application_hired',
  };
  return eventMap[status] ?? null;
}

export async function getApplicationNotificationDetails(
  applicationId: string,
): Promise<ApplicationNotificationDetails | null> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('job_applications')
    .select(
      `id, candidate_profile:candidate_profiles(id, user_id, email, first_name, last_name), job_posting:job_postings(id, title, preschool_id)`,
    )
    .eq('id', applicationId)
    .maybeSingle();

  if (error || !data) {
    if (error)
      logger.warn('HiringHub', 'Could not load application notification context', error.message);
    return null;
  }

  const p = Array.isArray(data.candidate_profile)
    ? data.candidate_profile[0]
    : data.candidate_profile;
  const j = Array.isArray(data.job_posting) ? data.job_posting[0] : data.job_posting;
  const fullName = `${p?.first_name || ''} ${p?.last_name || ''}`.trim();

  return {
    jobPostingId: j?.id || null,
    preschoolId: j?.preschool_id || null,
    candidateUserId: p?.user_id || null,
    candidateEmail: p?.email || null,
    candidateName: fullName || 'Applicant',
    jobTitle: j?.title || 'the open position',
  };
}

export async function notifyApplicationStageChange(
  applicationId: string,
  status: ApplicationStatus,
  metadata?: ApplicationStageNotificationMetadata,
): Promise<void> {
  const eventType = getStageNotificationEvent(status);
  if (!eventType) return;

  try {
    const details = await getApplicationNotificationDetails(applicationId);
    if (!details) return;

    const supabase = assertSupabase();
    const payload: Record<string, unknown> = {
      event_type: eventType,
      job_application_id: applicationId,
      job_posting_id: details.jobPostingId || undefined,
      preschool_id: details.preschoolId || undefined,
      include_email: Boolean(details.candidateEmail),
      send_immediately: true,
      custom_payload: {
        candidate_name: details.candidateName,
        job_title: details.jobTitle,
        stage: status,
        stage_label: getApplicationStatusLabel(status),
        ...(metadata || {}),
      },
    };
    if (details.candidateUserId) payload.user_ids = [details.candidateUserId];
    if (details.candidateEmail) payload.recipient_email = details.candidateEmail;

    const { error } = await supabase.functions.invoke('notifications-dispatcher', {
      body: payload,
    });
    if (error) logger.warn('HiringHub', 'Failed to send stage notification', error.message);
  } catch (err) {
    logger.warn('HiringHub', 'Notification dispatch error', err);
  }
}

// ---------------------------------------------------------------------------
// Onboarding helpers
// ---------------------------------------------------------------------------

export async function resolveAcceptedApplicationOnboardingContext(
  applicationId: string,
): Promise<AcceptedApplicationOnboardingContext> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('job_applications')
    .select(
      `
      id,
      candidate_profile:candidate_profiles(user_id),
      job_posting:job_postings(preschool_id)
    `,
    )
    .eq('id', applicationId)
    .maybeSingle();

  if (error || !data) {
    if (error)
      logger.warn(
        'HiringHub',
        'Could not resolve accepted application onboarding context',
        error.message,
      );
    return { teacherId: null, preschoolId: null };
  }

  const candidate = Array.isArray(data.candidate_profile)
    ? data.candidate_profile[0]
    : data.candidate_profile;
  const posting = Array.isArray(data.job_posting) ? data.job_posting[0] : data.job_posting;

  return {
    teacherId: (candidate as any)?.user_id || null,
    preschoolId: (posting as any)?.preschool_id || null,
  };
}

export async function onboardAcceptedCandidateAsTeacher(
  applicationId: string,
  reviewerId?: string | null,
): Promise<void> {
  try {
    const { teacherId, preschoolId } =
      await resolveAcceptedApplicationOnboardingContext(applicationId);
    if (!teacherId || !preschoolId) return;

    const fallbackReviewerId = reviewerId || teacherId;
    const result = await approveTeacher(teacherId, preschoolId, fallbackReviewerId, {
      assignSeat: true,
      notes: 'Auto-approved after hiring offer acceptance',
    });

    if (!result.success) {
      logger.warn(
        'HiringHub',
        'Auto teacher onboarding failed after offer acceptance',
        result.error || result.message,
      );
    }
  } catch (error) {
    logger.warn('HiringHub', 'Auto teacher onboarding warning', error);
  }
}

// ---------------------------------------------------------------------------
// Data mapping helpers
// ---------------------------------------------------------------------------

export function mapApplicationWithDetails(
  app: Record<string, unknown>,
): ApplicationWithDetails {
  const cp = app?.candidate_profile as Record<string, unknown> | undefined;
  const jp = app?.job_posting as Record<string, unknown> | undefined;
  const firstName = typeof cp?.first_name === 'string' ? cp.first_name : '';
  const lastName = typeof cp?.last_name === 'string' ? cp.last_name : '';
  const fullName = `${firstName} ${lastName}`.trim();
  const fallback = (app?.candidate_profile_id as string)
    ? `Candidate ${String(app.candidate_profile_id).slice(0, 6).toUpperCase()}`
    : 'Candidate';

  return {
    ...(app as unknown as ApplicationWithDetails),
    candidate_name: fullName || fallback,
    candidate_email: (cp?.email as string) || '',
    candidate_phone: (cp?.phone as string) || undefined,
    candidate_experience_years: (cp?.experience_years as number) || 0,
    job_title: (jp?.title as string) || 'Unknown Position',
    has_resume: !!app?.resume_file_path,
  };
}

export function isUsersTablePermissionError(error: unknown): boolean {
  const payload =
    error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const text =
    `${payload.message || ''} ${payload.details || ''} ${payload.hint || ''}`.toLowerCase();
  return text.includes('permission denied for table users');
}

export async function getApplicationsForSchoolWithoutCandidateJoin(
  preschoolId: string,
): Promise<ApplicationWithDetails[]> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('job_applications')
    .select(`*, job_posting:job_postings!inner(*)`)
    .eq('job_posting.preschool_id', preschoolId)
    .order('applied_at', { ascending: false });

  if (error) {
    logger.error('HiringHub', 'Error fetching fallback school applications', error);
    throw new Error(`Failed to fetch applications: ${error.message}`);
  }
  return (data || []).map((a: Record<string, unknown>) => mapApplicationWithDetails(a));
}
