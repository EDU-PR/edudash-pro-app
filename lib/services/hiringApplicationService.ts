/**
 * Hiring Hub — Applications, Candidates, Interviews & Offers.
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type {
  JobApplication,
  CandidateProfile,
  InterviewSchedule,
  OfferLetter,
  CreateCandidateProfileRequest,
  SubmitApplicationRequest,
  ReviewApplicationRequest,
  ScheduleInterviewRequest,
  GenerateOfferRequest,
  RespondToOfferRequest,
  ApplicationWithDetails,
} from '@/types/hiring';
import { ApplicationStatus } from '@/types/hiring';

import { getResumeUrl } from './hiringJobService';
import {
  notifyApplicationStageChange,
  onboardAcceptedCandidateAsTeacher,
  mapApplicationWithDetails,
  isUsersTablePermissionError,
  getApplicationsForSchoolWithoutCandidateJoin,
} from './hiringApplicationHelpers';

type ApplicationStageNotificationMetadata = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Candidate profiles
// ---------------------------------------------------------------------------

export async function createOrGetCandidateProfile(data: CreateCandidateProfileRequest): Promise<CandidateProfile> {
  const supabase = assertSupabase();
  const { data: existing, error: fetchError } = await supabase
    .from('candidate_profiles')
    .select('*')
    .eq('email', data.email.toLowerCase())
    .single();

  if (existing && !fetchError) return existing;

  const { data: newProfile, error: createError } = await supabase
    .from('candidate_profiles')
    .insert({
      email: data.email.toLowerCase(),
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone || null,
      location: data.location || null,
      experience_years: data.experience_years,
      qualifications: data.qualifications || [],
      skills: data.skills || [],
    })
    .select()
    .single();

  if (createError) {
    logger.error('HiringHub', 'Error creating candidate profile', createError);
    throw new Error(`Failed to create candidate profile: ${createError.message}`);
  }
  return newProfile;
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export async function submitApplication(data: SubmitApplicationRequest, resumeFilePath?: string): Promise<JobApplication> {
  const supabase = assertSupabase();
  const { data: application, error } = await supabase
    .from('job_applications')
    .insert({
      job_posting_id: data.job_posting_id,
      candidate_profile_id: data.candidate_profile_id,
      cover_letter: data.cover_letter || null,
      resume_file_path: resumeFilePath || null,
      status: ApplicationStatus.NEW,
    })
    .select()
    .single();

  if (error) {
    logger.error('HiringHub', 'Error submitting application', error);
    throw new Error(`Failed to submit application: ${error.message}`);
  }
  return application;
}

export async function getApplicationsForJob(jobPostingId: string): Promise<ApplicationWithDetails[]> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('job_applications')
    .select(`*, candidate_profile:candidate_profiles(*)`)
    .eq('job_posting_id', jobPostingId)
    .order('applied_at', { ascending: false });

  if (error) {
    logger.error('HiringHub', 'Error fetching applications', error);
    throw new Error(`Failed to fetch applications: ${error.message}`);
  }
  return (data || []).map((a: Record<string, unknown>) => mapApplicationWithDetails(a));
}

export async function getApplicationsForSchool(preschoolId: string): Promise<ApplicationWithDetails[]> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('job_applications')
    .select(`*, candidate_profile:candidate_profiles(*), job_posting:job_postings!inner(*)`)
    .eq('job_posting.preschool_id', preschoolId)
    .order('applied_at', { ascending: false });

  if (error) {
    if (isUsersTablePermissionError(error)) {
      logger.warn('HiringHub', 'Falling back to query without candidate_profiles join');
      return getApplicationsForSchoolWithoutCandidateJoin(preschoolId);
    }
    logger.error('HiringHub', 'Error fetching school applications', error);
    throw new Error(`Failed to fetch applications: ${error.message}`);
  }
  return (data || []).map((a: Record<string, unknown>) => mapApplicationWithDetails(a));
}

export async function reviewApplication(data: ReviewApplicationRequest, reviewedBy: string): Promise<JobApplication> {
  return updateApplicationStatus(data.application_id, data.status, reviewedBy, data.notes);
}

export async function getApplicationById(id: string): Promise<ApplicationWithDetails | null> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('job_applications')
    .select(`*, candidate_profile:candidate_profiles(*), job_posting:job_postings(*)`)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    if (isUsersTablePermissionError(error)) {
      const { data: fb, error: fbErr } = await supabase
        .from('job_applications')
        .select(`*, job_posting:job_postings(*)`)
        .eq('id', id)
        .single();
      if (fbErr) {
        if (fbErr.code === 'PGRST116') return null;
        logger.error('HiringHub', 'Error fetching application (fallback)', fbErr);
        throw new Error(`Failed to fetch application: ${fbErr.message}`);
      }
      const mapped = mapApplicationWithDetails(fb as Record<string, unknown>);
      return { ...mapped, resume_url: mapped.resume_file_path ? await getResumeUrl(mapped.resume_file_path) : undefined, created_at: mapped.applied_at } as ApplicationWithDetails;
    }
    logger.error('HiringHub', 'Error fetching application', error);
    throw new Error(`Failed to fetch application: ${error.message}`);
  }
  const mapped = mapApplicationWithDetails(data as Record<string, unknown>);
  return { ...mapped, resume_url: data.resume_file_path ? await getResumeUrl(data.resume_file_path) : undefined, created_at: data.applied_at } as ApplicationWithDetails;
}

export async function updateApplicationStatus(
  applicationId: string,
  newStatus: ApplicationStatus,
  reviewedBy: string,
  notes?: string,
  notificationMetadata?: ApplicationStageNotificationMetadata,
): Promise<JobApplication> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('job_applications')
    .update({ status: newStatus, notes: notes || null, reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) {
    logger.error('HiringHub', 'Error updating application status', error);
    throw new Error(`Failed to update application status: ${error.message}`);
  }

  const meta: ApplicationStageNotificationMetadata = { ...(notificationMetadata || {}) };
  if (newStatus === ApplicationStatus.REJECTED && notes) meta.rejection_reason = notes;
  await notifyApplicationStageChange(applicationId, newStatus, Object.keys(meta).length > 0 ? meta : undefined);
  return data;
}

// ---------------------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------------------

export async function scheduleInterview(data: ScheduleInterviewRequest, scheduledBy: string): Promise<InterviewSchedule> {
  const supabase = assertSupabase();
  const { data: interview, error } = await supabase
    .from('interview_schedules')
    .insert({
      application_id: data.application_id,
      scheduled_by: scheduledBy,
      interview_date: data.interview_date,
      interview_time: data.interview_time,
      meeting_link: data.meeting_link || null,
      location: data.location || null,
      notes: data.notes || null,
      status: 'scheduled',
    })
    .select()
    .single();

  if (error) {
    logger.error('HiringHub', 'Error scheduling interview', error);
    throw new Error(`Failed to schedule interview: ${error.message}`);
  }

  await updateApplicationStatus(data.application_id, ApplicationStatus.INTERVIEW_SCHEDULED, scheduledBy, undefined, {
    interview_date: data.interview_date,
    interview_time: data.interview_time,
    meeting_link: data.meeting_link || null,
    location: data.location || null,
  });
  return interview;
}

export async function getInterviewsForApplication(applicationId: string): Promise<InterviewSchedule[]> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('interview_schedules')
    .select('*')
    .eq('application_id', applicationId)
    .order('interview_date', { ascending: true });

  if (error) {
    logger.error('HiringHub', 'Error fetching interviews', error);
    throw new Error(`Failed to fetch interviews: ${error.message}`);
  }
  return data || [];
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export async function generateOffer(data: GenerateOfferRequest, generatedBy: string): Promise<OfferLetter> {
  const supabase = assertSupabase();
  const { data: offer, error } = await supabase
    .from('offer_letters')
    .insert({
      application_id: data.application_id,
      salary_offered: data.salary_offered,
      start_date: data.start_date,
      employment_type: data.employment_type,
      terms: data.terms || {},
      generated_by: generatedBy,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    logger.error('HiringHub', 'Error generating offer', error);
    throw new Error(`Failed to generate offer: ${error.message}`);
  }

  await updateApplicationStatus(data.application_id, ApplicationStatus.OFFERED, generatedBy, undefined, {
    salary_offered: data.salary_offered,
    start_date: data.start_date,
    employment_type: data.employment_type,
  });
  return offer;
}

export async function respondToOffer(data: RespondToOfferRequest): Promise<OfferLetter> {
  const supabase = assertSupabase();
  const updateData: Record<string, unknown> = {
    status: data.accepted ? 'accepted' : 'declined',
  };
  if (data.accepted) updateData.accepted_at = new Date().toISOString();
  else updateData.declined_at = new Date().toISOString();

  const { data: offer, error } = await supabase
    .from('offer_letters')
    .update(updateData)
    .eq('id', data.offer_id)
    .select()
    .single();

  if (error) {
    logger.error('HiringHub', 'Error responding to offer', error);
    throw new Error(`Failed to respond to offer: ${error.message}`);
  }

  if (data.accepted && offer) {
    const { data: offerApp } = await supabase
      .from('offer_letters')
      .select('application_id')
      .eq('id', data.offer_id)
      .single();

    if (offerApp) {
      await supabase.from('job_applications').update({ status: ApplicationStatus.ACCEPTED }).eq('id', offerApp.application_id);
      await notifyApplicationStageChange(offerApp.application_id, ApplicationStatus.ACCEPTED, { offer_response: 'accepted' });
      await onboardAcceptedCandidateAsTeacher(
        offerApp.application_id,
        (offer as any)?.generated_by || null,
      );
    }
  }
  return offer;
}

export async function getOfferForApplication(applicationId: string): Promise<OfferLetter | null> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('offer_letters')
    .select('*')
    .eq('application_id', applicationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('HiringHub', 'Error fetching offer', error);
    throw new Error(`Failed to fetch offer: ${error.message}`);
  }
  return data;
}
