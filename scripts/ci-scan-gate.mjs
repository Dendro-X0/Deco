#!/usr/bin/env node
/**
 * Fail CI when safe-tier reclaim in a Deco wire scan report exceeds a byte budget.
 *
 * Usage:
 *   node scripts/ci-scan-gate.mjs scan-report.json --max-safe-mb 500
 */

import { readFile } from 'node:fs/promises';

function parseArgs(argv) {
  const reportPath = argv[0];
  let maxSafeMb = 500;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--max-safe-mb' && argv[i + 1]) {
      maxSafeMb = Number(argv[++i]);
    }
  }
  if (!reportPath) {
    throw new Error('Usage: node scripts/ci-scan-gate.mjs <scan-report.json> [--max-safe-mb N]');
  }
  if (!Number.isFinite(maxSafeMb) || maxSafeMb < 0) {
    throw new Error('--max-safe-mb must be a non-negative number');
  }
  return { reportPath, maxSafeBytes: Math.floor(maxSafeMb * 1024 * 1024) };
}

async function main() {
  const { reportPath, maxSafeBytes } = parseArgs(process.argv.slice(2));
  const raw = await readFile(reportPath, 'utf8');
  const report = JSON.parse(raw);
  const safeBytes = report?.totals_by_risk?.safe?.bytes;
  if (typeof safeBytes !== 'number') {
    throw new Error('Invalid report: missing totals_by_risk.safe.bytes');
  }
  if (safeBytes > maxSafeBytes) {
    const mb = (safeBytes / (1024 * 1024)).toFixed(1);
    const limitMb = (maxSafeBytes / (1024 * 1024)).toFixed(1);
    console.error(`Safe reclaim ${mb} MiB exceeds limit ${limitMb} MiB`);
    process.exitCode = 1;
    return;
  }
  const mb = (safeBytes / (1024 * 1024)).toFixed(1);
  console.log(`OK: safe reclaim ${mb} MiB within limit`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
