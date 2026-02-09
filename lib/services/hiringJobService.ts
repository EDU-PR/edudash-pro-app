/**
 * Hiring Hub — Job Postings, Stats, Distribution & Resume storage.
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type {
  JobPosting,
  CreateJobPostingRequest,
  UpdateJobPostingRequest,
  HiringHubStats,
} from '@/types/hiring';
import { ApplicationStatus, JobPostingStatus } from '@/types/hiring';

// ---------------------------------------------------------------------------
// Job Postings CRUD
// ---------------------------------------------------------------------------

export async function createJobPosting(
  data: CreateJobPostingRequest,
  createdBy: string,
): Promise<JobPosting> {
  const supabase = assertSupabase();
  const { data: jobPosting, error } = await supabase
    .from('job_postings')
    .insert({
      preschool_id: data.preschool_id,
      title: data.title,
      description: data.description,
      requirements: data.requirements || null,
      logo_url: data.logo_url || null,
      salary_range_min: data.salary_range_min || null,
      salary_range_max: data.salary_range_max || null,
      location: data.location || null,
      employment_type: data.employment_type,
      status: data.status || JobPostingStatus.ACTIVE,
      expires_at: data.expires_at || null,
      age_group: data.age_group || null,
      whatsapp_number: data.whatsapp_number || null,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    logger.error('HiringHub', 'Error creating job posting', error);
    throw new Error(`Failed to create job posting: ${error.message}`);
  }
  return jobPosting;
}

export async function getJobPostings(preschoolId: string): Promise<JobPosting[]> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('preschool_id', preschoolId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('HiringHub', 'Error fetching job postings', error);
    throw new Error(`Failed to fetch job postings: ${error.message}`);
  }
  return data || [];
}

export async function getJobPostingById(id: string): Promise<JobPosting | null> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('HiringHub', 'Error fetching job posting', error);
    throw new Error(`Failed to fetch job posting: ${error.message}`);
  }
  return data;
}

export async function updateJobPosting(
  id: string,
  updates: UpdateJobPostingRequest,
): Promise<JobPosting> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('job_postings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('HiringHub', 'Error updating job posting', error);
    throw new Error(`Failed to update job posting: ${error.message}`);
  }
  return data;
}

export async function deleteJobPosting(id: string): Promise<void> {
  const supabase = assertSupabase();
  const { error } = await supabase.from('job_postings').delete().eq('id', id);

  if (error) {
    logger.error('HiringHub', 'Error deleting job posting', error);
    throw new Error(`Failed to delete job posting: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export async function getHiringHubStats(preschoolId: string): Promise<HiringHubStats> {
  const supabase = assertSupabase();

  try {
    const { count: totalPostings } = await supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })
      .eq('preschool_id', preschoolId);

    const { count: activePostings } = await supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })
      .eq('preschool_id', preschoolId)
      .eq('status', 'active');

    const { data: applications } = await supabase
      .from('job_applications')
      .select('status, job_posting:job_postings!inner(preschool_id)')
      .eq('job_posting.preschool_id', preschoolId);

    const totalApplications = applications?.length || 0;
    const pendingReviews = applications?.filter((a: Record<string, unknown>) => a.status === ApplicationStatus.NEW).length || 0;
    const shortlisted = applications?.filter((a: Record<string, unknown>) => a.status === ApplicationStatus.SHORTLISTED).length || 0;
    const interviewScheduled = applications?.filter((a: Record<string, unknown>) => a.status === ApplicationStatus.INTERVIEW_SCHEDULED).length || 0;

    const { data: offers } = await supabase
      .from('offer_letters')
      .select('status, application:job_applications!inner(job_posting:job_postings!inner(preschool_id))')
      .eq('status', 'pending');

    const pendingOffers = offers?.filter(
      (o: Record<string, unknown>) => (o.application as Record<string, unknown>)?.job_posting && ((o.application as Record<string, unknown>).job_posting as Record<string, unknown>)?.preschool_id === preschoolId,
    ).length || 0;

    return {
      total_job_postings: totalPostings || 0,
      active_job_postings: activePostings || 0,
      total_applications: totalApplications,
      pending_reviews: pendingReviews,
      shortlisted_candidates: shortlisted,
      scheduled_interviews: interviewScheduled,
      pending_offers: pendingOffers,
    };
  } catch (err) {
    logger.error('HiringHub', 'Error fetching hiring hub stats', err);
    return {
      total_job_postings: 0, active_job_postings: 0, total_applications: 0,
      pending_reviews: 0, shortlisted_candidates: 0, scheduled_interviews: 0,
      pending_offers: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Distribution tracking
// ---------------------------------------------------------------------------

export async function trackJobDistribution(data: {
  job_posting_id: string;
  channel: 'whatsapp' | 'email' | 'sms' | 'social_media' | 'public_board';
  distributed_by: string;
  recipients_count?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = assertSupabase();
  const { error } = await supabase.from('job_distributions').insert({
    job_posting_id: data.job_posting_id,
    channel: data.channel,
    distributed_by: data.distributed_by,
    recipients_count: data.recipients_count || 0,
    metadata: data.metadata || {},
  });
  if (error) {
    logger.error('HiringHub', 'Error tracking job distribution', error);
  }
}

// ---------------------------------------------------------------------------
// Resume storage
// ---------------------------------------------------------------------------

export async function uploadResume(
  file: File | Blob,
  candidateEmail: string,
  originalFilename: string,
): Promise<string> {
  const supabase = assertSupabase();
  const { data: filename, error: filenameError } = await supabase.rpc('generate_resume_filename', {
    candidate_email: candidateEmail,
    original_filename: originalFilename,
  });
  if (filenameError) {
    logger.error('HiringHub', 'Error generating filename', filenameError);
    throw new Error('Failed to generate filename');
  }
  const filePath = filename as string;
  const { error: uploadError } = await supabase.storage
    .from('candidate-resumes')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });
  if (uploadError) {
    logger.error('HiringHub', 'Error uploading resume', uploadError);
    throw new Error(`Failed to upload resume: ${uploadError.message}`);
  }
  return filePath;
}

export async function getResumeUrl(filePath: string): Promise<string> {
  const supabase = assertSupabase();
  const { data } = supabase.storage.from('candidate-resumes').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function downloadResume(filePath: string): Promise<Blob> {
  const supabase = assertSupabase();
  const { data, error } = await supabase.storage.from('candidate-resumes').download(filePath);
  if (error) {
    logger.error('HiringHub', 'Error downloading resume', error);
    throw new Error(`Failed to download resume: ${error.message}`);
  }
  return data;
}
