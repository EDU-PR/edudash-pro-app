// Helper to build PayFast-compatible return/cancel URLs
// Uses Supabase Edge Function 'payments-bridge' which handles deep-linking back to the app
// This is more reliable than external Vercel bridges as Supabase Functions are always available

export function getPaymentsBaseUrl(): string {
  // Always use Supabase Functions (more reliable than external bridges)
  const supa = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (supa && /^https?:\/\//i.test(supa)) {
    return supa.replace(/\/$/, '') + '/functions/v1';
  }
  // Final fallback: production domain
  return 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1';
}

export function getReturnUrl(): string {
  const base = getPaymentsBaseUrl();
  // payments-bridge Edge Function handles /return path and deep-links to app
  return `${base}/payments-bridge/return`;
}

export function getCancelUrl(): string {
  const base = getPaymentsBaseUrl();
  // payments-bridge Edge Function handles /cancel path and deep-links to app
  return `${base}/payments-bridge/cancel`;
}
