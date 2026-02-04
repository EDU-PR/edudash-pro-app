/**
 * Public Job Application Page (Web)
 * Mirrors the mobile apply flow for teachers without the app.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { createClient } from '@/lib/supabase/client';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

type JobPosting = {
  id: string;
  title: string;
  description: string;
  requirements?: string | null;
  location?: string | null;
  employment_type?: string | null;
  salary_range_min?: number | null;
  salary_range_max?: number | null;
  status?: string | null;
  expires_at?: string | null;
  preschool_id?: string | null;
};

type CandidateProfile = {
  id: string;
};

type SchoolInfo = {
  id?: string;
  name: string;
  logoUrl?: string | null;
  city?: string | null;
  province?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
};

export default function ApplyPage() {
  const params = useParams();
  const jobId = Array.isArray(params.job_id) ? params.job_id[0] : params.job_id;
  const supabase = useMemo(() => createClient(), []);
  const { t } = useTranslation('common');

  const [loading, setLoading] = useState(true);
  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!jobId || typeof jobId !== 'string') return;
      setLoading(true);
      setStatusMessage(null);

      const { data, error: fetchError } = await supabase
        .from('job_postings')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();

      if (fetchError || !data) {
        setJobPosting(null);
        setStatusMessage(t('apply.notFoundDesc', { defaultValue: 'This job may have been removed or expired' }));
        setLoading(false);
        return;
      }

      if (data.status && data.status !== 'active') {
        setJobPosting(null);
        setStatusMessage(t('apply.jobNotAvailableDesc', { defaultValue: 'This job posting is no longer active.' }));
        setLoading(false);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setJobPosting(null);
        setStatusMessage(t('apply.jobExpiredDesc', { defaultValue: 'This job posting has expired.' }));
        setLoading(false);
        return;
      }

      setJobPosting(data as JobPosting);

      if (data.preschool_id) {
        try {
          const { data: preschool } = await supabase
            .from('preschools')
            .select('name, logo_url, city, province, phone, contact_email, website_url')
            .eq('id', data.preschool_id)
            .maybeSingle();

          if (preschool) {
            if (isMounted) {
              setSchoolInfo({
                id: data.preschool_id,
                name: preschool.name,
                logoUrl: preschool.logo_url,
                city: preschool.city,
                province: preschool.province,
                phone: preschool.phone,
                email: preschool.contact_email,
                website: preschool.website_url,
              });
            }
          } else {
            const { data: org } = await supabase
              .from('organizations')
              .select('name, logo_url')
              .eq('id', data.preschool_id)
              .maybeSingle();
            if (org && isMounted) {
              setSchoolInfo({
                id: data.preschool_id,
                name: org.name,
                logoUrl: org.logo_url,
              });
            }
          }
        } catch (err) {
          console.warn('Failed to load school info:', err);
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [jobId, supabase, t]);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
  }, []);

  const formatEmploymentType = (value?: string | null) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'full-time' || normalized === 'full_time') return 'Full-Time';
    if (normalized === 'part-time' || normalized === 'part_time') return 'Part-Time';
    if (normalized === 'contract') return 'Contract';
    if (normalized === 'temporary') return 'Temporary';
    return 'Employment Type TBA';
  };

  const formatSalaryRange = (posting?: JobPosting | null) => {
    if (!posting) return 'Negotiable';
    if (posting.salary_range_min && posting.salary_range_max) {
      return `R${posting.salary_range_min} - R${posting.salary_range_max}`;
    }
    if (posting.salary_range_min) {
      return `From R${posting.salary_range_min}`;
    }
    return 'Negotiable';
  };

  const formatSchoolDetails = (info?: SchoolInfo | null) => {
    if (!info) return '';
    const location = [info.city, info.province].filter(Boolean).join(', ');
    const parts = [location, info.phone, info.email, info.website].filter(Boolean);
    return parts.join(' • ');
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validateForm = () => {
    setError(null);
    if (!firstName.trim()) {
      setError(t('validation.required', { field: t('auth.firstName', { defaultValue: 'First Name' }) }));
      return false;
    }
    if (!lastName.trim()) {
      setError(t('validation.required', { field: t('auth.lastName', { defaultValue: 'Last Name' }) }));
      return false;
    }
    if (!email.trim()) {
      setError(t('validation.required', { field: t('auth.email', { defaultValue: 'Email' }) }));
      return false;
    }
    if (!validateEmail(email.trim())) {
      setError(t('validation.email_invalid', { defaultValue: 'Please enter a valid email.' }));
      return false;
    }
    if (!phone.trim()) {
      setError(t('validation.required', { field: t('apply.phoneNumber', { defaultValue: 'Phone Number' }) }));
      return false;
    }
    if (!experienceYears.trim() || Number.isNaN(Number(experienceYears))) {
      setError(t('apply.error.yearsExperienceNumber', { defaultValue: 'Please enter valid years of experience.' }));
      return false;
    }
    if (!resumeFile) {
      setError(t('apply.error.resumeRequired', { defaultValue: 'Please upload your resume.' }));
      return false;
    }
    return true;
  };

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setResumeFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(t('apply.fileTooLargeDesc', { defaultValue: 'Resume must be less than 50MB.' }));
      return;
    }

    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      setError(t('apply.invalidFileTypeDesc', { defaultValue: 'Please upload a PDF or Word document.' }));
      return;
    }

    setError(null);
    setResumeFile(file);
  };

  const createOrGetCandidateProfile = async (): Promise<CandidateProfile> => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data: existing, error: fetchError } = await supabase
      .from('candidate_profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing && !fetchError) {
      return existing as CandidateProfile;
    }

    const { data: created, error: createError } = await supabase
      .from('candidate_profiles')
      .insert({
        email: normalizedEmail,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        experience_years: Number(experienceYears),
        qualifications: qualifications.trim() ? [{ field: qualifications.trim() }] : [],
      })
      .select('id')
      .single();

    if (createError || !created) {
      throw new Error(createError?.message || 'Failed to create candidate profile');
    }

    return created as CandidateProfile;
  };

  const uploadResume = async (): Promise<string | null> => {
    if (!resumeFile) return null;
    const { data: filename, error: filenameError } = await supabase.rpc('generate_resume_filename', {
      candidate_email: email.trim().toLowerCase(),
      original_filename: resumeFile.name,
    });

    if (filenameError || !filename) {
      throw new Error('Failed to generate filename');
    }

    const filePath = filename as string;
    const { error: uploadError } = await supabase.storage
      .from('candidate-resumes')
      .upload(filePath, resumeFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message || 'Failed to upload resume');
    }

    return filePath;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!jobPosting) return;
    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);
    try {
      const candidate = await createOrGetCandidateProfile();
      const resumePath = await uploadResume();

      const { error: submitError } = await supabase
        .from('job_applications')
        .insert({
          job_posting_id: jobPosting.id,
          candidate_profile_id: candidate.id,
          cover_letter: coverLetter.trim() || null,
          resume_file_path: resumePath,
          status: 'new',
        });

      if (submitError) {
        throw new Error(submitError.message || t('apply.submitError', { defaultValue: 'Failed to submit application.' }));
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || t('apply.submitError', { defaultValue: 'Failed to submit application.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const openInApp = () => {
    if (!jobId) return;
    const deepLink = `edudashpro:///apply/${encodeURIComponent(String(jobId))}`;
    const handleVisibilityChange = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.location.href = deepLink;
    setTimeout(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, 1500);
  };

  const getStoreUrl = () => platform === 'ios'
    ? 'https://apps.apple.com/app/edudash-pro/id6478437234'
    : 'https://play.google.com/store/apps/details?id=com.edudashpro';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900/60 border border-slate-700/60 flex items-center justify-center">
              <img src="/favicon.png" alt="EduDash Pro" className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-300/80">EduDash Pro</p>
              <p className="text-slate-300 text-sm">Hiring Hub Application</p>
            </div>
          </div>

          {schoolInfo ? (
            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4">
              {schoolInfo.logoUrl ? (
                <img src={schoolInfo.logoUrl} alt={schoolInfo.name} className="w-14 h-14 rounded-2xl object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-200 flex items-center justify-center text-lg font-semibold">
                  {getInitials(schoolInfo.name)}
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">School</p>
                <p className="text-white font-semibold text-lg">{schoolInfo.name}</p>
                {formatSchoolDetails(schoolInfo) ? (
                  <p className="text-slate-400 text-sm mt-1">{formatSchoolDetails(schoolInfo)}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-cyan-300/80">{t('apply.headerTitle', { defaultValue: 'Apply for Position' })}</p>
            <h1 className="text-3xl font-bold text-white">{jobPosting?.title || t('apply.screenTitle', { defaultValue: 'Apply for Job' })}</h1>
            {jobPosting && (
              <p className="text-slate-300 text-sm mt-2">
                {formatEmploymentType(jobPosting.employment_type)} • {jobPosting.location || 'Location TBA'} • {formatSalaryRange(jobPosting)}
              </p>
            )}
          </div>

          {jobPosting && (
            <div className="mb-8 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-5">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-xs font-semibold">
                  {formatEmploymentType(jobPosting.employment_type)}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-700/60 text-slate-200 text-xs font-semibold">
                  {jobPosting.location || 'Location TBA'}
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-semibold">
                  {formatSalaryRange(jobPosting)}
                </span>
              </div>
              <div className="text-sm text-slate-200 font-semibold mb-2">Job Snapshot</div>
              <p className="text-sm text-slate-300 whitespace-pre-line">
                {jobPosting.description}
              </p>
              {jobPosting.requirements && (
                <div className="text-sm text-slate-300 mt-3">
                  <span className="text-slate-100 font-semibold">Requirements:</span> {jobPosting.requirements}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <button
              type="button"
              onClick={openInApp}
              className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Open in App
            </button>
            {platform !== 'desktop' && (
              <a
                href={getStoreUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-3 border border-slate-600 text-slate-200 hover:bg-slate-700 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                Download the App
              </a>
            )}
          </div>

          {loading && (
            <div className="text-slate-300">{t('apply.loadingPosting', { defaultValue: 'Loading job posting...' })}</div>
          )}

          {!loading && !jobPosting && (
            <div className="text-slate-300">{statusMessage || t('apply.notFoundDesc', { defaultValue: 'This job may have been removed or expired' })}</div>
          )}

          {!loading && jobPosting && !submitted && (
            <form onSubmit={onSubmit} className="space-y-6">
              <section className="space-y-3">
                <h2 className="text-white font-semibold">{t('apply.schoolPosition', { defaultValue: 'School Position' })}</h2>
                <p className="text-slate-300 text-sm whitespace-pre-line">{jobPosting.description}</p>
                {jobPosting.requirements && (
                  <div className="text-slate-300 text-sm whitespace-pre-line">
                    <span className="font-semibold text-white">{t('apply.qualificationsTitle', { defaultValue: 'Qualifications' })}:</span> {jobPosting.requirements}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-semibold">{t('apply.personalInfo', { defaultValue: 'Personal Information' })}</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t('apply.placeholder.firstName', { defaultValue: 'First Name' })}
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-3 text-white"
                  />
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={t('apply.placeholder.lastName', { defaultValue: 'Last Name' })}
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-3 text-white"
                  />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('apply.placeholder.email', { defaultValue: 'Email' })}
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-3 text-white"
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('apply.phoneNumber', { defaultValue: 'Phone Number' })}
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-3 text-white"
                  />
                  <input
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    placeholder={t('apply.yearsExperience', { defaultValue: 'Years of Experience' })}
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-3 text-white"
                  />
                  <input
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    placeholder={t('apply.educationOptionalLabel', { defaultValue: 'Education & Certifications (Optional)' })}
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-3 text-white"
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-semibold">{t('apply.resumeLabel', { defaultValue: 'Resume/CV' })}</h2>
                <div className="border border-dashed border-slate-600 rounded-xl p-4 text-slate-300">
                  <input
                    type="file"
                    accept={ALLOWED_MIME_TYPES.join(',')}
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-500 file:text-white hover:file:bg-cyan-600"
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    {t('apply.uploadHint', { defaultValue: 'PDF or Word document, max 50MB' })}
                  </p>
                  {resumeFile && (
                    <p className="text-xs text-cyan-300 mt-2">Selected: {resumeFile.name}</p>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-white font-semibold">{t('apply.coverLetterOptional', { defaultValue: 'Cover Letter (Optional)' })}</h2>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={5}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-3 text-white"
                />
              </section>

              {error && <div className="text-red-400 text-sm">{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-60"
              >
                {submitting ? t('status.uploading', { defaultValue: 'Uploading...' }) : t('apply.submitCta', { defaultValue: 'Submit Application' })}
              </button>

              <p className="text-xs text-slate-400 text-center">
                {t('apply.privacyNotice', { defaultValue: 'Your information will only be shared with the hiring school.' })}
              </p>
            </form>
          )}

          {submitted && (
            <div className="text-slate-200 text-center py-10">
              <h2 className="text-2xl font-bold mb-4">{t('apply.submittedTitle', { defaultValue: 'Application Submitted!' })}</h2>
              <p className="text-slate-300 whitespace-pre-line">
                {t('apply.submittedDesc', { defaultValue: 'Your application has been received.' })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
