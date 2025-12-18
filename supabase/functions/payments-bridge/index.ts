// Supabase Edge Function: payments-bridge
// Serves return/cancel bridge pages that deep-link back into the app
// Path examples:
//  - /functions/v1/payments-bridge/return
//  - /functions/v1/payments-bridge/cancel
// Optional query params are preserved and forwarded to the app deep link.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

function html(content: string, status = 200) {
  // NOTE: Supabase/edge/CDN layers may inject restrictive headers (e.g. CSP sandbox).
  // We still send explicit HTML headers for best-effort rendering in browsers.
  return new Response(content, {
    status,
    headers: {
      // Prefer canonical header casing (some intermediaries are picky)
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function buildDeepLink(path: 'return' | 'cancel', search: string) {
  // Use Universal Link (https) for better reliability, with custom scheme fallback
  // Expo Router will handle the routing when the app opens
  const universalLink = `https://www.edudashpro.org.za/landing?flow=payment-${path}${search ? '&' + search.substring(1) : ''}`;
  // IMPORTANT: Use triple-slash so the first path segment is not treated as the URL host on Android.
  // This ensures expo-linking/expo-router receive `screens/payments/...` as the actual path.
  const customScheme = `edudashpro:///screens/payments/${path}${search ? search : ''}`;
  
  // Return both - try Universal Link first, fallback to custom scheme
  return { universalLink, customScheme };
}

function escapeHtmlAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function page(title: string, message: string, links: { universalLink: string; customScheme: string }) {
  // Use Universal Link first (more reliable), with custom scheme fallback
  const safeUniversal = escapeHtmlAttr(links.universalLink);
  const safeCustom = escapeHtmlAttr(links.customScheme);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="refresh" content="0;url=${safeUniversal}" />
<title>${title}</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; margin: 0; background: #0b1220; color: #fff; display: grid; place-items: center; min-height: 100vh; }
  .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 24px; max-width: 560px; text-align: center; }
  .btn { display:inline-block; margin-top:16px; padding:12px 18px; background:#00f5ff; color:#000; border-radius:8px; font-weight:700; text-decoration:none; }
  .sub { opacity: .8; font-size: 14px; margin-top: 8px; }
  .loader { border: 4px solid #1f2937; border-top: 4px solid #00f5ff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>
</head>
<body>
  <div class="card">
    <div class="loader"></div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="sub">Redirecting to EduDash Pro...</p>
    <a class="btn" href="${safeUniversal}" id="universalLink">Open EduDash Pro</a>
    <div class="sub" style="margin-top:10px;">
      <a href="${safeCustom}" style="color:#00f5ff;">If needed, open via app link</a>
    </div>
    <p class="sub">If the app doesn't open automatically, tap the button above.</p>
  </div>
  <script>
    const universalLink = ${JSON.stringify(links.universalLink)};
    const customScheme = ${JSON.stringify(links.customScheme)};
    
    // Strategy 1: Try Universal Link first (works better on Android/iOS)
    window.location.replace(universalLink);
    
    // Strategy 2: Fallback to custom scheme after delay
    setTimeout(() => {
      try {
        window.location.href = customScheme;
      } catch (e) {
        console.log('Custom scheme failed:', e);
      }
    }, 500);
    
    // Strategy 3: Click the Universal Link button
    setTimeout(() => {
      const link = document.getElementById('universalLink');
      if (link) link.click();
    }, 300);
    
    // Strategy 4: Try custom scheme again
    setTimeout(() => {
      try {
        window.location.href = customScheme;
      } catch (e) {
        console.log('Custom scheme retry failed:', e);
      }
    }, 1000);
  </script>
</body>
</html>`;
}

function redirectOrHtml(location: string, content: string) {
  // Primary behavior: HTTP redirect to Universal Link.
  // This avoids reliance on JS execution (often blocked after payment providers redirect).
  return new Response(content, {
    status: 302,
    headers: {
      'Location': location,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

serve((req) => {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split('/');
    // Expect .../payments-bridge/<action>
    const action = (parts.pop() || '').toLowerCase();
    const search = url.search || '';

    if (action === 'return' || action === 'cancel') {
      const links = buildDeepLink(action as 'return' | 'cancel', search);
      const title = action === 'return' ? 'Payment Complete' : 'Payment Cancelled';
      const msg = action === 'return' ? 'Your payment was processed. Returning to EduDash Pro…' : 'Payment cancelled. Returning to EduDash Pro…';
      const content = page(title, msg, links);
      return redirectOrHtml(links.universalLink, content);
    }

    const unknownLinks = buildDeepLink('return', search);
    return html(page('Payments', 'Unknown payments action.', unknownLinks), 404);
  } catch (e) {
    return html('<h1>Payments Bridge Error</h1>', 500);
  }
});
