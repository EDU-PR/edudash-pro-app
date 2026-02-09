/**
 * HiringHubService — facade class for backward compatibility.
 *
 * Logic has been split into:
 *   - hiringJobService.ts    (job CRUD, stats, distribution, resume)
 *   - hiringApplicationService.ts (candidates, applications, interviews, offers)
 */

import * as jobs from './hiringJobService';
import * as apps from './hiringApplicationService';

import type {
  JobPosting,
  JobApplication,
  CandidateProfile,
  InterviewSchedule,
  OfferLetter,
  CreateJobPostingRequest,
  UpdateJobPostingRequest,
  CreateCandidateProfileRequest,
  SubmitApplicationRequest,
  ReviewApplicationRequest,
  ScheduleInterviewRequest,
  GenerateOfferRequest,
  RespondToOfferRequest,
  HiringHubStats,
  ApplicationWithDetails,
} from '@/types/hiring';

export class HiringHubService {
  // Job postings
  static createJobPosting(data: CreateJobPostingRequest, createdBy: string): Promise<JobPosting> { return jobs.createJobPosting(data, createdBy); }
  static getJobPostings(preschoolId: string): Promise<JobPosting[]> { return jobs.getJobPostings(preschoolId); }
  static getJobPostingById(id: string): Promise<JobPosting | null> { return jobs.getJobPostingById(id); }
  static updateJobPosting(id: string, updates: UpdateJobPostingRequest): Promise<JobPosting> { return jobs.updateJobPosting(id, updates); }
  static deleteJobPosting(id: string): Promise<void> { return jobs.deleteJobPosting(id); }

  // Candidates
  static createOrGetCandidateProfile(data: CreateCandidateProfileRequest): Promise<CandidateProfile> { return apps.createOrGetCandidateProfile(data); }

  // Applications
  static submitApplication(data: SubmitApplicationRequest, resumeFilePath?: string): Promise<JobApplication> { return apps.submitApplication(data, resumeFilePath); }
  static getApplicationsForJob(jobPostingId: string): Promise<ApplicationWithDetails[]> { return apps.getApplicationsForJob(jobPostingId); }
  static getApplicationsForSchool(preschoolId: string): Promise<ApplicationWithDetails[]> { return apps.getApplicationsForSchool(preschoolId); }
  static reviewApplication(data: ReviewApplicationRequest, reviewedBy: string): Promise<JobApplication> { return apps.reviewApplication(data, reviewedBy); }
  static getApplicationById(id: string): Promise<ApplicationWithDetails | null> { return apps.getApplicationById(id); }
  static updateApplicationStatus(...args: Parameters<typeof apps.updateApplicationStatus>): Promise<JobApplication> { return apps.updateApplicationStatus(...args); }

  // Interviews
  static scheduleInterview(data: ScheduleInterviewRequest, scheduledBy: string): Promise<InterviewSchedule> { return apps.scheduleInterview(data, scheduledBy); }
  static getInterviewsForApplication(applicationId: string): Promise<InterviewSchedule[]> { return apps.getInterviewsForApplication(applicationId); }

  // Offers
  static generateOffer(data: GenerateOfferRequest, generatedBy: string): Promise<OfferLetter> { return apps.generateOffer(data, generatedBy); }
  static respondToOffer(data: RespondToOfferRequest): Promise<OfferLetter> { return apps.respondToOffer(data); }
  static getOfferForApplication(applicationId: string): Promise<OfferLetter | null> { return apps.getOfferForApplication(applicationId); }

  // Stats & distribution
  static getHiringHubStats(preschoolId: string): Promise<HiringHubStats> { return jobs.getHiringHubStats(preschoolId); }
  static trackJobDistribution(...args: Parameters<typeof jobs.trackJobDistribution>): Promise<void> { return jobs.trackJobDistribution(...args); }

  // Storage
  static uploadResume(file: File | Blob, candidateEmail: string, originalFilename: string): Promise<string> { return jobs.uploadResume(file, candidateEmail, originalFilename); }
  static getResumeUrl(filePath: string): Promise<string> { return jobs.getResumeUrl(filePath); }
  static downloadResume(filePath: string): Promise<Blob> { return jobs.downloadResume(filePath); }
}

export default HiringHubService;
