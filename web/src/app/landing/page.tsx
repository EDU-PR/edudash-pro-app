"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LandingInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "done">("loading");
  const [message, setMessage] = useState<string>("");

  const playStoreUrl = "https://play.google.com/store/apps/details?id=com.edudashpro";

  const tryOpenApp = (pathAndQuery: string) => {
    // IMPORTANT: Use triple-slash so Android doesn't treat the first segment as hostname.
    // Example: `edudashpro:///screens/payments/return?...`
    const schemeUrl = `edudashpro:///${pathAndQuery.replace(/^\//, "")}`;
    let didHide = false;
    const visibilityHandler = () => {
      if (document.hidden) didHide = true;
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    window.location.replace(schemeUrl);
    setTimeout(() => {
      document.removeEventListener("visibilitychange", visibilityHandler);
      if (!didHide) {
        // Android "Open with" chooser may not hide the page; avoid false "not installed" messaging.
        setStatus("ready");
        setMessage("If prompted, choose EduDash Pro to open. If nothing happens, you can install the app from Google Play.");
      }
    }, 6000);
  };

  useEffect(() => {
    const run = async () => {
      try {
        const flow = (searchParams.get("flow") || searchParams.get("type") || "").toLowerCase();
        const tokenHash = searchParams.get("token_hash") || searchParams.get("token") || "";
        const inviteCode = searchParams.get("code") || searchParams.get("invitationCode") || "";

        // IMPORTANT: Extract tokens from hash fragment (Supabase puts session tokens here after /verify)
        // Example: #access_token=...&refresh_token=...&type=recovery
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hashParams.get("access_token") || "";
        const refreshToken = hashParams.get("refresh_token") || "";
        const hashType = hashParams.get("type") || "";
        
        console.log("[Landing] Hash params:", { accessToken: !!accessToken, refreshToken: !!refreshToken, hashType });

        // Check redirect_to parameter (from Supabase 303 redirects) for preserved invite codes
        const redirectTo = searchParams.get("redirect_to") || "";
        let preservedInviteCode = inviteCode;
        if (redirectTo) {
          try {
            const redirectUrl = new URL(decodeURIComponent(redirectTo));
            const redirectCode = redirectUrl.searchParams.get("code") || redirectUrl.searchParams.get("invitationCode");
            if (redirectCode && !preservedInviteCode) {
              preservedInviteCode = redirectCode;
            }
          } catch (e) {
            // Invalid URL, ignore
          }
        }

        // PASSWORD RESET - handle both query param flow and hash fragment tokens
        // Supabase redirects with tokens in hash: #access_token=...&refresh_token=...&type=recovery
        if (flow === "recovery" || searchParams.get("type") === "recovery" || hashType === "recovery") {
          setMessage("Redirecting to password reset...");
          setStatus("done");
          
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          // If we have access tokens from hash, the session is already established by Supabase
          if (accessToken && refreshToken) {
            console.log("[Landing] Have tokens from hash, setting session...");
            
            // Set the session on web first (so it's available if user stays on web)
            try {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (error) {
                console.error("[Landing] Error setting session:", error);
              } else {
                console.log("[Landing] Session set successfully");
              }
            } catch (e) {
              console.error("[Landing] Error setting session:", e);
            }
            
            if (isMobile) {
              // Pass tokens to native app - it will use setSession to restore
              const resetParams = new URLSearchParams();
              resetParams.set('access_token', accessToken);
              resetParams.set('refresh_token', refreshToken);
              resetParams.set('type', 'recovery');
              
              setTimeout(() => {
                // Go directly to reset-password since we have tokens
                tryOpenApp(`(auth)/reset-password?${resetParams.toString()}`);
              }, 500);
            } else {
              // For web, redirect to reset-password page
              setTimeout(() => {
                router.replace('/reset-password');
              }, 500);
            }
            return;
          }
          
          // Fallback: No tokens yet, try to pass code/token_hash for exchange
          const resetParams = new URLSearchParams();
          if (tokenHash) resetParams.set('token_hash', tokenHash);
          const code = searchParams.get("code");
          if (code) resetParams.set('code', code);
          resetParams.set('type', 'recovery');
          
          if (isMobile) {
            setTimeout(() => {
              // Route through auth-callback to exchange code
              tryOpenApp(`auth-callback?${resetParams.toString()}`);
            }, 500);
          } else {
            setTimeout(() => {
              router.replace(`/reset-password?${resetParams.toString()}`);
            }, 500);
          }
          return;
        }

        // EMAIL CONFIRMATION
        if ((flow === "email-confirm" || searchParams.get("type") === "email" || searchParams.get("type") === "signup") && tokenHash) {
          setMessage("Verifying your email...");
          try {
            const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
            if (error) throw error;
            
            // Sign out on web so user signs in fresh in the app
            await supabase.auth.signOut();
            
            setMessage("Email verified! Opening the app...");
            setStatus("done");
            
            // Deep link to the native app for sign-in (preserve invite code if present)
            setTimeout(() => {
              const inviteParam = preservedInviteCode ? `&invitationCode=${encodeURIComponent(preservedInviteCode)}` : "";
              tryOpenApp(`(auth)/sign-in?emailVerified=true${inviteParam}`);
            }, 1500);
            return;
          } catch (e: any) {
            setStatus("error");
            setMessage(e?.message || "Email verification failed.");
            setTimeout(() => {
              tryOpenApp("(auth)/sign-in?emailVerificationFailed=true");
            }, 2000);
            return;
          }
        }

        // PARENT INVITE (use preserved invite code if available)
        const finalInviteCode = preservedInviteCode || inviteCode;
        if (flow === "invite-parent" && finalInviteCode) {
          setMessage("Opening the app for parent registration...");
          setStatus("ready");
          tryOpenApp(`/screens/parent-registration?invitationCode=${encodeURIComponent(finalInviteCode)}`);
          return;
        }

        // STUDENT/MEMBER INVITE (use preserved invite code if available)
        if ((flow === "invite-student" || flow === "invite-member") && finalInviteCode) {
          setMessage("Opening the app to join by code...");
          setStatus("ready");
          tryOpenApp(`/screens/student-join-by-code?code=${encodeURIComponent(finalInviteCode)}`);
          return;
        }

        // Default
        setMessage("Opening the app...");
        setStatus("ready");
        tryOpenApp("/");
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message || "Something went wrong.");
      }
    };
    run();
  }, [searchParams, router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24, background: "#0a0a0f", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      {(status === "loading" || status === "done") && (
        <div style={{ width: 40, height: 40, border: "4px solid #00f5ff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      )}

      {message && (
        <p style={{ textAlign: "center", fontSize: 16, marginBottom: 8 }}>{message}</p>
      )}

      {status === "done" && (
        <p style={{ color: "#22c55e", textAlign: "center", fontSize: 14, marginTop: 8 }}>
          ✓ Opening app automatically...
        </p>
      )}

      {(status === "ready" || status === "error") && (
        <>
          <button
            onClick={() => {
              const path = searchParams.get("token_hash") ? "(auth)/sign-in?emailVerified=true" : "/";
              tryOpenApp(path);
            }}
            style={{ background: "#00f5ff", color: "#000", padding: "12px 24px", borderRadius: 8, border: 0, fontSize: 16, fontWeight: 800, cursor: "pointer", marginTop: 8 }}
          >
            Open EduDash Pro App
          </button>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <p style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 8 }}>Don't have the app yet?</p>
            <a href={playStoreUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#00f5ff", textDecoration: "underline", fontSize: 14, fontWeight: 600 }}>
              Install from Google Play
            </a>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f" }}>
      <div style={{ width: 40, height: 40, border: "4px solid #00f5ff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LandingInner />
    </Suspense>
  );
}
