/**
 * Transcribe Chunk Edge Function
 * 
 * Transcribes a single audio chunk using OpenAI Whisper API.
 * Used by the chunked-transcription system for real-time streaming transcription.
 * 
 * Expected body: FormData with:
 *   - audio: Blob (webm/ogg/mp3)
 *   - session_id: string
 *   - chunk_index: string (number)
 *   - language: string (e.g., 'en', 'af', 'zu')
 * Auth: Bearer token required
 * Returns: { transcript, provider }
 */

import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return handleCorsOptions(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Quota check — prevent free-tier abuse
    const environment = Deno.env.get('ENVIRONMENT') || 'production';
    const devBypass = Deno.env.get('AI_QUOTA_BYPASS') === 'true' &&
                      (environment === 'development' || environment === 'local');

    if (!devBypass) {
      const quota = await supabase.rpc('check_ai_usage_limit', {
        p_user_id: user.id,
        p_request_type: 'stt',
      });

      if (!quota.error) {
        const quotaData = quota.data as Record<string, unknown> | null;
        if (quotaData && typeof quotaData.allowed === 'boolean' && !quotaData.allowed) {
          return new Response(JSON.stringify({
            error: 'quota_exceeded',
            message: 'Speech-to-text usage quota exceeded for this billing period',
            details: quotaData,
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Parse FormData
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const sessionId = formData.get('session_id') as string;
    const chunkIndex = formData.get('chunk_index') as string;
    const language = (formData.get('language') as string) || 'en';

    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'Missing audio file' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[transcribe-chunk] Session ${sessionId}, chunk ${chunkIndex}, size ${audioFile.size}b, lang ${language}`);

    // Try OpenAI Whisper first, fallback to Deepgram
    let transcript = '';
    let provider = 'whisper';

    if (OPENAI_API_KEY) {
      try {
        const whisperForm = new FormData();
        whisperForm.append('file', audioFile, `chunk-${chunkIndex}.webm`);
        whisperForm.append('model', 'whisper-1');
        whisperForm.append('language', language);
        whisperForm.append('response_format', 'json');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: whisperForm,
        });

        if (response.ok) {
          const result = await response.json();
          transcript = result.text || '';
          provider = 'whisper';
        } else {
          const errText = await response.text();
          console.warn(`[transcribe-chunk] Whisper error ${response.status}:`, errText);
          throw new Error(`Whisper API error: ${response.status}`);
        }
      } catch (whisperErr) {
        console.warn('[transcribe-chunk] Whisper failed, trying Deepgram:', whisperErr);

        // Fallback to Deepgram
        if (DEEPGRAM_API_KEY) {
          const audioBuffer = await audioFile.arrayBuffer();
          const dgResponse = await fetch(
            `https://api.deepgram.com/v1/listen?language=${language}&model=nova-2&smart_format=true`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Token ${DEEPGRAM_API_KEY}`,
                'Content-Type': audioFile.type || 'audio/webm',
              },
              body: audioBuffer,
            }
          );

          if (dgResponse.ok) {
            const dgResult = await dgResponse.json();
            transcript = dgResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
            provider = 'deepgram';
          } else {
            throw new Error(`Deepgram error: ${dgResponse.status}`);
          }
        } else {
          throw whisperErr;
        }
      }
    } else if (DEEPGRAM_API_KEY) {
      // Only Deepgram available
      const audioBuffer = await audioFile.arrayBuffer();
      const dgResponse = await fetch(
        `https://api.deepgram.com/v1/listen?language=${language}&model=nova-2&smart_format=true`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DEEPGRAM_API_KEY}`,
            'Content-Type': audioFile.type || 'audio/webm',
          },
          body: audioBuffer,
        }
      );

      if (dgResponse.ok) {
        const dgResult = await dgResponse.json();
        transcript = dgResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        provider = 'deepgram';
      } else {
        throw new Error(`Deepgram error: ${dgResponse.status}`);
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'No transcription provider configured (set OPENAI_API_KEY or DEEPGRAM_API_KEY)' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[transcribe-chunk] Done: chunk ${chunkIndex}, ${transcript.length} chars via ${provider}`);

    // Record usage (non-fatal)
    try {
      await supabase.rpc('record_ai_usage', {
        p_user_id: user.id,
        p_feature_used: 'stt',
        p_model_used: provider === 'whisper' ? 'whisper-1' : 'deepgram-nova-2',
        p_tokens_used: 0,
        p_request_tokens: 0,
        p_response_tokens: 0,
        p_success: true,
        p_metadata: {
          scope: 'transcribe_chunk',
          session_id: sessionId,
          chunk_index: chunkIndex,
          language,
          provider,
          text_length: transcript.length,
        },
      });
    } catch (usageErr) {
      console.warn('[transcribe-chunk] record_ai_usage failed (non-fatal):', usageErr);
    }

    return new Response(JSON.stringify({ transcript, provider }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[transcribe-chunk] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
