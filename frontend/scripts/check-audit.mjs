#!/usr/bin/env node
// Runs `npm audit` and fails (exit 1) on any high/critical vulnerability,
// except advisories explicitly allowlisted below with a documented reason.
// Anything not allowlisted still fails the build exactly like
// `npm audit --audit-level=high` did — this only adds a narrow, auditable
// exception mechanism instead of lowering the bar globally.
import { execSync } from 'node:child_process';

const ALLOWLIST = {
  'GHSA-qwww-vcr4-c8h2': [
    'React Router CSRF bypass in "RSC Mode" (React Server Components) — this',
    'app is a client-only Vite SPA and never uses RSC/server actions, so the',
    'vulnerable code path is unreachable. No patched react-router-dom version',
    'exists yet in the 7.x/8.x line; downgrading below 7.12.0 (the only fix',
    'npm currently offers) reintroduces 14+ other high-severity CVEs fixed',
    'since then, which is worse. Revisit once a patched version ships.',
  ].join(' '),
};

const MIN_SEVERITY = 'high';
const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

let report;
try {
  const raw = execSync('npm audit --json', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  report = JSON.parse(raw);
} catch (err) {
  // npm audit exits non-zero as soon as it finds anything — the JSON report
  // is still on stdout, so this isn't actually a failure to run the check.
  report = JSON.parse(err.stdout);
}

const vulnerabilities = report.vulnerabilities || {};

/**
 * Resolves every advisory URL a vulnerability entry ultimately stems from,
 * following `via` references to other vulnerable packages (plain strings)
 * down to the actual advisory objects (which carry a `url`).
 */
function resolveAdvisoryUrls(entry, seen = new Set()) {
  if (seen.has(entry.name)) return [];
  seen.add(entry.name);
  const urls = [];
  for (const via of entry.via || []) {
    if (typeof via === 'string') {
      const referenced = vulnerabilities[via];
      if (referenced) urls.push(...resolveAdvisoryUrls(referenced, seen));
    } else if (via && via.url) {
      urls.push(via.url);
    }
  }
  return urls;
}

const advisoryId = (url) => url.split('/').pop();

const unresolved = [];
for (const entry of Object.values(vulnerabilities)) {
  if (SEVERITY_RANK[entry.severity] < SEVERITY_RANK[MIN_SEVERITY]) continue;
  const advisoryUrls = resolveAdvisoryUrls(entry);
  const fullyAllowlisted = advisoryUrls.length > 0 && advisoryUrls.every((url) => ALLOWLIST[advisoryId(url)]);
  if (!fullyAllowlisted) {
    unresolved.push({ name: entry.name, severity: entry.severity, advisoryUrls });
  }
}

if (unresolved.length > 0) {
  console.error(`\n${unresolved.length} unresolved ${MIN_SEVERITY}+ severity vulnerabilit${unresolved.length === 1 ? 'y' : 'ies'}:\n`);
  for (const u of unresolved) {
    console.error(`  - ${u.name} (${u.severity}): ${u.advisoryUrls.join(', ') || 'no advisory URL'}`);
  }
  console.error('\nRun `npm audit` for details, or add a justified entry to ALLOWLIST in scripts/check-audit.mjs.\n');
  process.exit(1);
}

const allowlistedEntries = Object.values(vulnerabilities).filter((e) => SEVERITY_RANK[e.severity] >= SEVERITY_RANK[MIN_SEVERITY]);
if (allowlistedEntries.length > 0) {
  console.log(`${allowlistedEntries.length} ${MIN_SEVERITY}+ severity advisory reference(s) allowlisted:`);
  for (const [id, reason] of Object.entries(ALLOWLIST)) {
    console.log(`  - ${id}: ${reason}`);
  }
}
console.log(`\nNo unresolved ${MIN_SEVERITY}+ severity vulnerabilities.`);
