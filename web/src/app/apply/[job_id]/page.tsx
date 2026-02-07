/**
 * Public Job Application Page (Web)
 * Mobile-first, polished apply flow for teachers without the app.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
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
  logo_url?: string | null;
  location?: string | null;
  employment_type?: string | null;
  salary_range_min?: number | null;
  salary_range_max?: number | null;
  status?: string | null;
  expires_at?: string | null;
  preschool_id?: string | null;
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

  const [loading, setLoading] = useState(true);
  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

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
        setStatusMessage('This job posting could not be found. It may have been removed or the link is incorrect.');
        setLoading(false);
        return;
      }

      if (data.status && data.status !== 'active') {
        setJobPosting(null);
        setStatusMessage('This job posting is no longer accepting applications.');
        setLoading(false);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setJobPosting(null);
        setStatusMessage('This job posting has expired and is no longer accepting applications.');
        setLoading(false);
        return;
      }

      if (isMounted) setJobPosting(data as JobPosting);

      if (data.preschool_id) {
        try {
          const { data: preschool } = await supabase
            .from('preschools')
            .select('name, logo_url, city, province, phone, contact_email, website_url')
            .eq('id', data.preschool_id)
            .maybeSingle();

          if (preschool && isMounted) {
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
          } else {
            const { data: org } = await supabase
              .from('organizations')
              .select('name, logo_url')
              .eq('id', data.preschool_id)
              .maybeSingle();
            if (org && isMounted) {
              setSchoolInfo({ id: data.preschool_id, name: org.name, logoUrl: org.logo_url });
            }
          }
        } catch {
          /* ignore */
        }
      }

      if (isMounted) setLoading(false);
    };

    void load();
    return () => { isMounted = false; };
  }, [jobId, supabase]);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios');
    else if (/android/.test(ua)) setPlatform('android');
    else setPlatform('desktop');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const code = p.get('invite') || p.get('inviteCode') || p.get('code');
    if (code?.trim()) setInviteCode(code.trim().toUpperCase());
  }, []);

  const fmtType = (v?: string | null) => {
    const n = String(v || '').toLowerCase();
    if (n === 'full-time' || n === 'full_time') return 'Full-Time';
    if (n === 'part-time' || n === 'part_time') return 'Part-Time';
    if (n === 'contract') return 'Contract';
    if (n === 'temporary') return 'Temporary';
    return null;
  };

  const fmtSalary = (p?: JobPosting | null) => {
    if (!p) return null;
    if (p.salary_range_min && p.salary_range_max) return `R${p.salary_range_min.toLocaleString()} – R${p.salary_range_max.toLocaleString()}`;
    if (p.salary_range_min) return `From R${p.salary_range_min.toLocaleString()}`;
    return null;
  };

  const getInitials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');

  const fmtLocation = (info?: SchoolInfo | null) => {
    if (!info) return '';
    return [info.city, info.province].filter(Boolean).join(', ');
  };

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const validateForm = () => {
    setError(null);
    if (!firstName.trim()) { setError('First Name is required'); return false; }
    if (!lastName.trim()) { setError('Last Name is required'); return false; }
    if (!email.trim()) { setError('Email is required'); return false; }
    if (!validateEmail(email.trim())) { setError('Please enter a valid email address'); return false; }
    if (!phone.trim()) { setError('Phone number is required'); return false; }
    if (!experienceYears.trim() || Number.isNaN(Number(experienceYears))) { setError('Please enter valid years of experience'); return false; }
    if (!resumeFile) { setError('Please upload your CV/resume'); return false; }
    return true;
  };

  const handleFile = (file: File | null) => {
    if (!file) { setResumeFile(null); return; }
    if (file.size > MAX_FILE_SIZE) { setError('Resume must be less than 50MB'); return; }
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) { setError('Please upload a PDF or Word document'); return; }
    setError(null);
    setResumeFile(file);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobPosting || !validateForm()) return;
    setSubmitting(true);
    setError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: existing } = await supabase.from('candidate_profiles').select('id').eq('email', normalizedEmail).maybeSingle();
      let candidateId: string;
      if (existing) {
        candidateId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('candidate_profiles')
          .insert({ email: normalizedEmail, first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim(), experience_years: Number(experienceYears), qualifications: qualifications.trim() ? [{ field: qualifications.trim() }] : [] })
          .select('id')
          .single();
        if (createErr || !created) throw new Error(createErr?.message || 'Failed to create candidate profile');
        candidateId = created.id;
      }

      let resumePath: string | null = null;
      if (resumeFile) {
        const { data: filename, error: fnErr } = await supabase.rpc('generate_resume_filename', { candidate_email: normalizedEmail, original_filename: resumeFile.name });
        if (fnErr || !filename) throw new Error('Failed to generate filename');
        const { error: upErr } = await supabase.storage.from('candidate-resumes').upload(filename as string, resumeFile, { cacheControl: '3600', upsert: false });
        if (upErr) throw new Error(upErr.message || 'Failed to upload resume');
        resumePath = filename as string;
      }

      const { error: submitErr } = await supabase.from('job_applications').insert({ job_posting_id: jobPosting.id, candidate_profile_id: candidateId, cover_letter: coverLetter.trim() || null, resume_file_path: resumePath, status: 'new' });
      if (submitErr) throw new Error(submitErr.message || 'Failed to submit application');
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openInApp = () => {
    if (!jobId) return;
    const q = inviteCode ? `?invite=${encodeURIComponent(inviteCode)}` : '';
    window.location.href = `edudashpro:///apply/${encodeURIComponent(String(jobId))}${q}`;
  };

  const teacherSignupLink = inviteCode
    ? `/sign-up/teacher?invite=${encodeURIComponent(inviteCode)}${jobId ? `&job=${encodeURIComponent(String(jobId))}` : ''}`
    : `/sign-up/teacher${jobId ? `?job=${encodeURIComponent(String(jobId))}` : ''}`;

  const logoUrl = jobPosting?.logo_url || schoolInfo?.logoUrl;
  const schoolName = schoolInfo?.name;
  const isLongDesc = (jobPosting?.description?.length || 0) > 400;

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        :root {
          --bg-primary: #050810;
          --bg-card: #0c1021;
          --bg-card-elevated: #111631;
          --bg-input: #0e1228;
          --border-subtle: rgba(99, 102, 241, 0.12);
          --border-strong: rgba(99, 102, 241, 0.25);
          --accent: #818cf8;
          --accent-bright: #a5b4fc;
          --accent-glow: rgba(99, 102, 241, 0.15);
          --text-primary: #f1f5f9;
          --text-secondary: #94a3b8;
          --text-muted: #64748b;
          --success: #34d399;
          --success-bg: rgba(52, 211, 153, 0.1);
          --error: #f87171;
          --error-bg: rgba(248, 113, 113, 0.1);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        input, textarea, select, button { font-family: inherit; }
        ::selection { background: rgba(129, 140, 248, 0.3); }
      `}</style>

      <div className="min-h-screen relative">
        {/* Background gradient orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3), transparent 70%)' }} />
          <div className="absolute -bottom-60 -left-40 w-[600px] h-[600px] rounded-full opacity-15" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.25), transparent 70%)' }} />
        </div>

        <div className="relative z-10">
          {/* Top bar */}
          <header className="border-b border-[var(--border-subtle)] backdrop-blur-xl bg-[var(--bg-primary)]/80">
            <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <img src="/favicon.png" alt="" className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">EduDash Pro</span>
                  <span className="text-xs text-[var(--text-muted)] ml-1.5">Hiring Hub</span>
                </div>
              </div>
              <button
                onClick={openInApp}
                className="text-xs font-medium text-indigo-300 hover:text-indigo-200 border border-indigo-500/20 rounded-lg px-3 py-1.5 hover:bg-indigo-500/10 transition-all"
              >
                Open in App
              </button>
            </div>
          </header>

          <main className="max-w-2xl mx-auto px-4 py-6 pb-20">
            {/* Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
                <p className="text-[var(--text-muted)] text-sm mt-4">Loading job posting...</p>
              </div>
            )}

            {/* Empty/Error State */}
            {!loading && !jobPosting && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center mt-8">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Job Not Available</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">{statusMessage}</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button onClick={openInApp} className="px-5 py-2.5 rounded-xl bg-indigo-500/10 text-indigo-300 text-sm font-medium border border-indigo-500/20 hover:bg-indigo-500/20 transition-all">
                    Browse Jobs in App
                  </button>
                  <Link href={teacherSignupLink} className="px-5 py-2.5 rounded-xl bg-[var(--bg-card-elevated)] text-[var(--text-secondary)] text-sm font-medium border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all text-center">
                    Create Teacher Account
                  </Link>
                </div>
              </div>
            )}

            {/* Job Posted — Main Content */}
            {!loading && jobPosting && !submitted && (
              <div className="space-y-5">
                {/* School + Job Header Card */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                  {/* School Banner */}
                  <div className="px-5 pt-5 pb-4">
                    <div className="flex items-start gap-4">
                      {logoUrl ? (
                        <img src={logoUrl} alt={schoolName || ''} className="w-14 h-14 rounded-xl object-cover border border-[var(--border-subtle)] flex-shrink-0" />
                      ) : schoolName ? (
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-300 text-lg font-bold flex-shrink-0">
                          {getInitials(schoolName)}
                        </div>
                      ) : null}
                      <div className="flex-1 min-w-0">
                        {schoolName && (
                          <p className="text-xs font-medium text-indigo-300/80 uppercase tracking-wider mb-1">{schoolName}</p>
                        )}
                        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] leading-tight">{jobPosting.title}</h1>
                        {fmtLocation(schoolInfo) && (
                          <p className="text-sm text-[var(--text-muted)] mt-1 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                            {fmtLocation(schoolInfo)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {fmtType(jobPosting.employment_type) && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/15">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {fmtType(jobPosting.employment_type)}
                        </span>
                      )}
                      {jobPosting.location && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-300 border border-slate-500/15">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {jobPosting.location}
                        </span>
                      )}
                      {fmtSalary(jobPosting) && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/15">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 00-.44.23c-.317.2-.483.424-.483.663 0 .296.166.58.537.838l-.003-.003.003.002-.004.001z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM10.75 4.75a.75.75 0 00-1.5 0v.316a3.78 3.78 0 00-1.653.713C6.952 6.268 6.5 6.93 6.5 7.666c0 .753.37 1.37.943 1.834.448.363.98.614 1.557.769v2.926a3.33 3.33 0 01-1.18-.643.75.75 0 00-.97 1.145c.598.507 1.344.844 2.15.967v.331a.75.75 0 001.5 0v-.306a3.93 3.93 0 001.842-.778c.678-.488 1.158-1.2 1.158-2.045 0-.834-.48-1.49-1.098-1.937a5.12 5.12 0 00-1.902-.862V6.596c.34.122.636.29.873.493a.75.75 0 10.994-1.124A3.64 3.64 0 0010.75 5.1V4.75z" clipRule="evenodd" /></svg>
                          {fmtSalary(jobPosting)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Invite Code Banner */}
                  {inviteCode && (
                    <div className="mx-5 mb-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-emerald-300/70 font-medium">Invite Code Detected</p>
                          <p className="text-sm font-semibold text-emerald-200 font-mono tracking-wide">{inviteCode}</p>
                        </div>
                      </div>
                      <Link href={teacherSignupLink} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 text-xs font-semibold border border-emerald-500/25 hover:bg-emerald-500/25 transition-all whitespace-nowrap flex-shrink-0">
                        Create Account
                      </Link>
                    </div>
                  )}

                  {/* Description */}
                  <div className="border-t border-[var(--border-subtle)] px-5 py-4">
                    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">About This Role</h3>
                    <div className={`text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line ${!showFullDescription && isLongDesc ? 'max-h-48 overflow-hidden relative' : ''}`}>
                      {jobPosting.description}
                      {!showFullDescription && isLongDesc && (
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--bg-card)] to-transparent" />
                      )}
                    </div>
                    {isLongDesc && (
                      <button onClick={() => setShowFullDescription(!showFullDescription)} className="text-xs font-medium text-indigo-400 hover:text-indigo-300 mt-2 transition-colors">
                        {showFullDescription ? 'Show less' : 'Read more'}
                      </button>
                    )}
                    {jobPosting.requirements && (
                      <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Requirements</h3>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{jobPosting.requirements}</p>
                      </div>
                    )}
                  </div>

                  {/* CTA buttons */}
                  <div className="border-t border-[var(--border-subtle)] px-5 py-4 flex flex-col sm:flex-row gap-2.5">
                    <button onClick={openInApp} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5" /></svg>
                      Apply in App
                    </button>
                    <Link href={teacherSignupLink} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--bg-card-elevated)] text-[var(--text-secondary)] font-medium text-sm border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-all">
                      Create Teacher Account
                    </Link>
                  </div>
                </div>

                {/* Application Form */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="px-5 pt-5 pb-3">
                    <h2 className="text-base font-bold text-[var(--text-primary)]">Apply Online</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Fill in your details to submit your application directly.</p>
                  </div>

                  <form onSubmit={onSubmit} className="px-5 pb-6">
                    {/* Personal Info */}
                    <fieldset className="space-y-3.5 mb-6">
                      <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Personal Information</legend>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormInput label="First Name" value={firstName} onChange={setFirstName} placeholder="First name" required />
                        <FormInput label="Last Name" value={lastName} onChange={setLastName} placeholder="Last name" required />
                      </div>
                      <FormInput label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" required />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormInput label="Phone Number" value={phone} onChange={setPhone} placeholder="+27 82 123 4567" type="tel" required />
                        <FormInput label="Years of Experience" value={experienceYears} onChange={setExperienceYears} placeholder="e.g. 3" type="number" required />
                      </div>
                      <FormInput label="Education & Certifications" value={qualifications} onChange={setQualifications} placeholder="e.g. NQF Level 4 in ECD" hint="Optional" />
                    </fieldset>

                    {/* Resume Upload */}
                    <fieldset className="mb-6">
                      <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">CV / Resume</legend>
                      <div
                        className={`relative rounded-xl border-2 border-dashed transition-all p-5 text-center cursor-pointer ${dragActive ? 'border-indigo-400 bg-indigo-500/5' : resumeFile ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] bg-[var(--bg-input)]'}`}
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files?.[0] || null); }}
                        onClick={() => document.getElementById('resume-input')?.click()}
                      >
                        <input id="resume-input" type="file" accept={ALLOWED_MIME_TYPES.join(',')} onChange={(e) => handleFile(e.target.files?.[0] || null)} className="hidden" />
                        {resumeFile ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <span className="text-sm text-emerald-300 font-medium">{resumeFile.name}</span>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setResumeFile(null); }} className="ml-2 text-[var(--text-muted)] hover:text-red-400 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ) : (
                          <>
                            <svg className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                            <p className="text-sm text-[var(--text-secondary)]">
                              <span className="text-indigo-400 font-medium">Upload your CV</span> or drag and drop
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">PDF or Word document, max 50MB</p>
                          </>
                        )}
                      </div>
                    </fieldset>

                    {/* Cover Letter */}
                    <fieldset className="mb-6">
                      <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                        Cover Letter <span className="font-normal text-[var(--text-muted)]">(Optional)</span>
                      </legend>
                      <textarea
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        rows={4}
                        placeholder="Tell us why you'd be a great fit for this role..."
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none"
                      />
                    </fieldset>

                    {/* Error */}
                    {error && (
                      <div className="rounded-xl bg-[var(--error-bg)] border border-red-500/20 p-3.5 mb-4 flex items-start gap-2.5">
                        <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                        <p className="text-sm text-red-300">{error}</p>
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25"
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Submitting...
                        </span>
                      ) : 'Submit Application'}
                    </button>

                    <p className="text-[10px] text-[var(--text-muted)] text-center mt-3">
                      Your information will only be shared with the hiring school.
                    </p>
                  </form>
                </div>
              </div>
            )}

            {/* Success State */}
            {submitted && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center mt-8">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Application Submitted!</h2>
                <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto mb-6">
                  Your application has been sent to {schoolName || 'the school'}. They&apos;ll review it and get back to you.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href={teacherSignupLink} className="px-5 py-2.5 rounded-xl bg-indigo-500/10 text-indigo-300 text-sm font-medium border border-indigo-500/20 hover:bg-indigo-500/20 transition-all">
                    Create Teacher Account
                  </Link>
                  <button onClick={openInApp} className="px-5 py-2.5 rounded-xl bg-[var(--bg-card-elevated)] text-[var(--text-secondary)] text-sm font-medium border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all">
                    Open EduDash Pro
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="border-t border-[var(--border-subtle)] py-6 text-center">
            <p className="text-xs text-[var(--text-muted)]">
              &copy; {new Date().getFullYear()} EduDash Pro &middot;{' '}
              <Link href="/terms" className="text-indigo-400/60 hover:text-indigo-300 transition-colors">Terms</Link> &middot;{' '}
              <Link href="/privacy" className="text-indigo-400/60 hover:text-indigo-300 transition-colors">Privacy</Link>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

/* Reusable Form Input */
function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
        {label} {required && <span className="text-indigo-400">*</span>}
        {hint && <span className="text-[var(--text-muted)] font-normal ml-1">({hint})</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
      />
    </div>
  );
}
