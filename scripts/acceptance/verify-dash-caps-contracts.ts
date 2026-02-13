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

function walkFiles(relDir: string, exts = new Set(['.ts', '.tsx', '.js', '.jsx'])): string[] {
  const start = abs(relDir);
  const out: string[] = [];
  const stack = [start];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (exts.has(path.extname(entry.name))) {
        out.push(path.relative(ROOT, full));
      }
    }
  }

  return out;
}

function findInTree(relDir: string, pattern: Pattern): Array<{ file: string; hits: number }> {
  const files = walkFiles(relDir);
  const hits: Array<{ file: string; hits: number }> = [];
  for (const file of files) {
    const content = read(file);
    const found = count(content, pattern);
    if (found > 0) {
      hits.push({ file, hits: found });
    }
  }
  return hits;
}

function checkNoLegacyEndpoint() {
  const offenders = findInTree('web/src', '/api/ai/chat');
  if (offenders.length > 0) {
    const detail = offenders.map((o) => `${o.file}(${o.hits})`).join(', ');
    failures.push(`Legacy /api/ai/chat references remain in web callers: ${detail}`);
  }
}

function checkUseChatLogicContract() {
  const file = 'web/src/hooks/useChatLogic.ts';
  expectContains(file, "scope: 'parent' | 'teacher' | 'principal';", 'explicit scope union');
  expectContains(file, 'export function useChatLogic({ scope,', 'scope required in hook args');
  expectContains(file, 'scope,', 'request uses scope');
  expectContains(file, 'role: scope,', 'metadata role uses scope');
  expectNotContains(file, "role: 'parent'", 'parent-hardcoded metadata role');
}

function checkAskAIWidgetContract() {
  const file = 'web/src/components/dashboard/AskAIWidget.tsx';
  expectContains(
    file,
    "scope: 'parent' | 'teacher' | 'principal' | 'student' | 'guest';",
    'explicit widget scope union'
  );
  expectContains(file, 'scope,', 'request scope forwarded');
  expectContains(file, 'role: scope,', 'metadata role uses scope');
  expectNotContains(file, "scope = 'parent'", 'parent default scope');
}

function checkChatInterfaceContract() {
  const file = 'web/src/components/dash-chat/ChatInterface.tsx';
  expectContains(file, "scope: 'parent' | 'teacher' | 'principal';", 'scope required in props');
  expectContains(file, 'useChatLogic({', 'hook invocation exists');
  expectContains(file, 'scope,', 'scope passed to hook');
}

function checkDashChatCallsites() {
  expectContains('web/src/app/dashboard/parent/dash-chat/page.tsx', 'scope="parent"');
  expectContains('web/src/app/dashboard/teacher/dash-chat/page.tsx', 'scope="teacher"');
  expectContains('web/src/app/dashboard/principal/dash-chat/page.tsx', 'scope="principal"');
  expectContains('web/src/app/dashboard/teacher/dash-chat/page.tsx', 'userId={userId}', 'teacher userId pass-through');
}

function checkAskAIWidgetCallsites() {
  expectContains('web/src/components/dashboard/principal/PrincipalSidebar.tsx', '<AskAIWidget scope="principal"');
  expectContains(
    'web/src/components/dashboard/principal/DashAIFullscreenModal.tsx',
    '<AskAIWidget scope="principal"'
  );
  expectContains('web/src/app/dashboard/parent/standalone/page.tsx', 'scope="parent"');
  expectContains('web/src/app/exam-prep/page.tsx', 'scope="student"');
}

function checkWebAiProxyCallers() {
  const files = [
    'web/src/app/dashboard/parent/messages/page.tsx',
    'web/src/app/dashboard/teacher/messages/page.tsx',
    'web/src/app/dashboard/principal/messages/page.tsx',
    'web/src/app/dashboard/principal/ai-year-planner/page.tsx',
  ];

  for (const file of files) {
    expectContains(file, '/api/ai-proxy', 'canonical web AI endpoint');
    expectNotContains(file, '/api/ai/chat', 'legacy web AI endpoint');
  }
}

function checkClientToolsMetadataBoundary() {
  const offenders = findInTree('web/src', /client_tools\s*:/);
  if (offenders.length > 0) {
    const detail = offenders.map((o) => `${o.file}(${o.hits})`).join(', ');
    failures.push(`Unexpected client_tools metadata in web callers: ${detail}`);
  }
}

function checkAiProxyToolsAndExecution() {
  const file = 'supabase/functions/ai-proxy/index.ts';

  expectContains(file, 'const SERVER_TOOL_NAMES = new Set([', 'server tool allow-list');
  expectContains(file, "'search_caps_curriculum'");
  expectContains(file, "'get_caps_documents'");
  expectContains(file, "'get_caps_subjects'");
  expectContains(file, "'caps_curriculum_query'");

  expectCountAtLeast(file, "name: 'search_caps_curriculum'", 2, 'OpenAI + Anthropic tool definitions');
  expectCountAtLeast(file, "name: 'get_caps_documents'", 2, 'OpenAI + Anthropic tool definitions');
  expectCountAtLeast(file, "name: 'get_caps_subjects'", 2, 'OpenAI + Anthropic tool definitions');
  expectCountAtLeast(file, "name: 'caps_curriculum_query'", 2, 'OpenAI + Anthropic alias definitions');

  expectCountAtLeast(
    file,
    "if (toolName === 'search_caps_curriculum' || toolName === 'caps_curriculum_query')",
    3,
    'server execution for CAPS search/alias across providers'
  );
  expectCountAtLeast(file, "if (toolName === 'get_caps_documents')", 3, 'server execution for CAPS documents');
  expectCountAtLeast(file, "if (toolName === 'get_caps_subjects')", 3, 'server execution for CAPS subjects');

  expectContains(file, 'if (!SERVER_TOOL_NAMES.has(toolName)) {', 'unknown tools deferred to pending');
  expectContains(
    file,
    'const serverToolUses = toolUses.filter((tu) => SERVER_TOOL_NAMES.has(String(tu.name || \'\')));',
    'Anthropic server tool separation'
  );
  expectContains(
    file,
    'const clientToolUses = toolUses.filter((tu) => !SERVER_TOOL_NAMES.has(String(tu.name || \'\')));',
    'Anthropic client tool separation'
  );
  expectContains(
    file,
    'const serverTools = pendingToolCalls.filter((t) => SERVER_TOOL_NAMES.has(String(t.name || \'\')));',
    'streaming server tool separation'
  );
  expectContains(
    file,
    'const clientPendingTools = pendingToolCalls.filter((t) => !SERVER_TOOL_NAMES.has(String(t.name || \'\')));',
    'streaming pending-tool separation'
  );
}

function main() {
  checkNoLegacyEndpoint();
  checkUseChatLogicContract();
  checkAskAIWidgetContract();
  checkChatInterfaceContract();
  checkDashChatCallsites();
  checkAskAIWidgetCallsites();
  checkWebAiProxyCallers();
  checkClientToolsMetadataBoundary();
  checkAiProxyToolsAndExecution();

  if (failures.length > 0) {
    console.error('Dash + CAPS contract verification failed.');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Dash + CAPS contract verification passed.');
}

main();
