// Supabase Edge Function: payments-bridge
// Serves return/cancel bridge pages that deep-link back into the app
// Path examples:
//  - /functions/v1/payments-bridge/return
//  - /functions/v1/payments-bridge/cancel
// Optional query params are preserved and forwarded to the app deep link.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

function html(content: string, status = 200) {
  return new Response(content, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function buildDeepLink(path: 'return' | 'cancel', search: string) {
  // Use Universal Link (https) for better reliability, with custom scheme fallback
  // Expo Router will handle the routing when the app opens
  const universalLink = `https://www.edudashpro.org.za/landing?flow=payment-${path}${search ? '&' + search.substring(1) : ''}`;
  const customScheme = `edudashpro://screens/payments/${path}${search ? search : ''}`;
  
  // Return both - try Universal Link first, fallback to custom scheme
  return { universalLink, customScheme };
}

function page(title: string, message: string, links: { universalLink: string; customScheme: string }) {
  // Use Universal Link first (more reliable), with custom scheme fallback
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
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
    <a class="btn" href="${links.universalLink}" id="universalLink">Open EduDash Pro</a>
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
      return html(page(title, msg, links));
    }

    return html(page('Payments', 'Unknown payments action.', 'edudashpro://'), 404);
  } catch (e) {
    return html('<h1>Payments Bridge Error</h1>', 500);
  }
});
