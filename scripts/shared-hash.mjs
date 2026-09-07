#!/usr/bin/env node
/**
 * Prove this repo's copies of the shared files still match the other product's.
 *
 * The two products run on one Firebase project and share three files verbatim.
 * There was a test for that, and it could only ever run on one laptop: it read
 * the sibling repository through an absolute path. The repos live under
 * different GitHub accounts, so no CI job can check out both, and an edit to
 * either copy could be committed, built and deployed without the comparison
 * running once.
 *
 * So the comparison is inverted. Each repo hashes its OWN copies and checks
 * them against `shared-files.sha256`, a manifest kept identical in both. Change
 * a shared file on one side and its hash moves; the manifest has to be
 * rewritten, and because the manifest is itself one of the things that must
 * match, the other repo's CI fails until it is brought along. Neither job needs
 * to see the other repository.
 *
 *   node scripts/shared-hash.mjs           # check, exit 1 on drift
 *   node scripts/shared-hash.mjs --write   # rewrite the manifest, both repos
 *
 * Keep this file identical in both repos too.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/** Path in the mobile app -> path on the website. One of the two will exist. */
const SHARED = [
  { name: 'verifyRule',   app: 'lib/verifyRule.ts',   web: 'src/lib/verifyRule.ts' },
  { name: 'displayOrder', app: 'lib/displayOrder.ts', web: 'src/lib/displayOrder.ts' },
  { name: 'urgentRequest', app: 'lib/urgentRequest.ts', web: 'src/lib/urgentRequest.ts' },
  { name: 'cleanerTraits', app: 'lib/cleanerTraits.ts', web: 'src/lib/cleanerTraits.ts' },
  { name: 'firestoreRules', app: 'firestore.rules',   web: 'firestore.rules' },
];

/**
 * Strip comments and whitespace so the two copies may explain themselves in
 * different languages — the app comments in Hebrew, the website in English —
 * while a single token of behaviour may not differ.
 *
 * A character scanner, not a regex: comment delimiters inside a string literal
 * are not comment delimiters, and a review proved that a regex version could be
 * fooled into calling two different files identical.
 */
export function codeOnly(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? src.length : end;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i += 1;
      while (i < src.length) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        out += src[i];
        if (src[i] === quote) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (/\s/.test(c)) { i += 1; continue; }
    // A trailing comma before a closer is what a formatter adds, not a change.
    if ((c === ')' || c === ']' || c === '}') && out.endsWith(',')) out = out.slice(0, -1);
    out += c;
    i += 1;
  }
  return out;
}

function hashesHere() {
  const out = {};
  for (const f of SHARED) {
    const path = existsSync(f.app) ? f.app : f.web;
    if (!existsSync(path)) {
      console.error(`shared-hash: neither ${f.app} nor ${f.web} exists here.`);
      process.exit(1);
    }
    out[f.name] = createHash('sha256').update(codeOnly(readFileSync(path, 'utf8'))).digest('hex');
  }
  return out;
}

const MANIFEST = 'shared-files.sha256';

if (process.argv.includes('--write')) {
  const body = Object.entries(hashesHere()).map(([k, v]) => `${v}  ${k}`).join('\n') + '\n';
  writeFileSync(MANIFEST, body);
  console.log(`Wrote ${MANIFEST}:\n${body}`);
  console.log('Copy this file to the other repo unchanged, and commit both.');
  process.exit(0);
}

if (!existsSync(MANIFEST)) {
  console.error(`shared-hash: ${MANIFEST} is missing. Run: node scripts/shared-hash.mjs --write`);
  process.exit(1);
}

const expected = Object.fromEntries(
  readFileSync(MANIFEST, 'utf8').trim().split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length === 2)
    .map(([hash, name]) => [name, hash]),
);

const actual = hashesHere();
let bad = 0;
for (const [name, hash] of Object.entries(actual)) {
  if (expected[name] === hash) {
    console.log(`  ok    ${name}`);
  } else {
    bad += 1;
    console.error(`  DRIFT ${name}`);
    console.error(`        manifest: ${expected[name] ?? '(absent)'}`);
    console.error(`        this repo: ${hash}`);
  }
}
if (bad) {
  console.error(`\n${bad} shared file(s) differ from the manifest.`);
  console.error('Either this repo changed a file the other product also has — in which case make');
  console.error('the same change there — or the manifest is stale. When both copies really do');
  console.error('match again, run `node scripts/shared-hash.mjs --write` and copy the manifest');
  console.error('to BOTH repos.');
  process.exit(1);
}
console.log('\nShared files match the manifest.');
