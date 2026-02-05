"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function TeacherSignUpClient() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
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

    if (emailParam && !email) {
      setEmail(emailParam.trim());
    }

    if (jobParam && !jobId) {
      setJobId(jobParam.trim());
    }

    if (!code) return;
    const trimmed = code.trim();
    if (!trimmed) return;
    setInviteCode(trimmed.toUpperCase());
  }, [email, jobId]);

  useEffect(() => {
    if (!jobId) return;
    supabase
      .from('job_postings')
      .select('logo_url')
      .eq('id', jobId)
      .maybeSingle()
      .then((result: { data: { logo_url?: string | null } | null }) => {
        if (result.data?.logo_url) {
          setJobLogoUrl(result.data.logo_url);
        }
      })
      .catch((err: unknown) => {
        console.warn('Failed to load job logo:', err);
      });
  }, [jobId, supabase]);

  useEffect(() => {
    const normalized = inviteCode.trim().toUpperCase().replace(/\s+/g, '');
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
                  .from('preschools')
                  .select('name, logo_url, city, province, phone, contact_email, website_url')
                  .eq('id', schoolId)
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
                    .from('organizations')
                    .select('name, logo_url')
                    .eq('id', schoolId)
                    .maybeSingle();
                  if (org) {
                    enriched = {
                      id: schoolId,
                      name: org.name || schoolNameValue,
                      logoUrl: org.logo_url,
                    };
                  }
                }
              } catch (err) {
                console.warn("Failed to load school details:", err);
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
        .catch((err: unknown) => {
          console.error("Invite code validation failed:", err);
          setInviteSchool(null);
          setInviteError("Invite code could not be verified yet.");
        })
        .finally(() => setValidatingInvite(false));
    }, 450);

    return () => clearTimeout(timer);
  }, [inviteCode, supabase]);

  const formatInviteSchoolDetails = (info: typeof inviteSchool) => {
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

  const schoolNameDisplay = inviteSchool?.name ?? schoolName;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'teacher',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    if (!authData.user) {
      setLoading(false);
      setError("Failed to create account. Please try again.");
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: 'teacher',
        ...(inviteSchool?.id ? { preschool_id: inviteSchool.id, organization_id: inviteSchool.id, seat_status: 'pending' } : {}),
      })
      .eq('id', authData.user.id);

    const normalizedInvite = inviteCode.trim().toUpperCase();
    if (normalizedInvite && inviteSchool?.id) {
      try {
        await supabase
          .from('teacher_assignments')
          .insert({
            teacher_id: authData.user.id,
            school_id: inviteSchool.id,
            status: 'pending',
            joined_via: 'invite_code',
          });
      } catch (err) {
        console.warn("School linking error:", err);
      }
    }

    setLoading(false);

    if (profileError) {
      setError("Account created but profile setup failed. Please contact support.");
      console.error("Profile creation error:", profileError);
      return;
    }

    router.push('/sign-up/teacher/success');
  }

  const headerLogo = inviteSchool?.logoUrl || jobLogoUrl || '/favicon.png';

  return (
    <>
      <style jsx global>{`
        body {
          overflow-x: hidden;
          max-width: 100vw;
        }
      `}</style>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", fontFamily: "system-ui, sans-serif", overflowX: "hidden", padding: "20px 0" }}>
        <div style={{ width: "100%", maxWidth: "100vw", background: "#111113", padding: "40px 5%", border: "1px solid #1f1f23", boxSizing: "border-box" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #0f172a 0%, #111827 100%)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", overflow: "hidden", border: "1px solid #1f2937" }}>
              <img src={headerLogo} alt="EduDash Pro" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover" }} />
            </div>
            <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Teacher Sign Up</h1>
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Create your teacher account and join a preschool</p>
          </div>

          {inviteSchool && (
            <div style={{ maxWidth: 520, margin: "0 auto 24px", padding: 16, borderRadius: 16, border: "1px solid #1f2937", background: "#0f172a", display: "flex", gap: 14, alignItems: "center" }}>
              {inviteSchool.logoUrl ? (
                <img src={inviteSchool.logoUrl} alt={inviteSchool.name} style={{ width: 56, height: 56, borderRadius: 16, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #00f5ff 0%, #0088cc 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#001018", fontWeight: 700, fontSize: 18 }}>
                  {getInitials(inviteSchool.name)}
                </div>
              )}
              <div>
                <p style={{ color: "#9CA3AF", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Invited School</p>
                <p style={{ color: "#fff", fontSize: 16, fontWeight: 600, margin: "4px 0 0" }}>{inviteSchool.name}</p>
                {formatInviteSchoolDetails(inviteSchool) ? (
                  <p style={{ color: "#94a3b8", fontSize: 12, margin: "6px 0 0" }}>{formatInviteSchoolDetails(inviteSchool)}</p>
                ) : null}
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 500, margin: "0 auto" }}>
            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Jane Smith"
                style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Phone Number (Optional)</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+27 82 123 4567"
                style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Invite Code (Optional)</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. TEACH123"
                style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box", letterSpacing: 1 }}
              />
              <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Use the invite code shared in the job post to auto-link your school.</p>
              {inviteCode && (
                <p style={{ fontSize: 12, color: validatingInvite ? "#38bdf8" : inviteSchool ? "#22c55e" : "#f59e0b", marginTop: 6 }}>
                  {validatingInvite
                    ? "Validating invite code..."
                    : inviteSchool
                      ? `Invite code verified for ${inviteSchool.name}. We'll connect you after signup.`
                      : inviteError || "Invite code could not be verified yet. You can still sign up and contact your principal."}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>School/Preschool Name (Optional)</label>
              <input
                type="text"
                value={schoolNameDisplay}
                onChange={(e) => {
                  if (!inviteSchool) {
                    setSchoolName(e.target.value);
                  }
                }}
                placeholder="Sunshine Preschool"
                disabled={Boolean(inviteSchool)}
                style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
              />
              <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                {inviteSchool ? "Linked to the school from your invite code." : "Your principal will invite you to join your school"}
              </p>
            </div>

            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Password *</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 8 characters"
                  style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, paddingRight: 40, boxSizing: "border-box" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, color: "#9CA3AF", cursor: "pointer", fontSize: 18 }}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Confirm Password *</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter password"
                style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
              />
            </div>

            {error && (
              <div style={{ padding: 12, background: "#7f1d1d", border: "1px solid #991b1b", borderRadius: 8 }}>
                <p style={{ color: "#fca5a5", fontSize: 14, margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: loading ? "#555" : "linear-gradient(135deg, #00f5ff 0%, #0088cc 100%)",
                color: "#000",
                border: 0,
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating Account..." : "Create Teacher Account"}
            </button>

            <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, margin: 0 }}>
              By signing up, you agree to our <Link href="/terms" style={{ color: "#00f5ff" }}>Terms</Link> and <Link href="/privacy" style={{ color: "#00f5ff" }}>Privacy Policy</Link>
            </p>
          </form>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #2a2a2f", textAlign: "center" }}>
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>
              Already have an account? <Link href="/sign-in" style={{ color: "#00f5ff", fontWeight: 600, textDecoration: "underline" }}>Sign In</Link>
            </p>
            <p style={{ color: "#9CA3AF", fontSize: 14, marginTop: 12 }}>
              Are you a parent? <Link href="/sign-up/parent" style={{ color: "#00f5ff", fontWeight: 600, textDecoration: "underline" }}>Sign up as Parent</Link>
            </p>
          </div>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <Link href="/" style={{ color: "#00f5ff", fontSize: 14, textDecoration: "none" }}>
              ← Go to Home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
