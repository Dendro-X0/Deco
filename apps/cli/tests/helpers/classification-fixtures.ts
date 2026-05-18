import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RiskLevel, SafetyClass, TargetDirKind } from '../../src/types.js';

export type ClassificationFixtureCase = {
  readonly id: string;
  readonly setup: readonly { readonly path: string; readonly content?: string; readonly type?: 'dir' }[];
  readonly targets: readonly { readonly kind: TargetDirKind; readonly rel_path: string; readonly age_days: number }[];
  readonly expect: readonly {
    readonly risk: RiskLevel;
    readonly safety_class: SafetyClass;
    readonly reason_codes: readonly string[];
  }[];
};

export type ClassificationFixtureManifest = {
  readonly version: number;
  readonly stale_days: number;
  readonly cases: readonly ClassificationFixtureCase[];
};

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'classification', 'cases.json');

export function classificationManifestPath(): string {
  return MANIFEST_PATH;
}

export async function loadClassificationManifest(): Promise<ClassificationFixtureManifest> {
  const raw = await import('node:fs/promises').then((fs) => fs.readFile(MANIFEST_PATH, 'utf8'));
  return JSON.parse(raw) as ClassificationFixtureManifest;
}

export async function materializeClassificationCase(
  caseDef: ClassificationFixtureCase,
  tmpBase: string,
): Promise<{ readonly root: string; readonly mtimeByRel: ReadonlyMap<string, number> }> {
  await mkdir(tmpBase, { recursive: true });
  const root = await mkdtemp(path.join(tmpBase, `deco-classify-${caseDef.id}-`));

  for (const entry of caseDef.setup) {
    const abs = path.join(root, entry.path);
    if (entry.type === 'dir') {
      await mkdir(abs, { recursive: true });
    } else {
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, entry.content ?? '', 'utf8');
    }
  }

  const mtimeByRel = new Map<string, number>();
  const now = Date.now();
  for (const target of caseDef.targets) {
    const abs = path.join(root, target.rel_path);
    await mkdir(abs, { recursive: true });
    const mtimeMs = now - target.age_days * 24 * 60 * 60 * 1000;
    const date = new Date(mtimeMs);
    await utimes(abs, date, date);
    mtimeByRel.set(target.rel_path, mtimeMs);
  }

  return { root, mtimeByRel };
}

export async function cleanupClassificationRoot(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}
