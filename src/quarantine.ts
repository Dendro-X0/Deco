import { appendFile, cp, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CleanupCandidate } from './types.js';

export type QuarantineManifestEntry = {
  readonly id: string;
  readonly originalPath: string;
  readonly quarantinedPath: string;
  readonly timestamp: string;
  readonly size?: number;
  readonly reasonSummary: string;
};

const MANIFEST_FILE = 'manifest.jsonl';

function resolveDriveRoot(absPath: string): string {
  const parsed = path.parse(path.resolve(absPath));
  return parsed.root || process.cwd();
}

export function resolveQuarantineRoot(absPath: string, explicitRoot?: string): string {
  if (explicitRoot) return path.resolve(explicitRoot);
  return path.join(resolveDriveRoot(absPath), '.deco-quarantine');
}

async function ensureDir(absPath: string): Promise<void> {
  await mkdir(absPath, { recursive: true });
}

async function appendManifestEntry(quarantineRoot: string, entry: QuarantineManifestEntry): Promise<void> {
  const manifestPath = path.join(quarantineRoot, MANIFEST_FILE);
  await appendFile(manifestPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function movePath(src: string, dst: string): Promise<void> {
  try {
    await rename(src, dst);
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code !== 'EXDEV') throw error;
    await cp(src, dst, { recursive: true, force: true });
    await rm(src, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 });
  }
}

export async function quarantineCandidate(
  candidate: CleanupCandidate,
  explicitRoot?: string,
): Promise<QuarantineManifestEntry> {
  const quarantineRoot = resolveQuarantineRoot(candidate.absPath, explicitRoot);
  const itemsRoot = path.join(quarantineRoot, 'items');
  await ensureDir(itemsRoot);

  const id = randomUUID();
  const targetName = `${id}-${path.basename(candidate.absPath)}`;
  const quarantinedPath = path.join(itemsRoot, targetName);

  await movePath(candidate.absPath, quarantinedPath);

  const entry: QuarantineManifestEntry = {
    id,
    originalPath: candidate.absPath,
    quarantinedPath,
    timestamp: new Date().toISOString(),
    size: candidate.size,
    reasonSummary: candidate.reasonCodes.join(','),
  };

  await appendManifestEntry(quarantineRoot, entry);
  return entry;
}

async function readManifest(manifestPath: string): Promise<QuarantineManifestEntry[]> {
  try {
    const raw = await readFile(manifestPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const parsed: QuarantineManifestEntry[] = [];
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line) as QuarantineManifestEntry);
      } catch {
        // ignore malformed lines to keep recovery resilient
      }
    }
    return parsed;
  } catch {
    return [];
  }
}

function getCandidateQuarantineRoots(roots: readonly string[], explicitRoot?: string): string[] {
  if (explicitRoot) return [path.resolve(explicitRoot)];
  const values = roots.map((root) => path.join(resolveDriveRoot(root), '.deco-quarantine'));
  return [...new Set(values)];
}

export async function restoreFromQuarantine(
  id: string,
  roots: readonly string[],
  explicitRoot?: string,
): Promise<string> {
  const quarantineRoots = getCandidateQuarantineRoots(roots, explicitRoot);
  for (const quarantineRoot of quarantineRoots) {
    const manifestPath = path.join(quarantineRoot, MANIFEST_FILE);
    const entries = await readManifest(manifestPath);
    const match = entries.find((entry) => entry.id === id);
    if (!match) continue;

    await ensureDir(path.dirname(match.originalPath));
    await movePath(match.quarantinedPath, match.originalPath);
    return match.originalPath;
  }
  throw new Error(`No quarantine entry found for id: ${id}`);
}

export async function purgeQuarantine(
  roots: readonly string[],
  retentionDays: number,
  explicitRoot?: string,
): Promise<{ purged: number; errors: readonly string[] }> {
  const errors: string[] = [];
  let purged = 0;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const quarantineRoots = getCandidateQuarantineRoots(roots, explicitRoot);
  for (const quarantineRoot of quarantineRoots) {
    const manifestPath = path.join(quarantineRoot, MANIFEST_FILE);
    const entries = await readManifest(manifestPath);
    for (const entry of entries) {
      try {
        const st = await stat(entry.quarantinedPath);
        if (st.mtimeMs > cutoff) continue;
        await rm(entry.quarantinedPath, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 });
        purged += 1;
      } catch (error: unknown) {
        const code = (error as { code?: string }).code ?? 'unknown';
        if (code === 'ENOENT') continue;
        errors.push(`Failed to purge ${entry.quarantinedPath} (${code})`);
      }
    }
  }

  return { purged, errors };
}