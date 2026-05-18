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

  if (await dirHasJvmMarker(dir)) {
    return {
      projectRoot: dir,
      score: 95,
      reasons: ['jvm-project-marker'],
    };
  }

  if (await dirHasDotnetMarker(dir)) {
    return {
      projectRoot: dir,
      score: 95,
      reasons: ['dotnet-project-marker'],
    };
  }

  if (await dirHasPythonMarker(dir)) {
    return {
      projectRoot: dir,
      score: 95,
      reasons: ['python-project-marker'],
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

/** True when `go.mod` exists on `fromDirectory` or up to `maxAscend` parents. */
export async function hasGoModAncestor(fromDirectory: string, maxAscend = 6): Promise<boolean> {
  let current = path.resolve(fromDirectory);
  for (let i = 0; i <= maxAscend; i += 1) {
    if (await exists(path.join(current, 'go.mod'))) return true;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return false;
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

async function dirHasPythonMarker(dir: string): Promise<boolean> {
  const files = ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile', 'poetry.lock'];
  return (await Promise.all(files.map((f) => exists(path.join(dir, f))))).some(Boolean);
}

async function dirHasJvmMarker(dir: string): Promise<boolean> {
  const files = [
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'settings.gradle',
    'settings.gradle.kts',
    'gradlew',
    'gradlew.bat',
  ];
  return (await Promise.all(files.map((f) => exists(path.join(dir, f))))).some(Boolean);
}

async function dirHasDotnetMarker(dir: string): Promise<boolean> {
  const files = ['global.json', 'Directory.Build.props', 'Directory.Build.targets'];
  if ((await Promise.all(files.map((f) => exists(path.join(dir, f))))).some(Boolean)) {
    return true;
  }
  try {
    const entries = await readdir(dir);
    return entries.some((name) => {
      const lower = name.toLowerCase();
      return lower.endsWith('.csproj') || lower.endsWith('.fsproj') || lower.endsWith('.vbproj') || lower.endsWith('.sln');
    });
  } catch {
    return false;
  }
}

async function hasMarkerAncestor(
  fromDirectory: string,
  maxAscend: number,
  marker: (dir: string) => Promise<boolean>
): Promise<boolean> {
  let current = path.resolve(fromDirectory);
  for (let i = 0; i <= maxAscend; i += 1) {
    if (await marker(current)) return true;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return false;
}

export function hasPythonProjectAncestor(fromDirectory: string, maxAscend = 6): Promise<boolean> {
  return hasMarkerAncestor(fromDirectory, maxAscend, dirHasPythonMarker);
}

export function hasJvmProjectAncestor(fromDirectory: string, maxAscend = 6): Promise<boolean> {
  return hasMarkerAncestor(fromDirectory, maxAscend, dirHasJvmMarker);
}

export function hasDotnetProjectAncestor(fromDirectory: string, maxAscend = 6): Promise<boolean> {
  return hasMarkerAncestor(fromDirectory, maxAscend, dirHasDotnetMarker);
}

async function dirHasCmakeMarker(dir: string): Promise<boolean> {
  return (await exists(path.join(dir, 'CMakeLists.txt'))) || (await exists(path.join(dir, 'CMakeCache.txt')));
}

async function dirHasMesonMarker(dir: string): Promise<boolean> {
  return exists(path.join(dir, 'meson.build'));
}

async function dirHasVcxprojMarker(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    return entries.some((name) => {
      const lower = name.toLowerCase();
      return lower.endsWith('.vcxproj') || lower.endsWith('.vcxproj.filters') || lower.endsWith('.sln');
    });
  } catch {
    return false;
  }
}

export async function dirHasCppNativeMarker(dir: string): Promise<boolean> {
  return (await dirHasCmakeMarker(dir)) || (await dirHasVcxprojMarker(dir)) || (await dirHasMesonMarker(dir));
}

export function hasCmakeProjectAncestor(fromDirectory: string, maxAscend = 6): Promise<boolean> {
  return hasMarkerAncestor(fromDirectory, maxAscend, dirHasCmakeMarker);
}

export function hasMesonProjectAncestor(fromDirectory: string, maxAscend = 6): Promise<boolean> {
  return hasMarkerAncestor(fromDirectory, maxAscend, dirHasMesonMarker);
}

export function hasCppNativeProjectAncestor(fromDirectory: string, maxAscend = 6): Promise<boolean> {
  return hasMarkerAncestor(fromDirectory, maxAscend, dirHasCppNativeMarker);
}

export function isMesonBuildDirName(name: string): boolean {
  return name === 'builddir' || name === '_build';
}

export function isCppIdeDirName(name: string): boolean {
  return name === '.vs';
}

async function dirHasBazelMarker(dir: string): Promise<boolean> {
  return (
    (await exists(path.join(dir, 'WORKSPACE'))) ||
    (await exists(path.join(dir, 'WORKSPACE.bazel'))) ||
    (await exists(path.join(dir, 'MODULE.bazel')))
  );
}

export function hasBazelProjectAncestor(fromDirectory: string, maxAscend = 6): Promise<boolean> {
  return hasMarkerAncestor(fromDirectory, maxAscend, dirHasBazelMarker);
}

export function isBazelOutputDirName(name: string): boolean {
  return name.startsWith('bazel-');
}

async function dirHasXmakeMarker(dir: string): Promise<boolean> {
  return exists(path.join(dir, 'xmake.lua'));
}

async function dirHasPremakeMarker(dir: string): Promise<boolean> {
  return (await exists(path.join(dir, 'premake5.lua'))) || (await exists(path.join(dir, 'premake4.lua')));
}

async function dirHasQmakeMarker(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    return entries.some((name) => {
      const lower = name.toLowerCase();
      return lower.endsWith('.pro') || lower.endsWith('.qmake.stash') || lower === '.qmake.cache';
    });
  } catch {
    return false;
  }
}

export function hasXmakeProjectAncestor(fromDirectory: string, maxAscend = 6): Promise<boolean> {
  return hasMarkerAncestor(fromDirectory, maxAscend, dirHasXmakeMarker);
}

export function hasPremakeProjectAncestor(fromDirectory: string, maxAscend = 6): Promise<boolean> {
  return hasMarkerAncestor(fromDirectory, maxAscend, dirHasPremakeMarker);
}

export function hasQmakeProjectAncestor(fromDirectory: string, maxAscend = 6): Promise<boolean> {
  return hasMarkerAncestor(fromDirectory, maxAscend, dirHasQmakeMarker);
}

export function isXmakeBuildDirName(name: string): boolean {
  return name === '.build';
}

export function isPremakeBuildDirName(name: string): boolean {
  return name === 'bin-int' || name === 'bin-int64';
}

export function isQmakeShadowBuildDirName(name: string): boolean {
  return name.startsWith('build-') && !name.startsWith('bazel-');
}

export function isMsvcConfigDirName(name: string): boolean {
  return name === 'Debug' || name === 'Release' || name === 'RelWithDebInfo' || name === 'MinSizeRel';
}

export function isMsvcArchDirName(name: string): boolean {
  return ['x64', 'x86', 'Win32', 'ARM64', 'ARM', 'amd64', 'i386'].includes(name);
}
