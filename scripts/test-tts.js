const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

(async () => {
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const EMAIL = process.env.AUTH_EMAIL;
  const PASSWORD = process.env.AUTH_PASSWORD;
  if (!SUPABASE_URL || !ANON || !EMAIL || !PASSWORD) {
    console.error('Missing env: SUPABASE_URL, ANON, AUTH_EMAIL, AUTH_PASSWORD');
    process.exit(1);
  }
  const sb = createClient(SUPABASE_URL, ANON);
  const { data: { session }, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !session) { console.error('Auth failed', error); process.exit(2); }

  async function tts(text, language){
    const url = `${SUPABASE_URL}/functions/v1/tts-proxy`;
    const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ text, language }) });
    const json = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(json));
    return json;
  }

  console.log('Afrikaans test...');
  const af = await tts('Dit is ’n kort CAPS uittreksel vir toetsing.', 'af');
  console.log(af);

  console.log('isiZulu test...');
  const zu = await tts('Lena yisichazamazwi esifushane se-CAPS sokuhlola.', 'zu');
  console.log(zu);
})();
