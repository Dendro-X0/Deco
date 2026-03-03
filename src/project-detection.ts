import { access, readdir } from 'node:fs/promises';
import path from 'node:path';

export type ProjectEvidence = {
  readonly projectRoot: string;
  readonly score: number;
  readonly reasons: readonly string[];
};

const LOCK_FILES = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb'] as const;

async function exists(absPath: string): Promise<boolean> {
  try {
    await access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function hasConfigPrefix(dir: string, prefixes: readonly string[]): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    return entries.some((name) => prefixes.some((prefix) => name.startsWith(prefix)));
  } catch {
    return false;
  }
}

async function detectAtDirectory(dir: string): Promise<ProjectEvidence | null> {
  const hasPackageJson = await exists(path.join(dir, 'package.json'));
  const hasLockfile = (await Promise.all(LOCK_FILES.map((name) => exists(path.join(dir, name))))).some(Boolean);

  if (hasPackageJson && hasLockfile) {
    return {
      projectRoot: dir,
      score: 100,
      reasons: ['package.json', 'lockfile'],
    };
  }

  const hasCargoToml = await exists(path.join(dir, 'Cargo.toml'));
  if (hasCargoToml) {
    return {
      projectRoot: dir,
      score: 95,
      reasons: ['Cargo.toml'],
    };
  }

  const hasGoMod = await exists(path.join(dir, 'go.mod'));
  if (hasGoMod) {
    return {
      projectRoot: dir,
      score: 95,
      reasons: ['go.mod'],
    };
  }

  const hasGit = await exists(path.join(dir, '.git'));
  const hasTsconfig = await exists(path.join(dir, 'tsconfig.json'));
  const hasToolingConfig = await hasConfigPrefix(dir, ['vite.config.', 'next.config.', 'svelte.config.', 'astro.config.']);

  if (hasPackageJson && (hasTsconfig || hasToolingConfig || hasGit)) {
    return {
      projectRoot: dir,
      score: 80,
      reasons: ['package.json', hasTsconfig ? 'tsconfig.json' : 'tooling-config'],
    };
  }

  if (hasGit && (hasTsconfig || hasToolingConfig)) {
    return {
      projectRoot: dir,
      score: 65,
      reasons: ['.git', hasTsconfig ? 'tsconfig.json' : 'tooling-config'],
    };
  }

  return null;
}

export async function detectProjectRoot(fromDirectory: string, maxAscend = 4, stopAt?: string): Promise<ProjectEvidence | null> {
  let current = path.resolve(fromDirectory);
  const stopAtResolved = stopAt ? path.resolve(stopAt) : undefined;
  let best: ProjectEvidence | null = null;

  for (let i = 0; i <= maxAscend; i += 1) {
    const evidence = await detectAtDirectory(current);
    if (evidence && (!best || evidence.score > best.score)) {
      best = evidence;
      if (evidence.score >= 95) return evidence;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    if (stopAtResolved && current === stopAtResolved) break;
    if (stopAtResolved) {
      const lowerStop = stopAtResolved.toLowerCase();
      const lowerParent = parent.toLowerCase();
      if (lowerParent !== lowerStop && !lowerParent.startsWith(`${lowerStop}${path.sep.toLowerCase()}`)) {
        break;
      }
    }
    current = parent;
  }

  return best;
}
