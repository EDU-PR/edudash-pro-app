#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';

type Pattern = string | RegExp;

const ROOT = process.cwd();
const failures: string[] = [];

function abs(relPath: string): string {
  return path.join(ROOT, relPath);
}

function read(relPath: string): string {
  const full = abs(relPath);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing file: ${relPath}`);
  }
  return fs.readFileSync(full, 'utf8');
}

function count(content: string, pattern: Pattern): number {
  if (typeof pattern === 'string') {
    if (!pattern) return 0;
    return content.split(pattern).length - 1;
  }
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matches = content.match(new RegExp(pattern.source, flags));
  return matches ? matches.length : 0;
}

function expectContains(relPath: string, pattern: Pattern, label?: string) {
  const content = read(relPath);
  if (count(content, pattern) < 1) {
    failures.push(`${relPath}: expected to contain ${label || String(pattern)}`);
  }
}

function expectNotContains(relPath: string, pattern: Pattern, label?: string) {
  const content = read(relPath);
  if (count(content, pattern) > 0) {
    failures.push(`${relPath}: expected not to contain ${label || String(pattern)}`);
  }
}

function expectCountAtLeast(relPath: string, pattern: Pattern, min: number, label?: string) {
  const content = read(relPath);
  const found = count(content, pattern);
  if (found < min) {
    failures.push(
      `${relPath}: expected at least ${min} occurrences of ${label || String(pattern)}, found ${found}`
    );
  }
}

function checkReceiptMigrationSecurityAndCompatibility() {
  const file = 'supabase/migrations/20260220160000_harden_message_receipts_and_thread_summaries.sql';

  expectContains(file, 'CREATE OR REPLACE FUNCTION public.mark_message_as_read(message_id uuid, reader_id uuid)');
  expectContains(file, 'CREATE OR REPLACE FUNCTION public.mark_thread_messages_as_read(thread_id uuid, reader_id uuid)');
  expectContains(file, 'CREATE OR REPLACE FUNCTION public.mark_messages_delivered(');
  expectContains(file, 'p_thread_id uuid DEFAULT NULL');
  expectContains(file, 'p_user_id uuid DEFAULT NULL');
  expectContains(file, 'thread_id uuid DEFAULT NULL');
  expectContains(file, 'user_id uuid DEFAULT NULL');

  expectCountAtLeast(file, 'v_caller := auth.uid();', 3, 'auth.uid caller binding');
  expectCountAtLeast(file, 'IF NOT public.user_is_thread_participant(', 3, 'participant authorization checks');
  expectCountAtLeast(file, "SECURITY DEFINER", 4, 'SECURITY DEFINER on hardened functions');
  expectContains(file, "RAISE EXCEPTION 'reader_id must match auth.uid()'");
  expectContains(file, "RAISE EXCEPTION 'user_id must match auth.uid()'");

  expectContains(file, 'GRANT EXECUTE ON FUNCTION public.mark_messages_delivered(uuid, uuid, uuid, uuid) TO authenticated;');
  expectContains(file, 'CREATE OR REPLACE FUNCTION public.get_my_message_threads_summary()');
}

function checkCanonicalTeacherRealtimeArgs() {
  const file = 'hooks/messaging/useTeacherMessagesRealtime.ts';
  expectContains(
    file,
    /rpc\('mark_messages_delivered',\s*\{\s*p_thread_id:\s*threadId,\s*p_user_id:\s*user\?\.id,\s*\}\)/s,
    'canonical mark_messages_delivered args in teacher realtime hook'
  );
  expectNotContains(
    file,
    /rpc\('mark_messages_delivered',\s*\{\s*thread_id\s*:/s,
    'legacy mark_messages_delivered arg names in teacher realtime hook'
  );
}

function checkWebDeliveredAndReadFlow() {
  const pages = [
    'web/src/app/dashboard/parent/messages/page.tsx',
    'web/src/app/dashboard/teacher/messages/page.tsx',
    'web/src/app/dashboard/principal/messages/page.tsx',
  ];

  for (const file of pages) {
    expectContains(
      file,
      /await\s+supabase\.rpc\('mark_messages_delivered',\s*\{\s*p_thread_id:\s*threadId,\s*p_user_id:\s*userId,\s*\}\)/s,
      'mark delivered when opening thread'
    );
    expectContains(
      file,
      /\.rpc\('mark_messages_delivered',\s*\{\s*p_thread_id:\s*selectedThreadId,\s*p_user_id:\s*userId\s*\}\)/s,
      'mark delivered on realtime incoming message'
    );
    expectContains(
      file,
      /\.rpc\('mark_thread_messages_as_read',\s*\{\s*thread_id:\s*selectedThreadId,\s*reader_id:\s*userId\s*\}\)/s,
      'mark read on realtime incoming message'
    );
  }
}

function checkMessageUpdateSubscriptions() {
  const pages = [
    'web/src/app/dashboard/parent/messages/page.tsx',
    'web/src/app/dashboard/teacher/messages/page.tsx',
    'web/src/app/dashboard/principal/messages/page.tsx',
  ];

  for (const file of pages) {
    expectContains(
      file,
      /event:\s*'UPDATE'[\s\S]{0,260}table:\s*'messages'/s,
      'realtime UPDATE subscription on messages'
    );
    expectContains(file, 'delivered_at: updated.delivered_at', 'delivered_at merged from UPDATE payload');
    expectContains(file, 'read_by: updated.read_by', 'read_by merged from UPDATE payload');
  }
}

function checkThreadAndMessageContracts() {
  const typeFile = 'web/src/lib/messaging/types.ts';
  expectContains(typeFile, 'delivered_at?: string | null;');
  expectContains(typeFile, 'read_by?: string[] | null;');

  const threadAndBubbleFiles = [
    'web/src/components/messaging/ThreadList.tsx',
    'web/src/components/messaging/ChatMessageBubble.tsx',
  ];
  for (const file of threadAndBubbleFiles) {
    expectContains(file, 'read_by');
    expectContains(file, 'delivered_at');
    expectNotContains(file, 'read_at', 'stale read_at tick logic');
  }
}

function checkLastMessageFetchFields() {
  const pages = [
    'web/src/app/dashboard/parent/messages/page.tsx',
    'web/src/app/dashboard/teacher/messages/page.tsx',
    'web/src/app/dashboard/principal/messages/page.tsx',
  ];
  for (const file of pages) {
    expectContains(file, 'last_message_delivered_at', 'summary includes delivered_at field');
    expectContains(file, 'last_message_read_by', 'summary includes read_by field');
    expectContains(file, 'delivered_at: summary.last_message_delivered_at', 'maps delivered_at from summary');
    expectContains(file, 'read_by: summary.last_message_read_by', 'maps read_by from summary');
  }
}

function checkRpcOnlyReceiptHooksWithTelemetry() {
  const file = 'hooks/parent-messaging/useReadReceipts.ts';
  expectCountAtLeast(file, "rpc('mark_messages_delivered'", 2, 'delivered RPC usage');
  expectContains(file, "rpc('mark_thread_messages_as_read'", 'read RPC usage');
  expectContains(file, "track('edudash.messaging.receipt_rpc_failed'", 'receipt RPC failure telemetry');
  expectNotContains(file, ".from('messages').update(", 'direct messages table fallback writes');
}

function checkAggregatedThreadSummaryUsage() {
  const pages = [
    'web/src/app/dashboard/parent/messages/page.tsx',
    'web/src/app/dashboard/teacher/messages/page.tsx',
    'web/src/app/dashboard/principal/messages/page.tsx',
  ];

  for (const file of pages) {
    expectContains(
      file,
      /rpc\(\s*'get_my_message_threads_summary'/s,
      'aggregated summary RPC usage'
    );
    expectNotContains(file, 'threadsWithDetails = await Promise.all(', 'N+1 per-thread summary queries');
  }
}

function main() {
  checkReceiptMigrationSecurityAndCompatibility();
  checkCanonicalTeacherRealtimeArgs();
  checkWebDeliveredAndReadFlow();
  checkMessageUpdateSubscriptions();
  checkThreadAndMessageContracts();
  checkLastMessageFetchFields();
  checkRpcOnlyReceiptHooksWithTelemetry();
  checkAggregatedThreadSummaryUsage();

  if (failures.length > 0) {
    console.error('Read-receipts rollout verification failed.');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Read-receipts rollout verification passed.');
}

main();
