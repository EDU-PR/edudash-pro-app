/**
 * ingest-file
 *
 * Minimal ingestion queue endpoint used by AttachmentService.enqueueIngestion.
 * It validates auth + payload and returns a document_id for downstream OCR/RAG flows.
 */

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type IngestPayload = {
  user_id: string;
  conversation_id: string;
  bucket: string;
  storage_path: string;
  name: string;
  mime_type: string;
  size: number;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function validatePayload(raw: unknown): IngestPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;

  const payload: IngestPayload = {
    user_id: String(candidate.user_id || '').trim(),
    conversation_id: String(candidate.conversation_id || '').trim(),
    bucket: String(candidate.bucket || '').trim(),
    storage_path: String(candidate.storage_path || '').trim(),
    name: String(candidate.name || '').trim(),
    mime_type: String(candidate.mime_type || '').trim(),
    size: Number(candidate.size || 0),
  };

  if (!payload.user_id || !payload.conversation_id || !payload.bucket || !payload.storage_path) {
    return null;
  }
  if (!payload.name || !payload.mime_type || !Number.isFinite(payload.size) || payload.size < 0) {
    return null;
  }

  return payload;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceKey) {
      return json(503, { error: 'service_unconfigured' });
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer', '').trim();
    if (!token) {
      return json(401, { error: 'unauthorized' });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return json(401, { error: 'invalid_token' });
    }

    const rawBody = await req.json().catch(() => null);
    const payload = validatePayload(rawBody);
    if (!payload) {
      return json(400, { error: 'invalid_payload' });
    }

    // Guard against cross-user enqueue attempts.
    if (payload.user_id !== authData.user.id) {
      return json(403, { error: 'forbidden_user_mismatch' });
    }

    // Validate the referenced object exists in storage.
    const folder = payload.storage_path.includes('/')
      ? payload.storage_path.split('/').slice(0, -1).join('/')
      : '';
    const fileName = payload.storage_path.split('/').pop() || '';
    const { data: listed, error: listError } = await supabase.storage
      .from(payload.bucket)
      .list(folder, { search: fileName, limit: 1 });

    if (listError) {
      return json(404, {
        error: 'storage_lookup_failed',
        details: listError.message,
      });
    }

    const exists = Array.isArray(listed) && listed.some((item) => item.name === fileName);
    if (!exists) {
      return json(404, { error: 'file_not_found' });
    }

    const documentId = crypto.randomUUID();
    return json(200, {
      document_id: documentId,
      status: 'queued',
      queue: 'ingest-file',
      queued_at: new Date().toISOString(),
      bucket: payload.bucket,
      storage_path: payload.storage_path,
    });
  } catch (error) {
    return json(500, {
      error: 'ingest_file_failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

