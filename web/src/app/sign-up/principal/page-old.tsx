"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function PrincipalSignUpForm() {
  const router = useRouter();
  
  // Step 1: Personal/Account Info
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  
  // Step 2: Organization Details
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [planTier, setPlanTier] = useState("solo");
  const [billingEmail, setBillingEmail] = useState("");
  
  // Step 3: Organization Address
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("ZA");
  
  // Step 4: Campus/Branch Info
  const [campusName, setCampusName] = useState("");
  const [campusCode, setCampusCode] = useState("");
  const [campusAddress, setCampusAddress] = useState("");
  const [campusCapacity, setCampusCapacity] = useState("200");
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1); // 1: personal, 2: organization, 3: address, 4: campus

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

    if (!schoolName.trim()) {
      setError("School name is required");
      return;
    }

    setLoading(true);

    try {
      // Call the API endpoint to create the principal account and school
      const response = await fetch('/api/auth/sign-up-principal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          fullName,
          phoneNumber,
          schoolName,
          schoolAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      console.log('Principal account created:', data);

      // Redirect to email verification page
      router.push('/sign-up/verify-email?email=' + encodeURIComponent(email));
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style jsx global>{`
        body {
          overflow-x: hidden;
          max-width: 100vw;
        }
        @media (min-width: 640px) {
          .sign-up-container {
            padding: 20px !important;
            align-items: center !important;
          }
          .sign-up-card {
            max-width: 600px !important;
            border: 1px solid #1f1f23 !important;
            border-radius: 12px !important;
            padding: 40px !important;
          }
        }
      `}</style>
      <div className="sign-up-container" style={{ minHeight: "100vh", display: "flex", alignItems: "stretch", justifyContent: "center", background: "#0a0a0f", fontFamily: "system-ui, sans-serif", overflowX: "hidden", padding: "0" }}>
        <div className="sign-up-card" style={{ width: "100%", background: "#111113", padding: "24px", border: "none", boxSizing: "border-box", borderRadius: "0" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 32 }}>
              🏫
            </div>
            <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Register Your School</h1>
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Create a principal account to manage your school</p>
          </div>

          {/* Progress indicator */}
          <div style={{ display: "flex", gap: 8, marginBottom: 32, justifyContent: "center" }}>
            <div style={{ width: 40, height: 4, background: step >= 1 ? "#00f5ff" : "#2a2a2f", borderRadius: 2 }}></div>
            <div style={{ width: 40, height: 4, background: step >= 2 ? "#00f5ff" : "#2a2a2f", borderRadius: 2 }}></div>
          </div>

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {step === 1 && (
              <>
                <h3 style={{ color: "#fff", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Personal Information</h3>
                
                <div>
                  <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="John Doe"
                    style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="principal@school.com"
                    style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Phone Number *</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    placeholder="+27 12 345 6789"
                    style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Password *</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
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
                  <p style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>At least 8 characters</p>
                </div>

                <div>
                  <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Confirm Password *</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14 }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
                      setError("Please fill in all fields");
                      return;
                    }
                    if (password !== confirmPassword) {
                      setError("Passwords do not match");
                      return;
                    }
                    setError(null);
                    setStep(2);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "linear-gradient(135deg, #00f5ff 0%, #0088cc 100%)",
                    color: "#000",
                    border: 0,
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Next: School Information →
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <h3 style={{ color: "#fff", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>School Information</h3>
                
                <div>
                  <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>School Name *</label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    required
                    placeholder="e.g. Sunshine Preschool"
                    style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>School Address *</label>
                  <textarea
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    required
                    placeholder="123 Main Street, City, Province, Postal Code"
                    rows={3}
                    style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, resize: "vertical" }}
                  />
                </div>

                {error && (
                  <div style={{ padding: 12, background: "#7f1d1d", border: "1px solid #991b1b", borderRadius: 8 }}>
                    <p style={{ color: "#fca5a5", fontSize: 14, margin: 0 }}>{error}</p>
                  </div>
                )}

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      background: "#2a2a2f",
                      color: "#fff",
                      border: 0,
                      borderRadius: 8,
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      flex: 2,
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
                    {loading ? "Creating Account..." : "Complete Registration"}
                  </button>
                </div>
              </>
            )}
          </form>

          <div style={{ marginTop: 24, textAlign: "center", paddingTop: 24, borderTop: "1px solid #2a2a2f" }}>
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>
              Already have an account?{" "}
              <Link href="/sign-in" style={{ color: "#00f5ff", textDecoration: "none", fontWeight: 600 }}>
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function PrincipalSignUpPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f" }}>
        <div style={{ color: "#fff" }}>Loading...</div>
      </div>
    }>
      <PrincipalSignUpForm />
    </Suspense>
  );
}
