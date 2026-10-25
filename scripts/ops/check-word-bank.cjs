#!/usr/bin/env node
/**
 * Checks a ranked word bank file with the production rules before it is
 * deployed: `node scripts/ops/check-word-bank.cjs <path>`. Prints only counts
 * and rule messages with the words masked, so CI logs never carry the bank.
 */
const fs = require('fs');
const { validateWordBank } = require('../../backend/gameEngine/wordBank');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/ops/check-word-bank.cjs <path-to-words.json>');
  process.exit(2);
}

let words;
try {
  words = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`[word-bank] cannot read JSON (${error.code || error.name})`);
  process.exit(1);
}

const { ok, errors } = validateWordBank(words, { strict: true });
if (!ok) {
  for (const message of errors.slice(0, 20)) console.error(`[word-bank] ${message.replace(/"[^"]*"/g, '"…"')}`);
  console.error(`[word-bank] ${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`[word-bank] ok: ${words.length} words`);
