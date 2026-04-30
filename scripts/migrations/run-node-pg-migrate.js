#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PACKAGE_JSON_PATH = path.resolve(__dirname, '../../package.json');
const LOCAL_BINARY = path.resolve(
  __dirname,
  `../../node_modules/.bin/node-pg-migrate${process.platform === 'win32' ? '.cmd' : ''}`
);
const command = process.argv[2];
const extraArgs = process.argv.slice(3);

if (!command) {
  console.error('Usage: node scripts/migrations/run-node-pg-migrate.js <up|down|redo> [...args]');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
const configuredVersion =
  packageJson.devDependencies?.['node-pg-migrate'] ||
  packageJson.dependencies?.['node-pg-migrate'];

if (!configuredVersion) {
  console.error('node-pg-migrate version is missing from package.json');
  process.exit(1);
}

const commonArgs = [
  command,
  '--migrations-dir',
  'migrations/*.js',
  '--use-glob',
  ...extraArgs,
];

const shouldUseLocalBinary =
  fs.existsSync(LOCAL_BINARY) &&
  process.env.NODE_PG_MIGRATE_FORCE_NPX !== '1';

const result = shouldUseLocalBinary
  ? spawnSync(LOCAL_BINARY, commonArgs, { stdio: 'inherit', shell: process.platform === 'win32' })
  : spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['-y', `node-pg-migrate@${configuredVersion}`, ...commonArgs],
      { stdio: 'inherit', shell: process.platform === 'win32' }
    );

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
