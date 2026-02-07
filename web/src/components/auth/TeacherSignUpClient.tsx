"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function TeacherSignUpClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteSchool, setInviteSchool] = useState<{
    id: string;
    name: string;
    logoUrl?: string | null;
    city?: string | null;
    province?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  } | null>(null);
  const [validatingInvite, setValidatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobLogoUrl, setJobLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite") || params.get("inviteCode");
    const emailParam = params.get("email");
    const jobParam = params.get("job") || params.get("jobId");

    if (emailParam && !email) setEmail(emailParam.trim());
    if (jobParam && !jobId) setJobId(jobParam.trim());
    if (!code) return;
    const trimmed = code.trim();
    if (trimmed) setInviteCode(trimmed.toUpperCase());
  }, [email, jobId]);

  useEffect(() => {
    if (!jobId) return;
    supabase
      .from("job_postings")
      .select("logo_url")
      .eq("id", jobId)
      .maybeSingle()
      .then((result: { data: { logo_url?: string | null } | null }) => {
        if (result.data?.logo_url) setJobLogoUrl(result.data.logo_url);
      })
      .catch(() => {});
  }, [jobId, supabase]);

  useEffect(() => {
    const normalized = inviteCode.trim().toUpperCase().replace(/\s+/g, "");
    if (!normalized) {
      setInviteSchool(null);
      setInviteError(null);
      return;
    }
    setValidatingInvite(true);
    setInviteError(null);
    const timer = setTimeout(() => {
      supabase
        .rpc("validate_invitation_code", { p_code: normalized })
        .then(async (result: { data: unknown; error: { message?: string } | null }) => {
          const { data, error: rpcError } = result;
          if (rpcError || !data) {
            setInviteSchool(null);
            setInviteError(rpcError?.message || "Invite code could not be verified yet.");
            return;
          }
          if (typeof data === "object" && "valid" in data) {
            if (!(data as { valid?: boolean }).valid) {
              setInviteSchool(null);
              setInviteError(String((data as { error?: string }).error || "Invalid or expired invite code."));
              return;
            }
            const schoolNameValue = String((data as { school_name?: string }).school_name || "");
            const schoolId = String((data as { school_id?: string }).school_id || "");
            if (schoolNameValue && schoolId) {
              let enriched = { id: schoolId, name: schoolNameValue } as typeof inviteSchool;
              try {
                const { data: preschool } = await supabase
                  .from("preschools")
                  .select("name, logo_url, city, province, phone, contact_email, website_url")
                  .eq("id", schoolId)
                  .maybeSingle();
                if (preschool) {
                  enriched = {
                    id: schoolId,
                    name: preschool.name || schoolNameValue,
                    logoUrl: preschool.logo_url,
                    city: preschool.city,
                    province: preschool.province,
                    phone: preschool.phone,
                    email: preschool.contact_email,
                    website: preschool.website_url,
                  };
                } else {
                  const { data: org } = await supabase
                    .from("organizations")
                    .select("name, logo_url")
                    .eq("id", schoolId)
                    .maybeSingle();
                  if (org) {
                    enriched = { id: schoolId, name: org.name || schoolNameValue, logoUrl: org.logo_url };
                  }
                }
              } catch {
                /* ignore */
              }
              setInviteSchool(enriched);
              setSchoolName((prev) => prev || schoolNameValue);
              setInviteError(null);
              return;
            }
          }
          setInviteSchool(null);
          setInviteError("Invite code could not be verified yet.");
        })
        .catch(() => {
          setInviteSchool(null);
          setInviteError("Invite code could not be verified yet.");
        })
        .finally(() => setValidatingInvite(false));
    }, 450);
    return () => clearTimeout(timer);
  }, [inviteCode, supabase]);

  const getInitials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  const fmtDetails = (info: typeof inviteSchool) => {
    if (!info) return "";
    const loc = [info.city, info.province].filter(Boolean).join(", ");
    return [loc, info.phone, info.email, info.website].filter(Boolean).join(" · ");
  };

  const schoolNameDisplay = inviteSchool?.name ?? schoolName;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) { setError("Full name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }

    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: "teacher" },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) { setLoading(false); setError(authError.message); return; }
    if (!authData.user) { setLoading(false); setError("Failed to create account. Please try again."); return; }

    const { error: profileError } = await supabase.from("profiles").update({
      role: "teacher",
      ...(inviteSchool?.id ? { preschool_id: inviteSchool.id, organization_id: inviteSchool.id, seat_status: "pending" } : {}),
    }).eq("id", authData.user.id);

    if (inviteCode.trim() && inviteSchool?.id) {
      try {
        await supabase.from("teacher_assignments").insert({
          teacher_id: authData.user.id,
          school_id: inviteSchool.id,
          status: "pending",
          joined_via: "invite_code",
        });
      } catch {
        /* ignore */
      }
    }

    setLoading(false);
    if (profileError) {
      setError("Account created but profile setup failed. Please contact support.");
      return;
    }
    router.push("/sign-up/teacher/success");
  }

  const headerLogo = inviteSchool?.logoUrl || jobLogoUrl || "/favicon.png";

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        :root {
          color-scheme: dark;
          --bg-primary: #050810;
          --bg-card: #0c1021;
          --bg-card-elevated: #111631;
          --bg-input: #0e1228;
          --border-subtle: rgba(99, 102, 241, 0.12);
          --border-strong: rgba(99, 102, 241, 0.25);
          --text-primary: #f1f5f9;
          --text-secondary: #94a3b8;
          --text-muted: #64748b;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          max-width: 100vw;
        }
        input, textarea, select, button { font-family: inherit; }
        ::selection { background: rgba(129, 140, 248, 0.3); }

        /* Consistent horizontal breathing room, including iOS safe-area insets */
        .safe-x {
          padding-left: max(18px, env(safe-area-inset-left));
          padding-right: max(18px, env(safe-area-inset-right));
        }
        @media (min-width: 640px) {
          .safe-x {
            padding-left: max(24px, env(safe-area-inset-left));
            padding-right: max(24px, env(safe-area-inset-right));
          }
        }
      `}</style>

      <div className="min-h-screen relative">
        {/* Background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.3), transparent 70%)" }} />
          <div className="absolute -bottom-60 -left-40 w-[600px] h-[600px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.25), transparent 70%)" }} />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <header className="border-b border-[var(--border-subtle)] backdrop-blur-xl bg-[var(--bg-primary)]/80">
            <div className="max-w-lg mx-auto safe-x py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <img src="/favicon.png" alt="" className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">EduDash Pro</span>
              </div>
              <Link href="/sign-in" className="text-xs font-medium text-indigo-300 hover:text-indigo-200 border border-indigo-500/20 rounded-lg px-3 py-1.5 hover:bg-indigo-500/10 transition-all">
                Sign In
              </Link>
            </div>
          </header>

          <main className="max-w-lg mx-auto safe-x py-10 pb-24">
            <div className="rounded-3xl bg-gradient-to-b from-indigo-500/25 via-indigo-500/8 to-purple-500/10 p-[1px] shadow-[0_40px_120px_-60px_rgba(0,0,0,0.9)]">
              <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
              {/* Header area */}
              <div className="px-6 pt-8 pb-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center mx-auto mb-5 overflow-hidden">
                  <img src={headerLogo} alt="EduDash Pro" className="w-12 h-12 rounded-xl object-cover" />
                </div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Teacher Sign Up</h1>
                <p className="text-sm text-[var(--text-secondary)]">Create your teacher account and join a preschool</p>
              </div>

              {/* Invite School Card */}
              {inviteSchool && (
                <div className="mx-6 mb-6 rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-4 flex items-center gap-3.5">
                  {inviteSchool.logoUrl ? (
                    <img src={inviteSchool.logoUrl} alt={inviteSchool.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center text-emerald-300 text-base font-bold flex-shrink-0">
                      {getInitials(inviteSchool.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] text-emerald-300/60 uppercase tracking-wider font-medium">Invited School</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{inviteSchool.name}</p>
                    {fmtDetails(inviteSchool) && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{fmtDetails(inviteSchool)}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={onSubmit} className="px-6 pb-8 space-y-4">
                <FormField label="Full Name" required>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Jane Smith" className="form-input" />
                </FormField>

                <FormField label="Email" required>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="form-input" />
                </FormField>

                <FormField label="Phone Number" hint="Optional">
                  <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+27 82 123 4567" className="form-input" />
                </FormField>

                <FormField label="Invite Code" hint="Optional">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. TEACH123"
                    className="form-input font-mono tracking-wider"
                  />
                  <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Use the invite code shared in the job post to auto-link your school.</p>
                  {inviteCode && (
                    <p className={`text-xs mt-1.5 flex items-center gap-1.5 ${validatingInvite ? "text-indigo-300" : inviteSchool ? "text-emerald-400" : "text-amber-400"}`}>
                      {validatingInvite ? (
                        <>
                          <span className="inline-block w-3 h-3 border border-indigo-400/40 border-t-indigo-400 rounded-full animate-spin" />
                          Validating...
                        </>
                      ) : inviteSchool ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Verified — {inviteSchool.name}
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
                          {inviteError || "Could not verify. You can still sign up."}
                        </>
                      )}
                    </p>
                  )}
                </FormField>

                <FormField label="School / Preschool Name" hint="Optional">
                  <input
                    type="text"
                    value={schoolNameDisplay}
                    onChange={(e) => { if (!inviteSchool) setSchoolName(e.target.value); }}
                    placeholder="Sunshine Preschool"
                    disabled={Boolean(inviteSchool)}
                    className="form-input disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                    {inviteSchool ? "Linked via invite code." : "Your principal will invite you to join."}
                  </p>
                </FormField>

                <FormField label="Password" required>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="At least 8 characters"
                      className="form-input pr-10"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      )}
                    </button>
                  </div>
                </FormField>

                <FormField label="Confirm Password" required>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter password"
                    className="form-input"
                  />
                </FormField>

                {/* Error */}
                {error && (
                  <div className="rounded-xl bg-red-500/8 border border-red-500/20 p-3.5 flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 mt-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating Account...
                    </span>
                  ) : "Create Teacher Account"}
                </button>

                <p className="text-[10px] text-[var(--text-muted)] text-center mt-2">
                  By signing up, you agree to our{" "}
                  <Link href="/terms" className="text-indigo-400/60 hover:text-indigo-300 transition-colors">Terms</Link> and{" "}
                  <Link href="/privacy" className="text-indigo-400/60 hover:text-indigo-300 transition-colors">Privacy Policy</Link>
                </p>
              </form>
              </div>
            </div>

            {/* Bottom links */}
            <div className="mt-6 space-y-3 text-center">
              <p className="text-sm text-[var(--text-secondary)]">
                Already have an account?{" "}
                <Link href="/sign-in" className="text-indigo-400 font-medium hover:text-indigo-300 transition-colors">Sign In</Link>
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Are you a parent?{" "}
                <Link href="/sign-up/parent" className="text-indigo-400 font-medium hover:text-indigo-300 transition-colors">Sign up as Parent</Link>
              </p>
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t border-[var(--border-subtle)] py-6 text-center">
            <p className="text-xs text-[var(--text-muted)]">
              &copy; {new Date().getFullYear()} EduDash Pro &middot;{" "}
              <Link href="/" className="text-indigo-400/60 hover:text-indigo-300 transition-colors">Home</Link>
            </p>
          </footer>
        </div>
      </div>

      <style jsx global>{`
        .form-input {
          width: 100%;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 14px;
          color: var(--text-primary);
          transition: all 0.15s;
          appearance: none;
          -webkit-appearance: none;
        }
        .form-input::placeholder {
          color: var(--text-muted);
        }
        .form-input:focus {
          outline: none;
          border-color: rgba(99, 102, 241, 0.4);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
        }

        /* Fix Chrome/iOS autofill forcing a white background on dark inputs */
        .form-input:-webkit-autofill,
        .form-input:-webkit-autofill:hover,
        .form-input:-webkit-autofill:focus,
        .form-input:-webkit-autofill:active {
          -webkit-text-fill-color: var(--text-primary) !important;
          caret-color: var(--text-primary);
          box-shadow: 0 0 0px 1000px var(--bg-input) inset !important;
          transition: background-color 9999s ease-in-out 0s;
          border: 1px solid var(--border-subtle);
        }
        .form-input:autofill {
          box-shadow: 0 0 0px 1000px var(--bg-input) inset !important;
        }
      `}</style>
    </>
  );
}

function FormField({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
        {label} {required && <span className="text-indigo-400">*</span>}
        {hint && <span className="text-[var(--text-muted)] font-normal ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
