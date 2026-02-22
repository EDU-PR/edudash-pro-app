#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

type CheckResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

function isAuthOrPermissionError(detail: string): boolean {
  const normalized = detail.toLowerCase();
  return (
    normalized.includes('authentication required') ||
    normalized.includes('jwt') ||
    normalized.includes('permission denied') ||
    normalized.includes('not authorized')
  );
}

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

function printResult(result: CheckResult) {
  const badge = result.ok ? 'OK' : 'MISSING';
  const suffix = result.detail ? ` - ${result.detail}` : '';
  console.log(`[${badge}] ${result.name}${suffix}`);
}

async function checkRpc(
  supabase: ReturnType<typeof createClient>,
  name: string,
  payload: Record<string, unknown>
): Promise<CheckResult> {
  try {
    const { error } = await supabase.rpc(name, payload);
    if (error) {
      const detail = String(error.message || error.code || error);
      if (isAuthOrPermissionError(detail)) {
        return {
          name: `rpc.${name}`,
          ok: true,
          detail: `reachable (${detail})`,
        };
      }
      return {
        name: `rpc.${name}`,
        ok: false,
        detail,
      };
    }
    return { name: `rpc.${name}`, ok: true };
  } catch (error) {
    const detail = String((error as Error)?.message || error);
    if (isAuthOrPermissionError(detail)) {
      return {
        name: `rpc.${name}`,
        ok: true,
        detail: `reachable (${detail})`,
      };
    }
    return {
      name: `rpc.${name}`,
      ok: false,
      detail,
    };
  }
}

async function checkTable(
  supabase: ReturnType<typeof createClient>,
  name: string
): Promise<CheckResult> {
  try {
    const { error } = await supabase.from(name).select('*', { head: true, count: 'exact' }).limit(1);
    if (error) {
      return {
        name: `table.${name}`,
        ok: false,
        detail: String(error.message || error.code || error),
      };
    }
    return { name: `table.${name}`, ok: true };
  } catch (error) {
    return {
      name: `table.${name}`,
      ok: false,
      detail: String((error as Error)?.message || error),
    };
  }
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      'Missing Supabase env. Set EXPO_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
    process.exit(2);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const checks: CheckResult[] = [];
  checks.push(
    await checkRpc(supabase, 'search_caps_curriculum', {
      search_query: 'phonics',
      search_grade: null,
      search_subject: null,
      result_limit: 1,
    })
  );
  checks.push(
    await checkRpc(supabase, 'get_daily_media_budget', {
      p_feature: 'auto_scan',
      p_tier: 'free',
    })
  );
  checks.push(
    await checkRpc(supabase, 'consume_daily_media_budget', {
      p_feature: 'auto_scan',
      p_amount: 0,
      p_tier: 'free',
    })
  );
  checks.push(await checkTable(supabase, 'caps_documents'));
  checks.push(await checkTable(supabase, 'daily_media_usage'));

  for (const check of checks) {
    printResult(check);
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    console.error(`\nRuntime prerequisites failed (${failed.length}).`);
    process.exit(1);
  }

  console.log('\nAll Dash runtime prerequisites are available.');
}

main().catch((error) => {
  console.error('Runtime prerequisite check failed:', error);
  process.exit(1);
});
