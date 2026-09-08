#!/usr/bin/env node
/**
 * Prove this repo's copies of the shared files still match the other product's.
 *
 * The two products run on one Firebase project and share five files. A test for
 * that existed and could only run on one laptop: it read the sibling repository
 * through an absolute path, and the repos live under different GitHub accounts.
 *
 * THE FILES ARE BYTE-IDENTICAL, AND THE HASH IS OF THE BYTES. That is the whole
 * design, and it is deliberately stupid. Two earlier versions tried to be clever
 * — strip the comments, so each product could explain itself in its own language
 * — and a review broke both. The character scanner read the `//` inside
 * `/^https?:\/\//` as a comment; the line-based rewrite that replaced it still
 * discarded everything to end-of-file when a line inside a template literal
 * happened to start with a block-comment opener. Each time, two genuinely
 * different files hashed the same, which is the one failure this guard exists to
 * prevent. There is no way to strip comments from JavaScript without parsing it,
 * and a guard that can be fooled is worse than none because everybody stops
 * looking. So the prose is the same in both copies now, and nothing is stripped.
 *
 * WHAT THE FIRST VERSION OF THIS FILE GOT WRONG. It hashed each repo's own
 * copies against each repo's own manifest and claimed that, because the
 * manifest must also match, the other side's CI would fail until it was brought
 * along. That was simply false — the manifest was not one of the compared
 * files, so changing a shared file and running `--write` in one repo left BOTH
 * checks green while the files genuinely differed. A guard that cannot detect
 * the drift it was built for is worse than none, because everyone stops
 * looking.
 *
 * WHAT ACTUALLY WORKS. The mobile app's repository is public, so its manifest
 * can be fetched over plain HTTPS with no credentials. `--cross` does that and
 * compares the two manifests directly. Whichever side edits a shared file, the
 * two manifests diverge and the check fails — both directions, from the one CI
 * job that can see both. The website's repo is private, so the app's CI cannot
 * do the reverse; its local check still catches a file edited without a
 * manifest rewrite, and the website's job is what catches real drift.
 *
 *   node scripts/shared-hash.mjs           # local: files match this manifest
 *   node scripts/shared-hash.mjs --cross   # also: this manifest matches the app's
 *   node scripts/shared-hash.mjs --write   # rewrite it, then copy to BOTH repos
 *
 * Keep this file identical in both repos too.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/** Path in the mobile app -> path on the website. One of the two will exist. */
const SHARED = [
  { name: 'verifyRule',     app: 'lib/verifyRule.ts',     web: 'src/lib/verifyRule.ts' },
  { name: 'displayOrder',   app: 'lib/displayOrder.ts',   web: 'src/lib/displayOrder.ts' },
  { name: 'urgentRequest',  app: 'lib/urgentRequest.ts',  web: 'src/lib/urgentRequest.ts' },
  { name: 'cleanerTraits',  app: 'lib/cleanerTraits.ts',  web: 'src/lib/cleanerTraits.ts' },
  { name: 'bookingSlot',    app: 'lib/bookingSlot.ts',    web: 'src/lib/bookingSlot.ts' },
  { name: 'bookingActions', app: 'lib/bookingActions.ts', web: 'src/lib/bookingActions.ts' },
  { name: 'firestoreRules', app: 'firestore.rules',       web: 'firestore.rules' },
];

const MANIFEST = 'shared-files.sha256';
const APP_MANIFEST_URL =
  'https://raw.githubusercontent.com/itzikofek669-jpg/smartclean3/main/shared-files.sha256';

/**
 * Only run the checks when invoked as a command, so test/shared.test.mjs can
 * import from here without the module exiting the process underneath it.
 */
const RUN_AS_CLI = process.argv[1] && process.argv[1].endsWith('shared-hash.mjs');

function hashesHere() {
  const out = {};
  for (const f of SHARED) {
    const path = existsSync(f.app) ? f.app : f.web;
    if (!existsSync(path)) {
      console.error(`shared-hash: neither ${f.app} nor ${f.web} exists here.`);
      process.exit(1);
    }
    out[f.name] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
  return out;
}

const parse = (text) => Object.fromEntries(
  text.trim().split('\n').map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length === 2).map(([hash, name]) => [name, hash]),
);

if (RUN_AS_CLI) {
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

  const expected = parse(readFileSync(MANIFEST, 'utf8'));
  const actual = hashesHere();
  let bad = 0;
  for (const [name, hash] of Object.entries(actual)) {
    if (expected[name] === hash) console.log(`  ok    ${name}`);
    else {
      bad += 1;
      console.error(`  DRIFT ${name}`);
      console.error(`        manifest:  ${expected[name] ?? '(absent)'}`);
      console.error(`        this repo: ${hash}`);
    }
  }
  if (bad) {
    console.error(`\n${bad} shared file(s) differ from this repo's manifest.`);
    console.error('Either a shared file changed here — make the same change in the other repo —');
    console.error('or the manifest is stale. When both copies match again, run --write and copy');
    console.error(`${MANIFEST} to BOTH repos.`);
    process.exit(1);
  }
  console.log('\nShared files match this repo\'s manifest.');

  // ── The half that actually catches drift ──────────────────────────────────
  if (process.argv.includes('--cross')) {
    const res = await fetch(APP_MANIFEST_URL).catch((err) => ({ ok: false, err }));
    if (!res.ok) {
      console.error(`\n::error::Could not fetch the mobile app's manifest (${APP_MANIFEST_URL}).`);
      console.error('Without it this job proves only that this repo agrees with itself.');
      process.exit(1);
    }
    const theirs = parse(await res.text());
    const mine = parse(readFileSync(MANIFEST, 'utf8'));
    let diff = 0;
    // The UNION of both manifests. Iterating only our own keys meant a file the
  // app had added and this repo had not was never compared at all.
  for (const name of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
      if (mine[name] !== theirs[name]) {
        diff += 1;
        console.error(`  DRIFT ${name} — differs from the mobile app`);
        console.error(`        here: ${mine[name] ?? '(absent — the app has a shared file this repo does not)'}`);
        console.error(`        app:  ${theirs[name] ?? '(absent)'}`);
      }
    }
    if (diff) {
      console.error(`\n::error::${diff} shared file(s) have drifted between the two products.`);
      console.error('One side changed a shared file and the other did not follow. For');
      console.error('firestore.rules this matters most: one Firebase project, and whichever');
      console.error('product deploys last wins.');
      process.exit(1);
    }
    console.log('Manifest matches the mobile app\'s. The two products are in step.');
  }
}
