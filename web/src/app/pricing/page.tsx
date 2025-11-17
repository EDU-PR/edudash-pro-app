"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";

type UserType = "parents" | "schools";

export default function PricingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userType, setUserType] = useState<UserType>("parents");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOnTrial, setIsOnTrial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndTrial = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      if (session) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || null);
        setUserName(session.user.user_metadata?.full_name || null);
        
        try {
          const { data: trialData } = await supabase.rpc('get_my_trial_status');
          setIsOnTrial(trialData?.is_trial || false);
        } catch (err) {
          console.debug('Trial check failed:', err);
        }
      }
      setLoading(false);
    };
    checkAuthAndTrial();
  }, [supabase]);

  const handleSubscribe = async (planName: string, price: number) => {
    if (!isLoggedIn) {
      router.push('/sign-in?redirect=/pricing');
      return;
    }

    if (!userId || !userEmail) {
      alert('Please log in to subscribe');
      return;
    }

    if (price === 0) {
      router.push('/dashboard/parent');
      return;
    }

    // Map plan names to tiers
    const tierMap: Record<string, 'parent_starter' | 'parent_plus' | 'school_starter' | 'school_premium' | 'school_pro'> = {
      'Parent Starter': 'parent_starter',
      'Parent Plus': 'parent_plus',
      'Starter Plan': 'school_starter',
      'Premium Plan': 'school_premium',
      'Enterprise Plan': 'school_pro',
    };

    const tier = tierMap[planName];
    if (!tier) {
      alert('Invalid plan selected');
      return;
    }

    setProcessingPayment(planName);

    try {
      // Get current session for auth token
      console.log('[Pricing] Starting payment flow...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('[Pricing] Initial session check:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        hasAccessToken: !!session?.access_token,
        tokenPreview: session?.access_token?.substring(0, 20),
        sessionError: sessionError?.message,
        expiresAt: session?.expires_at
      });
      
      // If no session, try to refresh
      if (!session || sessionError) {
        console.log('[Pricing] No session found, attempting refresh...');
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        console.log('[Pricing] Refresh result:', {
          hasRefreshedSession: !!refreshedSession,
          refreshError: refreshError?.message
        });
        
        if (refreshError || !refreshedSession) {
          console.error('[Pricing] Session refresh failed:', refreshError);
          alert('Your session has expired. Please sign in again.');
          router.push('/sign-in?redirect=/pricing');
          setProcessingPayment(null);
          return;
        }
      }

      // Get the latest session
      const { data: { session: finalSession } } = await supabase.auth.getSession();
      
      console.log('[Pricing] Final session check:', {
        hasFinalSession: !!finalSession,
        hasAccessToken: !!finalSession?.access_token,
        tokenLength: finalSession?.access_token?.length
      });
      
      if (!finalSession?.access_token) {
        console.error('[Pricing] No access token available');
        alert('Please log in to continue');
        router.push('/sign-in?redirect=/pricing');
        setProcessingPayment(null);
        return;
      }

      // Call secure API endpoint to create payment
      console.log('[Pricing] Calling create-payment API...');
      const response = await fetch('/api/payfast/create-payment', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${finalSession.access_token}`
        },
        body: JSON.stringify({
          user_id: userId,
          tier: tier,
          amount: price,
          email: userEmail,
          firstName: userName?.split(' ')[0] || userEmail.split('@')[0],
          lastName: userName?.split(' ').slice(1).join(' ') || 'User',
          itemName: planName,
          itemDescription: `${planName} subscription`,
          subscriptionType: '1', // Subscription
          frequency: '3', // Monthly
          cycles: '0', // Until cancelled
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to create payment');
      }

      // Redirect to PayFast payment page
      if (data.payment_url) {
        console.log('[Pricing] Redirecting to PayFast:', data.mode);
        window.location.href = data.payment_url;
      } else {
        throw new Error('No payment URL received');
      }
    } catch (error) {
      console.error('[Pricing] Payment failed:', error);
      alert('Failed to initiate payment. Please try again.');
      setProcessingPayment(null);
    }
  };

  const parentPlans = [
    {
      name: "Free",
      price: 0,
      priceAnnual: 0,
      popular: false,
      features: [
        "10 AI queries/month",
        "Basic homework help",
        "Child progress tracking",
        "Teacher messaging",
        "Email support"
      ]
    },
    {
      name: "Parent Starter",
      price: 49.50,
      originalPrice: 99.00,
      priceAnnual: 475.00,
      popular: true,
      features: [
        "30 Homework Helper/month",
        "AI lesson support",
        "Child-safe explanations",
        "Progress tracking",
        "Email support",
        ...(isOnTrial ? [] : ["7-day free trial"])
      ]
    },
    {
      name: "Parent Plus",
      price: 99.50,
      originalPrice: 199.00,
      priceAnnual: 955.00,
      popular: false,
      features: [
        "100 Homework Helper/month",
        "Priority processing",
        "Up to 3 children",
        "Advanced learning insights",
        "Priority support",
        "WhatsApp Connect",
        "Learning Resources",
        "Progress Analytics"
      ]
    }
  ];

  const schoolPlans = [
    {
      name: "Free Plan",
      price: 0,
      priceAnnual: 0,
      popular: false,
      features: [
        "Basic dashboard",
        "Student management",
        "Parent communication",
        "Basic reporting"
      ]
    },
    {
      name: "Starter Plan",
      price: 299,
      priceAnnual: 2990,
      popular: true,
      features: [
        "Essential features",
        "AI-powered insights",
        "Parent portal",
        "WhatsApp notifications",
        "Email support",
        ...(isOnTrial ? [] : ["7-day free trial"])
      ]
    },
    {
      name: "Premium Plan",
      price: 599,
      priceAnnual: 5990,
      popular: false,
      features: [
        "All Starter features",
        "Advanced reporting",
        "Priority support",
        "Custom branding",
        "API access",
        "Advanced analytics"
      ]
    },
    {
      name: "Enterprise Plan",
      price: null,
      priceAnnual: null,
      popular: false,
      features: [
        "All Premium features",
        "Unlimited users",
        "Dedicated success manager",
        "SLA guarantee",
        "White-label solution",
        "Custom integrations",
        "24/7 priority support"
      ]
    }
  ];

  const activePlans = userType === "parents" ? parentPlans : schoolPlans;

  return (
    <>
      <style jsx global>{`
        body {
          overflow-x: hidden;
          max-width: 100vw;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        {/* Header */}
        <header style={{ position: "sticky", top: 0, zIndex: 1000, background: "rgba(10, 10, 15, 0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link href="/" style={{ fontSize: "18px", fontWeight: 700, textDecoration: "none", color: "#fff" }}>🎓 EduDash Pro</Link>
            {isLoggedIn ? (
              <button
                onClick={() => router.push('/dashboard/parent')}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#00f5ff",
                  background: "transparent",
                  border: "1px solid #00f5ff",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </button>
            ) : (
              <Link href="/sign-in" style={{ color: "#00f5ff", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>Sign In</Link>
            )}
          </div>
        </header>

        {/* PROMO BANNER */}
        {userType === "parents" && (
          <div style={{ 
            background: "linear-gradient(135deg, rgb(99, 102, 241) 0%, rgb(139, 92, 246) 100%)",
            padding: "20px",
            textAlign: "center" as const,
            borderBottom: "2px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 4px 20px rgba(139, 92, 246, 0.4)"
          }}>
            <div style={{ maxWidth: "900px", margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", flexWrap: "wrap" as const }}>
                <span style={{ fontSize: "32px" }}>🔥</span>
                <div>
                  <p style={{ fontSize: "clamp(18px, 3vw, 24px)", fontWeight: 800, margin: 0, color: "#fff", textTransform: "uppercase" as const, letterSpacing: "0.05em", textShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
                    LAUNCH SPECIAL: 50% OFF FOR 6 MONTHS!
                  </p>
                  <p style={{ fontSize: "clamp(13px, 2vw, 16px)", margin: "6px 0 0", color: "rgba(255, 255, 255, 0.95)", fontWeight: 600 }}>
                    🎁 Join before Dec 31, 2025 • R49.50/mo (was R99) or R99.50/mo (was R199) for 6 months
                  </p>
                </div>
                <span style={{ fontSize: "32px" }}>⚡</span>
              </div>
            </div>
          </div>
        )}

        {/* Hero */}
        <section style={{ paddingTop: "60px", paddingBottom: "40px", textAlign: "center", maxWidth: "900px", margin: "0 auto", padding: "60px 20px 40px" }}>
          <div style={{ marginBottom: "16px" }}>
            <span style={{ display: "inline-block", padding: "6px 16px", background: "rgba(0, 245, 255, 0.1)", border: "1px solid rgba(0, 245, 255, 0.3)", borderRadius: "20px", fontSize: "12px", color: "#00f5ff", fontWeight: 600 }}>🇿🇦 South African Pricing</span>
          </div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, marginBottom: "16px" }}>Choose Your Perfect Plan</h1>
          <p style={{ fontSize: "18px", color: "#9CA3AF", maxWidth: "600px", margin: "0 auto" }}>
            Transparent pricing for parents and schools across South Africa
          </p>
          
          {!isOnTrial && (
            <div style={{ marginTop: "32px", marginBottom: "24px", display: "inline-block", background: "rgba(251, 191, 36, 0.15)", border: "2px solid #fbbf24", borderRadius: "12px", padding: "12px 24px" }}>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em" }}>🎉 7-Day Free Trial • No Credit Card Required</p>
            </div>
          )}
        </section>

        {/* User Type Toggle */}
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px 40px" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "32px" }}>
            <button
              onClick={() => setUserType("parents")}
              style={{
                padding: "12px 32px",
                background: userType === "parents" ? "linear-gradient(135deg, #00f5ff 0%, #0080ff 100%)" : "rgba(255, 255, 255, 0.05)",
                color: userType === "parents" ? "#0a0a0f" : "#9CA3AF",
                border: userType === "parents" ? "2px solid #00f5ff" : "2px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              👨‍👩‍👧 For Parents
            </button>
            <button
              onClick={() => setUserType("schools")}
              style={{
                padding: "12px 32px",
                background: userType === "schools" ? "linear-gradient(135deg, #00f5ff 0%, #0080ff 100%)" : "rgba(255, 255, 255, 0.05)",
                color: userType === "schools" ? "#0a0a0f" : "#9CA3AF",
                border: userType === "schools" ? "2px solid #00f5ff" : "2px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              🏫 For Schools
            </button>
          </div>

          {/* Billing Period Toggle */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginBottom: "48px" }}>
            <span style={{ color: billingPeriod === "monthly" ? "#fff" : "#6B7280", fontWeight: 600 }}>Monthly</span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "annual" : "monthly")}
              style={{
                width: "56px",
                height: "28px",
                background: billingPeriod === "annual" ? "#00f5ff" : "rgba(255, 255, 255, 0.2)",
                border: "none",
                borderRadius: "14px",
                position: "relative",
                cursor: "pointer",
                transition: "all 0.3s"
              }}
            >
              <div style={{
                width: "20px",
                height: "20px",
                background: "#fff",
                borderRadius: "50%",
                position: "absolute",
                top: "4px",
                left: billingPeriod === "annual" ? "32px" : "4px",
                transition: "all 0.3s"
              }} />
            </button>
            <span style={{ color: billingPeriod === "annual" ? "#fff" : "#6B7280", fontWeight: 600 }}>Annual <span style={{ color: "#22c55e", fontSize: "12px" }}>(Save 20%)</span></span>
          </div>

          {/* Pricing Cards */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
            gap: "24px",
            maxWidth: userType === "schools" && schoolPlans.length === 4 ? "1200px" : "900px",
            margin: "0 auto"
          }}>
            {activePlans.map((plan) => {
              const price = billingPeriod === "annual" ? plan.priceAnnual : plan.price;
              const isEnterprise = plan.price === null;
              const hasPromo = userType === "parents" && (plan as any).originalPrice;
              const originalPrice = (plan as any).originalPrice;
              
              return (
                <div
                  key={plan.name}
                  style={{
                    background: plan.popular ? "linear-gradient(135deg, #00f5ff 0%, #0080ff 100%)" : "#111113",
                    border: plan.popular ? "none" : "1px solid #1f1f23",
                    borderRadius: "16px",
                    padding: "32px 24px",
                    position: "relative",
                    textAlign: "center"
                  }}
                >
                  {plan.popular && (
                    <div style={{ position: "absolute", top: "-12px", left: "16px", background: "#fbbf24", color: "#0a0a0f", padding: "6px 20px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>Most Popular</div>
                  )}

                  {hasPromo && (
                    <div style={{ position: "absolute", top: "-12px", right: "16px", background: "rgb(139, 92, 246)", color: "#fff", padding: "6px 16px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", boxShadow: "0 4px 12px rgba(139, 92, 246, 0.4)" }}>
                      🔥 50% OFF
                    </div>
                  )}
                  
                  <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px", color: plan.popular ? "#0a0a0f" : "#fff" }}>
                    {plan.name}
                  </h3>
                  
                  <div style={{ marginBottom: "24px" }}>
                    {isEnterprise ? (
                      <>
                        <div style={{ fontSize: "36px", fontWeight: 800, color: plan.popular ? "#0a0a0f" : "#fff" }}>Custom</div>
                        <div style={{ fontSize: "14px", color: plan.popular ? "rgba(10, 10, 15, 0.7)" : "#6B7280" }}>Contact us for pricing</div>
                      </>
                    ) : price === 0 ? (
                      <>
                        <div style={{ fontSize: "48px", fontWeight: 800, color: plan.popular ? "#0a0a0f" : "#fff" }}>Free</div>
                        <div style={{ fontSize: "14px", color: plan.popular ? "rgba(10, 10, 15, 0.7)" : "#6B7280" }}>Forever</div>
                      </>
                    ) : (
                      <>
                        {hasPromo && originalPrice && (
                          <div style={{ marginBottom: "4px" }}>
                            <span style={{ fontSize: "18px", textDecoration: "line-through", color: plan.popular ? "rgba(10, 10, 15, 0.5)" : "rgba(255, 255, 255, 0.4)", fontWeight: 600 }}>
                              R{originalPrice.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div style={{ fontSize: "48px", fontWeight: 800, color: plan.popular ? "#0a0a0f" : "#fff" }}>
                          R{typeof price === "number" ? price.toFixed(price % 1 === 0 ? 0 : 2) : "0"}
                        </div>
                        <div style={{ fontSize: "14px", color: plan.popular ? "rgba(10, 10, 15, 0.7)" : "#6B7280" }}>
                          per {billingPeriod === "annual" ? "year" : "month"}
                        </div>
                        {hasPromo && originalPrice && (
                          <div style={{ marginTop: "8px", padding: "6px 12px", background: "rgba(34, 197, 94, 0.2)", borderRadius: "12px", display: "inline-block" }}>
                            <span style={{ fontSize: "14px", fontWeight: 700, color: plan.popular ? "#0a0a0f" : "#22c55e" }}>
                              💰 Save R{(originalPrice - (price as number)).toFixed(2)}/mo
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <ul style={{ listStyle: "none", padding: 0, marginBottom: "32px", textAlign: "left" }}>
                    {plan.features.map((feature, i) => (
                      <li key={i} style={{ 
                        marginBottom: "12px", 
                        display: "flex", 
                        alignItems: "flex-start", 
                        gap: "8px",
                        color: plan.popular ? "rgba(10, 10, 15, 0.9)" : "#D1D5DB",
                        fontSize: "14px",
                        lineHeight: 1.6
                      }}>
                        <span style={{ color: plan.popular ? "#0a0a0f" : "#00f5ff", fontSize: "16px" }}>✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isEnterprise ? (
                    <Link 
                      href="/contact"
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "14px",
                        background: plan.popular ? "#0a0a0f" : "linear-gradient(135deg, #00f5ff 0%, #0080ff 100%)",
                        color: plan.popular ? "#fff" : "#0a0a0f",
                        border: "none",
                        borderRadius: "10px",
                        fontSize: "16px",
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: "none",
                        textAlign: "center"
                      }}
                    >
                      Contact Sales
                    </Link>
                  ) : price === 0 ? (
                    <Link 
                      href={isLoggedIn ? "/dashboard/parent" : "/sign-in"}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "14px",
                        background: plan.popular ? "#0a0a0f" : "linear-gradient(135deg, #00f5ff 0%, #0080ff 100%)",
                        color: plan.popular ? "#fff" : "#0a0a0f",
                        border: "none",
                        borderRadius: "10px",
                        fontSize: "16px",
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: "none",
                        textAlign: "center"
                      }}
                    >
                      Get Started Free
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.name, price || 0)}
                      disabled={processingPayment === plan.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        width: "100%",
                        padding: "14px",
                        background: plan.popular ? "#0a0a0f" : "linear-gradient(135deg, #00f5ff 0%, #0080ff 100%)",
                        color: plan.popular ? "#fff" : "#0a0a0f",
                        border: "none",
                        borderRadius: "10px",
                        fontSize: "16px",
                        fontWeight: 700,
                        cursor: processingPayment === plan.name ? "not-allowed" : "pointer",
                        textDecoration: "none",
                        textAlign: "center",
                        opacity: processingPayment === plan.name ? 0.6 : 1,
                      }}
                    >
                      {processingPayment === plan.name ? (
                        <>
                          <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                          Processing...
                        </>
                      ) : !isLoggedIn ? (
                        "Sign In to Subscribe"
                      ) : (
                        "Subscribe Now"
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Trust Badges */}
          <div style={{ marginTop: "64px", textAlign: "center", padding: "32px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "16px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <p style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", color: "#fff" }}>✅ Why Choose EduDash Pro?</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "32px", fontSize: "14px", color: "#9CA3AF" }}>
              <span>🔒 Multi-tenant security</span>
              <span>🇿🇦 Built for South Africa</span>
              <span>💳 No credit card required</span>
              <span>⭐ Cancel anytime</span>
              <span>🚀 Instant setup</span>
            </div>
          </div>

          {/* FAQ Preview */}
          <div style={{ marginTop: "64px", maxWidth: "800px", margin: "64px auto 0" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 800, textAlign: "center", marginBottom: "32px" }}>Frequently Asked Questions</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <details style={{ background: "rgba(255, 255, 255, 0.02)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <summary style={{ fontSize: "16px", fontWeight: 700, cursor: "pointer" }}>Can I switch plans later?</summary>
                <p style={{ marginTop: "12px", color: "#9CA3AF", fontSize: "14px", lineHeight: 1.6 }}>
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </details>
              <details style={{ background: "rgba(255, 255, 255, 0.02)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <summary style={{ fontSize: "16px", fontWeight: 700, cursor: "pointer" }}>What payment methods do you accept?</summary>
                <p style={{ marginTop: "12px", color: "#9CA3AF", fontSize: "14px", lineHeight: 1.6 }}>
                  We accept all major credit/debit cards, EFT, and SnapScan. All payments are processed securely.
                </p>
              </details>
              <details style={{ background: "rgba(255, 255, 255, 0.02)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <summary style={{ fontSize: "16px", fontWeight: 700, cursor: "pointer" }}>Is my data safe?</summary>
                <p style={{ marginTop: "12px", color: "#9CA3AF", fontSize: "14px", lineHeight: 1.6 }}>
                  Absolutely. We comply with POPIA and use bank-level encryption. Your data is hosted securely in South Africa.
                </p>
              </details>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <section style={{ marginTop: "80px", padding: "80px 20px", background: "linear-gradient(135deg, #00f5ff 0%, #0080ff 100%)", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, marginBottom: "16px", color: "#0a0a0f" }}>Ready to Get Started?</h2>
          <p style={{ fontSize: "18px", marginBottom: "32px", color: "rgba(10,10,15,.75)", maxWidth: "600px", margin: "0 auto 32px" }}>
            Join hundreds of South African families and schools using EduDash Pro
          </p>
          <Link href="/sign-in" style={{ display: "inline-block", padding: "16px 32px", background: "#0a0a0f", color: "#fff", borderRadius: "12px", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}>
            Start Your 7-Day Free Trial →
          </Link>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", padding: "32px 20px", textAlign: "center" }}>
          <p style={{ color: "#6B7280", fontSize: "14px" }}>© 2025 EduDash Pro. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}
