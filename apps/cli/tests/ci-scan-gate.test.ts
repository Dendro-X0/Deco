import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const gateScript = path.join(repoRoot, 'scripts', 'ci-scan-gate.mjs');
const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

function runGate(reportPath: string, maxSafeMb: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [gateScript, reportPath, '--max-safe-mb', maxSafeMb], {
      stdio: 'pipe',
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

describe('ci-scan-gate', () => {
  it('passes when safe bytes are under limit', async () => {
    const dir = await mkdtemp(path.join(process.cwd(), '.tmp-tests-gate-'));
    tmpDirs.push(dir);
    const reportPath = path.join(dir, 'report.json');
    await writeFile(
      reportPath,
      JSON.stringify({ totals_by_risk: { safe: { count: 1, bytes: 1000 }, review: { count: 0, bytes: 0 }, blocked: { count: 0, bytes: 0 } } }),
      'utf8',
    );
    expect(await runGate(reportPath, '1')).toBe(0);
  });

  it('fails when safe bytes exceed limit', async () => {
    const dir = await mkdtemp(path.join(process.cwd(), '.tmp-tests-gate-'));
    tmpDirs.push(dir);
    const reportPath = path.join(dir, 'report.json');
    await writeFile(
      reportPath,
      JSON.stringify({
        totals_by_risk: { safe: { count: 1, bytes: 600 * 1024 * 1024 }, review: { count: 0, bytes: 0 }, blocked: { count: 0, bytes: 0 } },
      }),
      'utf8',
    );
    expect(await runGate(reportPath, '500')).toBe(1);
  });
});
