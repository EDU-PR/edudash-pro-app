import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import process from 'process';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env.eas', override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectMap = await import(path.join(__dirname, 'eas-projects.js'));
const { EAS_PROJECTS, resolveEasProjectConfig } = projectMap.default || projectMap;

const args = process.argv.slice(2);
const isBuild = args[0] === 'build';
const isNonInteractive =
  args.includes('--non-interactive') ||
  process.env.CI === 'true' ||
  process.env.CI === '1' ||
  process.env.EAS_NO_PROJECT_PROMPT === '1';

const { list, byId } = buildProjectList(EAS_PROJECTS);
const currentConfig = getCurrentConfig({ byId, projects: EAS_PROJECTS, resolver: resolveEasProjectConfig });

let selectedConfig = null;

if (isBuild && !isNonInteractive) {
  selectedConfig = await promptForProject({ list, byId, currentConfig, projects: EAS_PROJECTS });
}

const env = { ...process.env };
if (selectedConfig) {
  env.EAS_PROJECT_ID = selectedConfig.id;
  env.EAS_PROJECT_OWNER = selectedConfig.owner;
  env.EAS_PROJECT_SLUG = selectedConfig.slug;
  writeEnvFile(selectedConfig);
  console.log(`[eas-wrapper] Using EAS project: ${selectedConfig.owner}/${selectedConfig.slug} (${selectedConfig.id})`);
}

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(cmd, ['eas', ...args], { stdio: 'inherit', env });
process.exit(result.status ?? 1);

function buildProjectList(projects) {
  const byIdMap = new Map();
  const unique = [];

  for (const [alias, config] of Object.entries(projects)) {
    const existing = byIdMap.get(config.id);
    if (existing) {
      existing.aliases.push(alias);
      continue;
    }
    const entry = {
      alias,
      aliases: [alias],
      config,
    };
    byIdMap.set(config.id, entry);
    unique.push(entry);
  }

  return { list: unique, byId: byIdMap };
}

function getCurrentConfig({ byId, projects, resolver }) {
  const current = process.env.EAS_PROJECT_ID;
  if (!current) return null;
  if (projects[current]) return projects[current];
  if (byId.has(current)) return byId.get(current).config;
  if (resolver) {
    const resolved = resolver(current);
    if (resolved?.id) {
      return { id: resolved.id, owner: resolved.owner, slug: resolved.slug };
    }
  }
  return null;
}

function resolveInput(input, { byId, projects }) {
  if (projects[input]) return projects[input];
  if (byId.has(input)) return byId.get(input).config;
  return null;
}

function printProjectList(list) {
  console.log('');
  console.log('Select EAS project for this build:');
  list.forEach((entry, index) => {
    console.log(
      `${index + 1}) ${entry.alias}  owner=${entry.config.owner} slug=${entry.config.slug} id=${entry.config.id}`
    );
    if (entry.aliases.length > 1) {
      console.log(`   aliases: ${entry.aliases.join(', ')}`);
    }
  });
  console.log(`${list.length + 1}) custom`);
  console.log('');
}

async function promptForProject({ list, byId, currentConfig, projects }) {
  printProjectList(list);

  const currentLabel = currentConfig
    ? `${currentConfig.owner}/${currentConfig.slug} (${currentConfig.id})`
    : 'none';

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const raw = (await rl.question(`Choose number/alias/id [current: ${currentLabel}]: `)).trim();

    if (!raw) {
      if (currentConfig) return currentConfig;
      return list[0]?.config || null;
    }

    if (/^\d+$/.test(raw)) {
      const index = Number.parseInt(raw, 10) - 1;
      if (index === list.length) {
        return await promptForCustomProject(rl, currentConfig);
      }
      return list[index]?.config || null;
    }

    if (raw.toLowerCase() === 'custom') {
      return await promptForCustomProject(rl, currentConfig);
    }

    const resolved = resolveInput(raw, { byId, projects });
    if (!resolved) {
      console.error(`Unknown project selection: ${raw}`);
      return null;
    }
    return resolved;
  } finally {
    rl.close();
  }
}

async function promptForCustomProject(rl, fallback) {
  const ask = async (label, defaultValue) => {
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    const value = (await rl.question(`${label}${suffix}: `)).trim();
    return value || defaultValue || '';
  };

  const id = await ask('Project ID', fallback?.id || '');
  const owner = await ask('Owner', fallback?.owner || '');
  const slug = await ask('Slug', fallback?.slug || '');

  if (!id || !owner || !slug) {
    console.error('Custom project requires id, owner, and slug.');
    return null;
  }

  return { id, owner, slug };
}

function writeEnvFile(values) {
  const lines = [
    `EAS_PROJECT_ID=${values.id}`,
    `EAS_PROJECT_OWNER=${values.owner}`,
    `EAS_PROJECT_SLUG=${values.slug}`,
  ];
  try {
    fs.writeFileSync(path.join(process.cwd(), '.env.eas'), `${lines.join('\n')}\n`, 'utf8');
  } catch (error) {
    console.warn('[eas-wrapper] Unable to write .env.eas. Continuing without persisting selection.');
  }
}
