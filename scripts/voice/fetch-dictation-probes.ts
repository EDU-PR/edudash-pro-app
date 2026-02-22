#!/usr/bin/env tsx

import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  ensureDir,
  nowRunId,
  parseArgs,
  runArtifactsDir,
  writeCsv,
  writeJson,
} from './common';

type AiUsageRow = {
  id: string;
  created_at: string;
  user_id: string;
  feature_used: string;
  processing_time_ms: number | null;
  metadata: Record<string, any> | null;
};

function diffMs(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  return Math.max(0, endMs - startMs);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = (args['run-id'] as string) || nowRunId();
  const probeRunId = (args['probe-run-id'] as string) || '';
  const days = Number(args.days || 7);

  const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !serviceRole) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const outDir = runArtifactsDir(runId);
  await ensureDir(outDir);

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();
  const pageSize = 1000;
  let from = 0;
  const rows: AiUsageRow[] = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('ai_usage')
      .select('id, created_at, user_id, feature_used, processing_time_ms, metadata')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const chunk = (data || []) as AiUsageRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  const probes = rows
    .map((row) => {
      const requestMetadata = row.metadata?.request_metadata || row.metadata?.metadata?.request_metadata;
      const probe = requestMetadata?.voice_dictation_probe;
      if (!probe || typeof probe !== 'object') return null;

      if (probeRunId && probe.run_id !== probeRunId) return null;

      const sttStart = typeof probe.stt_start_at === 'string' ? probe.stt_start_at : undefined;
      const firstPartial = typeof probe.first_partial_at === 'string' ? probe.first_partial_at : undefined;
      const finalTranscript = typeof probe.final_transcript_at === 'string' ? probe.final_transcript_at : undefined;
      const commit = typeof probe.commit_at === 'string' ? probe.commit_at : undefined;

      return {
        usage_id: row.id,
        created_at: row.created_at,
        user_id: row.user_id,
        feature_used: row.feature_used,
        processing_time_ms: row.processing_time_ms,
        run_id: probe.run_id || null,
        platform: probe.platform || null,
        source: probe.source || null,
        turn_id: requestMetadata?.turn_id || null,
        detected_language: requestMetadata?.detected_language || null,
        stt_start_at: sttStart || null,
        first_partial_at: firstPartial || null,
        final_transcript_at: finalTranscript || null,
        commit_at: commit || null,
        stt_to_first_partial_ms: diffMs(sttStart, firstPartial),
        stt_to_final_transcript_ms: diffMs(sttStart, finalTranscript),
        stt_to_commit_ms: diffMs(sttStart, commit),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  await writeJson(path.join(outDir, 'dictation_probes.json'), {
    run_id: runId,
    probe_run_id: probeRunId || null,
    since,
    count: probes.length,
    probes,
  });

  await writeCsv(
    path.join(outDir, 'dictation_probes.csv'),
    [
      'usage_id',
      'created_at',
      'user_id',
      'feature_used',
      'processing_time_ms',
      'run_id',
      'platform',
      'source',
      'turn_id',
      'detected_language',
      'stt_start_at',
      'first_partial_at',
      'final_transcript_at',
      'commit_at',
      'stt_to_first_partial_ms',
      'stt_to_final_transcript_ms',
      'stt_to_commit_ms',
    ],
    probes,
  );

  console.log(`[voice-benchmark] fetched ${probes.length} dictation probes`);
  console.log(`[voice-benchmark] output: ${outDir}`);
}

main().catch((error) => {
  console.error('[voice-benchmark] fetch-dictation-probes failed:', error);
  process.exit(1);
});
