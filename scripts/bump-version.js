#!/usr/bin/env node
/**
 * Bump the app version and record it.
 *
 *   npm run version:bump            # patch: 1.1.0 -> 1.1.1
 *   npm run version:bump -- minor   # 1.1.0 -> 1.2.0
 *   npm run version:bump -- major   # 1.1.0 -> 2.0.0
 *
 * Writes to app.json (the source of truth that android/ reads at build time)
 * and prepends an entry to CHANGELOG.md listing the commits since the last
 * bump, so a released build can always be traced back to what went into it.
 *
 * versionCode always increments by exactly one, independent of the semantic
 * version: Play only cares that it goes up, and never reusing a number is the
 * one rule that actually matters.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const appJsonPath = path.join(root, 'app.json');
const changelogPath = path.join(root, 'CHANGELOG.md');

const kind = (process.argv[2] || 'patch').toLowerCase();
if (!['major', 'minor', 'patch'].includes(kind)) {
  console.error(`Unknown bump "${kind}" — expected major, minor or patch.`);
  process.exit(1);
}

const app = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const prevName = String(app.expo.version || '0.0.0');
const prevCode = Number(app.expo.android?.versionCode || 0);

const m = prevName.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!m) {
  console.error(`app.json version "${prevName}" is not MAJOR.MINOR.PATCH — fix it by hand first.`);
  process.exit(1);
}
let [maj, min, pat] = m.slice(1).map(Number);
if (kind === 'major') { maj += 1; min = 0; pat = 0; }
else if (kind === 'minor') { min += 1; pat = 0; }
else { pat += 1; }

const nextName = `${maj}.${min}.${pat}`;
const nextCode = prevCode + 1;

app.expo.version = nextName;
app.expo.android = app.expo.android || {};
app.expo.android.versionCode = nextCode;
fs.writeFileSync(appJsonPath, JSON.stringify(app, null, 2) + '\n');

// Commits since the previous version tag, so the entry says what shipped.
let commits = '';
try {
  const lastTag = execSync('git describe --tags --abbrev=0 --match "v*"', {
    cwd: root, stdio: ['ignore', 'pipe', 'ignore'],
  }).toString().trim();
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  commits = execSync(`git log ${range} --no-merges --pretty=format:"- %s"`, {
    cwd: root, stdio: ['ignore', 'pipe', 'ignore'],
  }).toString().trim();
} catch {
  // No tags yet (or no git) — fall back to everything, capped so the first
  // entry doesn't swallow the entire history.
  try {
    commits = execSync('git log -30 --no-merges --pretty=format:"- %s"', {
      cwd: root, stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
  } catch { /* not a git checkout — leave it blank */ }
}

const today = new Date().toISOString().slice(0, 10);
const entry = [
  `## ${nextName} (versionCode ${nextCode}) — ${today}`,
  '',
  commits || '_No commits recorded._',
  '',
  '',
].join('\n');

const header = '# Changelog\n\n';
const existing = fs.existsSync(changelogPath)
  ? fs.readFileSync(changelogPath, 'utf8').replace(/^# Changelog\n\n/, '')
  : '';
fs.writeFileSync(changelogPath, header + entry + existing);

console.log(`${prevName} (code ${prevCode})  ->  ${nextName} (code ${nextCode})`);
console.log('Updated app.json and CHANGELOG.md.');
console.log('');
console.log('Next:');
console.log(`  git add app.json CHANGELOG.md && git commit -m "Release ${nextName}"`);
console.log(`  git tag v${nextName}`);
console.log('  cd android && ./gradlew assembleRelease --no-daemon');
