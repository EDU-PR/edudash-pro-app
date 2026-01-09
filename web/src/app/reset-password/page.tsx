"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Detect if user is on mobile and redirect to native app
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    if (isMobile) {
      // Get all URL parameters to pass to native app
      const searchParams = new URLSearchParams(window.location.search);
      const token_hash = searchParams.get('token_hash');
      const token = searchParams.get('token');
      const code = searchParams.get('code');
      const type = searchParams.get('type');
      const access_token = searchParams.get('access_token');
      const refresh_token = searchParams.get('refresh_token');

      // Build deep link URL for native app
      const params = new URLSearchParams();
      if (token_hash) params.set('token_hash', token_hash);
      if (token) params.set('token', token);
      if (code) params.set('code', code);
      if (type) params.set('type', type);
      if (access_token) params.set('access_token', access_token);
      if (refresh_token) params.set('refresh_token', refresh_token);

      // Also check hash fragment
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const hashAccessToken = hashParams.get('access_token');
      const hashRefreshToken = hashParams.get('refresh_token');
      
      if (hashAccessToken) params.set('access_token', hashAccessToken);
      if (hashRefreshToken) params.set('refresh_token', hashRefreshToken);

      const queryString = params.toString();
      const appUrl = `edudashpro://reset-password${queryString ? `?${queryString}` : ''}`;
      
      console.log('[ResetPassword] Redirecting to native app:', appUrl);
      
      // Redirect to native app
      window.location.href = appUrl;
      
      // Fallback: If app doesn't open, show error after timeout
      setTimeout(() => {
        setError('Unable to open the EduDash Pro app. Please make sure the app is installed and try again.');
      }, 2000);
      
      return;
    }

    // Web user - check session and process normally
    const checkSession = async () => {
      const supabase = createClient();
      
      // First, try to exchange the code from URL if present
      // This happens automatically with detectSessionInUrl: true in the client config
      
      // Small delay to allow URL session detection to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        setError(sessionError.message || "Invalid or expired reset link. Please request a new password reset.");
        return;
      }
      
      if (session && session.user) {
        setValidSession(true);
        setUserEmail(session.user.email || null);
      } else {
        setError("Invalid or expired reset link. Please request a new password reset.");
      }
    };
    
    checkSession();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });
    
    setLoading(false);
    
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    
    // Redirect to sign-in after 3 seconds
    setTimeout(() => {
      router.push("/sign-in");
    }, 3000);
  }

  if (!validSession && !error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ color: "#fff", fontSize: 16 }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        body {
          overflow-x: hidden;
          max-width: 100vw;
        }
      `}</style>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", fontFamily: "system-ui, sans-serif", overflowX: "hidden" }}>
        <div style={{ width: "100%", maxWidth: "500px", background: "#111113", padding: "40px 5%", border: "1px solid #1f1f23", boxSizing: "border-box", margin: "20px" }}>
          {/* Header with icon */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, background: "rgba(99, 102, 241, 0.15)", borderRadius: 32, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 32 }}>
              🔑
            </div>
            <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Reset Your Password</h1>
            {userEmail && (
              <div style={{ 
                background: "rgba(99, 102, 241, 0.1)", 
                border: "1px solid rgba(99, 102, 241, 0.3)", 
                borderRadius: 8, 
                padding: "10px 16px", 
                marginTop: 12,
                marginBottom: 8
              }}>
                <p style={{ color: "#9CA3AF", fontSize: 12, margin: 0, marginBottom: 4 }}>Resetting password for:</p>
                <p style={{ color: "#00f5ff", fontSize: 14, fontWeight: 600, margin: 0 }}>{userEmail}</p>
              </div>
            )}
            <p style={{ color: "#9CA3AF", fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
              Enter your new password below.
            </p>
          </div>

          {!validSession ? (
            <div>
              <div style={{ padding: 12, background: "#7f1d1d", border: "1px solid #991b1b", borderRadius: 8, marginBottom: 20 }}>
                <p style={{ color: "#fca5a5", fontSize: 14, margin: 0 }}>{error}</p>
              </div>
              <Link href="/forgot-password" style={{ textDecoration: "none" }}>
                <button style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "linear-gradient(135deg, #00f5ff 0%, #0088cc 100%)",
                  color: "#000",
                  border: 0,
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}>
                  Request New Reset Link
                </button>
              </Link>
            </div>
          ) : success ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
              <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Password Reset Successful!</h2>
              <p style={{ color: "#9CA3AF", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                Your password has been successfully reset. Redirecting you to sign in...
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={8}
                    style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, color: "#9CA3AF", cursor: "pointer", fontSize: 18 }}
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
                <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>Must be at least 8 characters</p>
              </div>

              <div>
                <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={8}
                  style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14 }}
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
                  padding: "12px 16px",
                  background: loading ? "#555" : "linear-gradient(135deg, #00f5ff 0%, #0088cc 100%)",
                  color: "#000",
                  border: 0,
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Resetting Password..." : "Reset Password"}
              </button>
            </form>
          )}

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <Link href="/sign-in" style={{ color: "#00f5ff", fontSize: 14, textDecoration: "none" }}>
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
