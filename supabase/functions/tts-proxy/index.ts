/**
 * TTS Proxy Edge Function
 *
 * - Generates speech audio via Azure Speech Services (Neural TTS)
 * - Returns a public audio URL stored in Supabase Storage
 * - Requires authenticated requests (Bearer token)
 *
 * Request body (supports multiple client shapes):
 * {
 *   action?: 'synthesize',
 *   text: string,
 *   language?: 'en'|'af'|'zu'|'xh'|'nso'|...,
 *   lang?: string,
 *   voice_id?: string,
 *   speaking_rate?: number, // -50..50
 *   rate?: number,
 *   pitch?: number,         // -50..50
 *   format?: 'mp3'|'wav',
 *   style?: string,
 *   phonics_mode?: boolean
 * }
 */

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

const DEFAULT_BUCKET = 'tts-audio';

const LANG_TO_BCP47: Record<string, string> = {
  en: 'en-ZA',
  af: 'af-ZA',
  zu: 'zu-ZA',
  xh: 'xh-ZA',
  nso: 'nso-ZA',
};

const DEFAULT_VOICES: Record<string, string> = {
  'en-ZA': 'en-ZA-LeahNeural',
  'af-ZA': 'af-ZA-AdriNeural',
  'zu-ZA': 'zu-ZA-ThandoNeural',
  'xh-ZA': 'xh-ZA-NomalungaNeural',
  'nso-ZA': 'nso-ZA-DidiNeural',
};

