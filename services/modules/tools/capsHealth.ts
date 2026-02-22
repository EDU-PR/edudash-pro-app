import { logger } from '@/lib/logger';

export interface CAPSRpcHealthResult {
  ok: boolean;
  errorCode?: string;
  detail?: string;
}

export interface CAPSFoundationCoverageResult {
  ok: boolean;
  observedSubjects: string[];
  missingSubjects: string[];
  errorCode?: string;
  detail?: string;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorCode: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorCode)), timeoutMs)
    ),
  ]);
}

export function isCAPSSearchRow(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || row.id.trim().length === 0) return false;
  if (typeof row.title !== 'string' || row.title.trim().length === 0) return false;
  return true;
}

export async function checkCAPSRpcHealth(
  supabase: any,
  timeoutMs = 4000,
): Promise<CAPSRpcHealthResult> {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('search_caps_curriculum', {
        search_query: 'phonics',
        search_grade: null,
        search_subject: null,
        result_limit: 1,
      }),
      timeoutMs,
      'caps_rpc_timeout'
    ) as any;

    if (error) {
      return {
        ok: false,
        errorCode: String(error.code || 'caps_rpc_error'),
        detail: String(error.message || error),
      };
    }

    if (!Array.isArray(data)) {
      return {
        ok: false,
        errorCode: 'caps_rpc_shape_invalid',
        detail: 'RPC did not return an array payload',
      };
    }

    if (data.length > 0 && !isCAPSSearchRow(data[0])) {
      return {
        ok: false,
        errorCode: 'caps_rpc_shape_invalid',
        detail: 'RPC row missing id/title fields',
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorCode: String((error as Error)?.message || 'caps_rpc_exception'),
      detail: String((error as Error)?.message || error),
    };
  }
}

function normalizeSubject(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasRequiredSubject(subjects: string[], required: string): boolean {
  const needle = required.toLowerCase();
  return subjects.some((subject) => subject.includes(needle));
}

export async function checkFoundationPhaseCoverage(
  supabase: any,
  timeoutMs = 4000,
): Promise<CAPSFoundationCoverageResult> {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('caps_documents')
        .select('subject, grade')
        .or('grade.ilike.%r-3%,grade.ilike.%foundation%,grade.ilike.%grade r%,grade.ilike.%grade 1%,grade.ilike.%grade 2%,grade.ilike.%grade 3%')
        .limit(300),
      timeoutMs,
      'caps_foundation_timeout'
    ) as any;

    if (error) {
      return {
        ok: false,
        observedSubjects: [],
        missingSubjects: ['home language', 'mathematics', 'life skills'],
        errorCode: String(error.code || 'caps_foundation_query_error'),
        detail: String(error.message || error),
      };
    }

    const observedSubjects = Array.from(
      new Set(
        (Array.isArray(data) ? data : [])
          .map((row: any) => normalizeSubject(String(row?.subject || '')))
          .filter(Boolean)
      )
    );
    const requiredSubjects = ['home language', 'mathematics', 'life skills'];
    const missingSubjects = requiredSubjects.filter(
      (subject) => !hasRequiredSubject(observedSubjects, subject)
    );

    return {
      ok: missingSubjects.length === 0,
      observedSubjects,
      missingSubjects,
    };
  } catch (error) {
    return {
      ok: false,
      observedSubjects: [],
      missingSubjects: ['home language', 'mathematics', 'life skills'],
      errorCode: String((error as Error)?.message || 'caps_foundation_exception'),
      detail: String((error as Error)?.message || error),
    };
  }
}

export function logCAPSHealthWarnings(
  rpcHealth: CAPSRpcHealthResult,
  coverage: CAPSFoundationCoverageResult
): void {
  if (!rpcHealth.ok) {
    logger.warn('[CAPS Health] RPC unavailable', rpcHealth);
  }
  if (!coverage.ok) {
    logger.warn('[CAPS Health] Foundation Phase coverage gap detected', {
      missingSubjects: coverage.missingSubjects,
      observedSubjects: coverage.observedSubjects.slice(0, 12),
      errorCode: coverage.errorCode,
    });
  }
}
