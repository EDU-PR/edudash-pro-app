/**
 * Azure Speech Token Edge Function
 *
 * Returns a short-lived token for Azure Speech SDK usage on web.
 * Requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION secrets.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return jsonResponse(200, { status: 'ok', service: 'azure-speech-token' });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const speechKey = (Deno.env.get('AZURE_SPEECH_KEY') || '').trim();
  const speechRegion = (Deno.env.get('AZURE_SPEECH_REGION') || '').trim();

  if (!speechKey || !speechRegion) {
    return jsonResponse(500, {
      error: 'Azure Speech not configured',
      details: 'Missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION',
    });
  }

  const tokenUrl = `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;

  try {
    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': speechKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return jsonResponse(502, {
        error: 'Azure token request failed',
        details: errText,
      });
    }

    const token = await resp.text();

    return jsonResponse(200, {
      token,
      region: speechRegion,
      expiresIn: 600,
    });
  } catch (error) {
    return jsonResponse(500, {
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