const LETTER_IPA: Record<string, { ipa: string; sound: string }> = {
  a: { ipa: 'æ', sound: 'ah' },
  b: { ipa: 'b', sound: 'buh' },
  c: { ipa: 'k', sound: 'kuh' },
  d: { ipa: 'd', sound: 'duh' },
  e: { ipa: 'ɛ', sound: 'eh' },
  f: { ipa: 'f', sound: 'fff' },
  g: { ipa: 'g', sound: 'guh' },
  h: { ipa: 'h', sound: 'hhh' },
  i: { ipa: 'ɪ', sound: 'ih' },
  j: { ipa: 'dʒ', sound: 'juh' },
  k: { ipa: 'k', sound: 'kuh' },
  l: { ipa: 'l', sound: 'lll' },
  m: { ipa: 'm', sound: 'mmm' },
  n: { ipa: 'n', sound: 'nnn' },
  o: { ipa: 'ɒ', sound: 'aw' },
  p: { ipa: 'p', sound: 'puh' },
  q: { ipa: 'k', sound: 'kuh' },
  r: { ipa: 'ɹ', sound: 'rrr' },
  s: { ipa: 's', sound: 'sss' },
  t: { ipa: 't', sound: 'tuh' },
  u: { ipa: 'ʌ', sound: 'uh' },
  v: { ipa: 'v', sound: 'vvv' },
  w: { ipa: 'w', sound: 'wuh' },
  x: { ipa: 'ks', sound: 'ks' },
  y: { ipa: 'j', sound: 'yuh' },
  z: { ipa: 'z', sound: 'zzz' },
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function phonemeTag(letter: string): string {
  const key = String(letter || '').toLowerCase();
  const entry = LETTER_IPA[key];
  if (!entry) return escapeXml(letter);
  return `<phoneme alphabet="ipa" ph="${escapeXml(entry.ipa)}">${escapeXml(entry.sound)}</phoneme>`;
}

function buildBlendSSML(blend: string): string {
  const letters = String(blend || '')
    .toLowerCase()
    .split('-')
    .map((v) => v.trim())
    .filter(Boolean);

  if (letters.length < 2 || letters.some((v) => v.length !== 1)) {
    return escapeXml(blend);
  }

  const segmented = letters
    .map((letter) => `${phonemeTag(letter)}<break time="400ms"/>`)
    .join(' ');

  return `${segmented}<break time="450ms"/>${escapeXml(letters.join(''))}`;
}

function convertPhonicsMarkersToSSML(rawText: string): string {
  let text = escapeXml(rawText || '');

  // /b/ markers
  text = text.replace(/\/([a-z])\//gi, (_, letter: string) => phonemeTag(letter));
  // [b] markers
  text = text.replace(/\[([a-z])\]/gi, (_, letter: string) => phonemeTag(letter));
  // c-a-t markers
  text = text.replace(/\b([a-z](?:-[a-z]){1,7})\b/gi, (match) => buildBlendSSML(match));

  return text;
}

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

function normalizeLanguage(raw?: string): { short: string; bcp47: string } {
  const lower = (raw || 'en').toLowerCase();
  const short = lower.split('-')[0];
  const bcp47 = LANG_TO_BCP47[short] || 'en-ZA';
  return { short, bcp47 };
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return jsonResponse(200, { status: 'ok', service: 'tts-proxy' });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const speechKey = (Deno.env.get('AZURE_SPEECH_KEY') || '').trim();
    const speechRegion = (Deno.env.get('AZURE_SPEECH_REGION') || '').trim();
    const bucket = (Deno.env.get('TTS_BUCKET') || DEFAULT_BUCKET).trim();

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse(500, { error: 'Supabase service role not configured' });
    }

    if (!speechKey || !speechRegion) {
      return jsonResponse(503, {
        error: 'Azure Speech not configured',
        fallback: 'device',
      });
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer', '').trim();
    if (!token) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse(401, { error: 'Invalid token' });
    }

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) {
      return jsonResponse(400, { error: 'Invalid JSON body' });
    }

    const text = String(body.text || '').trim();
    if (!text) {
      return jsonResponse(400, { error: 'Missing text' });
    }

    const languageRaw = String(body.language || body.lang || 'en');
    const { short: language, bcp47 } = normalizeLanguage(languageRaw);
    const voiceId = String(body.voice_id || body.voiceId || body.voice || '').trim() || DEFAULT_VOICES[bcp47];

    // Debug logging for language/voice selection
    console.log('[TTS] Language detection:', {
      raw: languageRaw,
      normalized: language,
      bcp47,
      selectedVoice: voiceId,
      textPreview: text.substring(0, 50),
    });

    const phonicsMode = body.phonics_mode === true;

    const hasExplicitRate = typeof body.speaking_rate === 'number' || typeof body.rate === 'number';
    const speakingRateRaw = Number(body.speaking_rate ?? body.rate ?? (phonicsMode ? -25 : 0));
    const pitchRaw = Number(body.pitch ?? 0);
    const speakingRate = clampNumber(speakingRateRaw, -50, 50);
    const pitch = clampNumber(pitchRaw, -50, 50);

    const format = String(body.format || 'mp3').toLowerCase() === 'wav' ? 'wav' : 'mp3';
    const outputFormat = format === 'wav'
      ? 'riff-24khz-16bit-mono-pcm'
      : 'audio-24khz-96kbitrate-mono-mp3';

    const styleOverride = typeof body.style === 'string' ? body.style.trim() : '';
    const style = styleOverride || (phonicsMode ? 'friendly' : '');

    const ssmlText = phonicsMode ? convertPhonicsMarkersToSSML(text) : escapeXml(text);
    const prosody = `<prosody rate="${speakingRate}%" pitch="${pitch}%">${ssmlText}</prosody>`;
    const inner = style
      ? `<mstts:express-as style="${escapeXml(style)}">${prosody}</mstts:express-as>`
      : prosody;

    const ssml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${bcp47}">` +
      `<voice name="${voiceId}">${inner}</voice>` +
      `</speak>`;

    const azureEndpoint = `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const azureResp = await fetch(azureEndpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': speechKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': outputFormat,
        'User-Agent': 'edudashpro-tts-proxy',
      },
      body: ssml,
    });

    if (!azureResp.ok) {
      const errText = await azureResp.text();
      return jsonResponse(502, {
        error: 'Azure TTS request failed',
        provider: 'azure',
        details: errText,
      });
    }

    const contentHash = await sha256(
      `${text}|${language}|${voiceId}|${hasExplicitRate ? speakingRate : speakingRateRaw}|${pitch}|${outputFormat}|${phonicsMode ? 'phonics' : 'normal'}`
    );
    const extension = format;
    const objectPath = `tts/${userData.user.id}/${contentHash}.${extension}`;

    // Check if cached audio already exists
    const { data: existingFile } = await supabase.storage
      .from(bucket)
      .list(`tts/${userData.user.id}`, {
        search: `${contentHash}.${extension}`,
      });

    if (existingFile && existingFile.length > 0) {
      const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
      return jsonResponse(200, {
        provider: 'azure',
        audio_url: publicUrl,
        cache_hit: true,
        content_hash: contentHash,
        language,
        voice_id: voiceId,
      });
    }

    // Download audio buffer from Azure
    const audioBuffer = new Uint8Array(await azureResp.arrayBuffer());
    
    if (!audioBuffer || audioBuffer.length === 0) {
      return jsonResponse(502, {
        error: 'Azure returned empty audio buffer',
        provider: 'azure',
      });
    }

    // Upload to Supabase Storage
    const upload = await supabase.storage
      .from(bucket)
      .upload(objectPath, audioBuffer, {
        contentType: format === 'wav' ? 'audio/wav' : 'audio/mpeg',
        upsert: true,
        cacheControl: '3600',
      });

    if (upload.error) {
      console.error('[TTS-Proxy] Storage upload failed:', upload.error);
      return jsonResponse(500, {
        error: 'Failed to store audio',
        details: upload.error.message,
        fallback: 'device',
      });
    }

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;

    return jsonResponse(200, {
      provider: 'azure',
      audio_url: publicUrl,
      cache_hit: false,
      content_hash: contentHash,
      language,
      voice_id: voiceId,
      size_bytes: audioBuffer.length,
    });
  } catch (error) {
    return jsonResponse(500, {
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
