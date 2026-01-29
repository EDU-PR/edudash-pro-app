import fs from 'fs';
import path from 'path';
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

const [, , command, arg, ...rest] = process.argv;

const usage = () => {
  console.log('Usage:');
  console.log('  node scripts/eas-project.mjs list');
  console.log('  node scripts/eas-project.mjs current');
  console.log('  node scripts/eas-project.mjs use <alias|projectId> [--owner <owner>] [--slug <slug>]');
};

const writeEnvFile = (values) => {
  const lines = [
    `EAS_PROJECT_ID=${values.id}`,
    `EAS_PROJECT_OWNER=${values.owner}`,
    `EAS_PROJECT_SLUG=${values.slug}`,
  ];
  fs.writeFileSync(path.join(process.cwd(), '.env.eas'), `${lines.join('\n')}\n`, 'utf8');
};

if (!command) {
  usage();
  process.exit(1);
}

if (command === 'list') {
  const entries = Object.entries(EAS_PROJECTS).map(([alias, config]) => ({
    alias,
    id: config.id,
    owner: config.owner,
    slug: config.slug,
  }));
  console.table(entries);
  process.exit(0);
}

if (command === 'current') {
  const resolved = resolveEasProjectConfig(process.env.EAS_PROJECT_ID);
  console.log(`alias: ${resolved.alias || 'custom'}`);
  console.log(`id: ${resolved.id}`);
  console.log(`owner: ${resolved.owner}`);
  console.log(`slug: ${resolved.slug}`);
  process.exit(0);
}

if (command === 'use') {
  if (!arg) {
    usage();
    process.exit(1);
  }

  const ownerIndex = rest.indexOf('--owner');
  const slugIndex = rest.indexOf('--slug');
  const ownerOverride = ownerIndex >= 0 ? rest[ownerIndex + 1] : null;
  const slugOverride = slugIndex >= 0 ? rest[slugIndex + 1] : null;

  const resolved = resolveEasProjectConfig(arg);
  const finalConfig = {
    id: resolved.id,
    owner: ownerOverride || resolved.owner,
    slug: slugOverride || resolved.slug,
  };

  writeEnvFile(finalConfig);
  console.log(`Switched EAS project: ${arg}`);
  console.log(`id: ${finalConfig.id}`);
  console.log(`owner: ${finalConfig.owner}`);
  console.log(`slug: ${finalConfig.slug}`);
  console.log('Written to .env.eas');
  process.exit(0);
}

usage();
process.exit(1);
