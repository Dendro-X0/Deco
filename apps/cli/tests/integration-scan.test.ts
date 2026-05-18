import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReport } from '../src/cli.js';
import { dedupeScanRoots } from '../src/scan.js';
import type { CliOptions } from '../src/types.js';

const tmpRoots: string[] = [];
const TMP_BASE = path.join(process.cwd(), '.tmp-tests');

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function createOptions(root: string): CliOptions {
  return {
    action: 'scan',
    roots: [root],
    maxDepth: 10,
    mode: 'dry-run',
    yes: false,
    interactive: false,
    includeNodeModules: true,
    includeBuildArtifacts: true,
    includeRustArtifacts: true,
    includePlaywrightArtifacts: true,
    includeGoArtifacts: true,
    includeSize: false,
    checkGoCache: false,
    includePythonArtifacts: true,
    includePythonVenv: false,
    includeJvmArtifacts: true,
    checkJvmGlobalCache: false,
    includeDotnetArtifacts: true,
    checkIdeGlobalCache: false,
    checkNpmCache: false,
    checkPnpmStore: false,
    checkYarnCache: false,
    checkPipCache: false,
    checkUvCache: false,
    checkCondaPkgsCache: false,
    checkBunCache: false,
    checkCargoRegistry: false,
    checkNugetCache: false,
    checkComposerCache: false,
    checkVcpkgCache: false,
    checkConanCache: false,
    checkCcache: false,
    checkSccache: false,
    checkBazelDiskCache: false,
    excludeAbsPathContains: [],
    profile: 'safe',
    deleteMode: 'quarantine',
    staleDays: 45,
    includeReview: false,
    json: false,
    showBlocked: true,
    purgeQuarantine: false,
    quarantineRetentionDays: 30,
    extraProtectedPathContains: [],
    allowPathContains: [],
    additionalDirNames: {
      buildArtifacts: [],
      rustArtifacts: [],
      goArtifacts: [],
      playwrightArtifacts: [],
    },
  };
}

async function createTmpRoot(prefix: string): Promise<string> {
  await mkdir(TMP_BASE, { recursive: true });
  return mkdtemp(path.join(TMP_BASE, prefix));
}

describe('integration scan behavior', () => {
  it('dedupes identical scan roots', async () => {
    const root = await createTmpRoot('deco-duproots-');
    tmpRoots.push(root);
    const app = path.join(root, 'myapp');
    await mkdir(path.join(app, 'node_modules'), { recursive: true });
    await writeFile(path.join(app, 'package.json'), '{}', 'utf8');
    await writeFile(path.join(app, 'pnpm-lock.yaml'), 'lockfileVersion: 9', 'utf8');

    const opts: CliOptions = { ...createOptions(root), roots: [root, path.resolve(root)] };
    const report = await buildReport(opts);
    const nm = report.candidates.filter((c) => c.kind === 'node_modules');
    expect(nm.length).toBe(1);
  });

  it('finds stale project node_modules and avoids IDE runtime node_modules', async () => {
    const root = await createTmpRoot('deco-integration-');
    tmpRoots.push(root);

    const project = path.join(root, 'projects', 'app1');
    await mkdir(path.join(project, 'node_modules'), { recursive: true });
    await writeFile(path.join(project, 'package.json'), '{}', 'utf8');
    await writeFile(path.join(project, 'pnpm-lock.yaml'), 'lockfileVersion: 9', 'utf8');
    const staleDate = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000);
    await utimes(path.join(project, 'node_modules'), staleDate, staleDate);

    const ideRuntimeModules = path.join(root, 'apps', 'Cursor', 'resources', 'app', 'node_modules');
    await mkdir(ideRuntimeModules, { recursive: true });

    const report = await buildReport(createOptions(root));

    const projectNodeModules = report.candidates.find((candidate) => candidate.absPath === path.join(project, 'node_modules'));
    expect(projectNodeModules?.risk).toBe('safe');

    const runtimeEntries = report.candidates.filter((candidate) => candidate.absPath.includes('resources') && candidate.absPath.includes('app'));
    expect(runtimeEntries.length).toBe(0);
  });

  it('discovers Go bin/ only when go.mod is present', async () => {
    const root = await createTmpRoot('deco-go-bin-');
    tmpRoots.push(root);

    const goProject = path.join(root, 'goproj');
    await mkdir(path.join(goProject, 'bin'), { recursive: true });
    await writeFile(path.join(goProject, 'go.mod'), 'module example.com/svc\n', 'utf8');

    await mkdir(path.join(root, 'nogo', 'bin'), { recursive: true });

    const report = await buildReport(createOptions(root));
    const goBins = report.candidates.filter((c) => c.kind === 'go-artifact' && c.absPath.endsWith(`${path.sep}bin`));
    expect(goBins).toHaveLength(1);
    expect(goBins[0]?.absPath).toBe(path.join(goProject, 'bin'));
  });

  it('discovers npm cache only with --check-npm-cache and _cacache marker', async () => {
    const root = await createTmpRoot('deco-npm-cache-flag-');
    tmpRoots.push(root);
    const cacheDir = path.join(path.dirname(root), `npm-cache-${path.basename(root)}`);
    tmpRoots.push(cacheDir);
    await mkdir(path.join(cacheDir, '_cacache'), { recursive: true });
    const prev = process.env.NPM_CONFIG_CACHE;
    process.env.NPM_CONFIG_CACHE = cacheDir;
    try {
      const without = await buildReport(createOptions(root));
      expect(without.candidates.some((c) => c.kind === 'npm-global-cache')).toBe(false);

      const withFlag = await buildReport({ ...createOptions(root), checkNpmCache: true });
      const npmCaches = withFlag.candidates.filter((c) => c.kind === 'npm-global-cache');
      expect(npmCaches.length).toBeGreaterThanOrEqual(1);
      expect(npmCaches.some((c) => c.absPath === cacheDir)).toBe(true);
      for (const c of npmCaches) {
        expect(c.risk).toBe('review');
        expect(c.reasonCodes).toContain('GLOBAL_CACHE_REQUIRES_OPT_IN');
      }
    } finally {
      if (prev === undefined) delete process.env.NPM_CONFIG_CACHE;
      else process.env.NPM_CONFIG_CACHE = prev;
    }
  });

  it('discovers pip cache only with --check-pip-cache and wheels/http marker', async () => {
    const root = await createTmpRoot('deco-pip-cache-flag-');
    tmpRoots.push(root);
    const cacheDir = path.join(path.dirname(root), `pip-cache-${path.basename(root)}`);
    tmpRoots.push(cacheDir);
    await mkdir(path.join(cacheDir, 'wheels'), { recursive: true });
    const prev = process.env.PIP_CACHE_DIR;
    process.env.PIP_CACHE_DIR = cacheDir;
    try {
      const without = await buildReport(createOptions(root));
      expect(without.candidates.some((c) => c.kind === 'pip-global-cache')).toBe(false);

      const withFlag = await buildReport({ ...createOptions(root), checkPipCache: true });
      const pipCaches = withFlag.candidates.filter((c) => c.kind === 'pip-global-cache');
      expect(pipCaches.some((c) => c.absPath === cacheDir)).toBe(true);
      for (const c of pipCaches) {
        expect(c.risk).toBe('review');
        expect(c.reasonCodes).toContain('GLOBAL_CACHE_REQUIRES_OPT_IN');
      }
    } finally {
      if (prev === undefined) delete process.env.PIP_CACHE_DIR;
      else process.env.PIP_CACHE_DIR = prev;
    }
  });

  it('discovers conda pkgs cache only with --check-conda-pkgs-cache and urls.txt marker', async () => {
    const root = await createTmpRoot('deco-conda-pkgs-flag-');
    tmpRoots.push(root);
    const pkgsDir = path.join(path.dirname(root), `conda-pkgs-${path.basename(root)}`);
    tmpRoots.push(pkgsDir);
    await mkdir(pkgsDir, { recursive: true });
    await writeFile(path.join(pkgsDir, 'urls.txt'), 'https://example.invalid\n', 'utf8');
    const prev = process.env.CONDA_PKGS_DIRS;
    process.env.CONDA_PKGS_DIRS = pkgsDir;
    try {
      const without = await buildReport(createOptions(root));
      expect(without.candidates.some((c) => c.kind === 'conda-pkgs-cache')).toBe(false);

      const withFlag = await buildReport({ ...createOptions(root), checkCondaPkgsCache: true });
      const condaCaches = withFlag.candidates.filter((c) => c.kind === 'conda-pkgs-cache');
      expect(condaCaches.some((c) => c.absPath === pkgsDir)).toBe(true);
      for (const c of condaCaches) {
        expect(c.risk).toBe('review');
        expect(c.reasonCodes).toContain('GLOBAL_CACHE_REQUIRES_OPT_IN');
        expect(c.reasonCodes).toContain('CONDA_PKGS_CACHE_ONLY');
      }
      expect(withFlag.errors.some((e) => e.includes('envs/'))).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.CONDA_PKGS_DIRS;
      else process.env.CONDA_PKGS_DIRS = prev;
    }
  });

  it('does not include global Go caches unless --check-go-cache', async () => {
    const root = await createTmpRoot('deco-go-cache-flag-');
    tmpRoots.push(root);
    const without = await buildReport(createOptions(root));
    expect(without.candidates.some((c) => c.kind === 'go-global-cache')).toBe(false);

    const withFlag = await buildReport({ ...createOptions(root), checkGoCache: true });
    // May be empty when `go` is not installed; when present, must be review-tier global cache.
    for (const c of withFlag.candidates.filter((x) => x.kind === 'go-global-cache')) {
      expect(c.risk).toBe('review');
      expect(c.reasonCodes).toContain('GLOBAL_CACHE_REQUIRES_OPT_IN');
    }
  });

  it('discovers __pycache__ only with Python project markers', async () => {
    const root = await createTmpRoot('deco-py-cache-');
    tmpRoots.push(root);
    const pyProject = path.join(root, 'pyapp');
    await mkdir(path.join(pyProject, 'src', '__pycache__'), { recursive: true });
    await writeFile(path.join(pyProject, 'pyproject.toml'), '[project]\nname = "x"\n', 'utf8');
    await mkdir(path.join(root, 'nopy', '__pycache__'), { recursive: true });

    const report = await buildReport(createOptions(root));
    const caches = report.candidates.filter((c) => c.kind === 'python-artifact');
    expect(caches).toHaveLength(1);
    expect(caches[0]?.absPath).toContain('pyapp');
  });

  it('does not descend into node_modules during discovery', async () => {
    const root = await createTmpRoot('deco-prune-nm-');
    tmpRoots.push(root);
    const project = path.join(root, 'app');
    await mkdir(path.join(project, 'node_modules', '.cache', 'deep'), { recursive: true });
    await writeFile(path.join(project, 'package.json'), '{}', 'utf8');

    const report = await buildReport({ ...createOptions(root), profile: 'aggressive' });
    expect(report.candidates.some((c) => c.kind === 'node_modules')).toBe(true);
    expect(
      report.candidates.some((c) => c.absPath.includes('node_modules') && c.absPath.includes('deep'))
    ).toBe(false);
  });

  it('discovers Meson builddir and CMake out on balanced profile', async () => {
    const root = await createTmpRoot('deco-cpp-native-');
    tmpRoots.push(root);

    const cmake = path.join(root, 'cmake-app');
    await mkdir(cmake, { recursive: true });
    await writeFile(path.join(cmake, 'CMakeLists.txt'), 'cmake_minimum_required(VERSION 3.16)\n', 'utf8');
    await mkdir(path.join(cmake, 'out'), { recursive: true });

    const meson = path.join(root, 'meson-app');
    await mkdir(meson, { recursive: true });
    await writeFile(path.join(meson, 'meson.build'), "project('demo', 'c')\n", 'utf8');
    await mkdir(path.join(meson, 'builddir'), { recursive: true });

    const report = await buildReport({ ...createOptions(root), profile: 'balanced' });
    expect(report.candidates.some((c) => c.absPath === path.join(cmake, 'out'))).toBe(true);
    expect(report.candidates.some((c) => c.absPath === path.join(meson, 'builddir'))).toBe(true);
  });

  it('discovers Xmake, Premake, and Qt shadow builds on balanced profile', async () => {
    const root = await createTmpRoot('deco-native-alt-');
    tmpRoots.push(root);

    const xmake = path.join(root, 'xmake-app');
    await mkdir(xmake, { recursive: true });
    await writeFile(path.join(xmake, 'xmake.lua'), 'set_project("demo")\n', 'utf8');
    await mkdir(path.join(xmake, '.build'), { recursive: true });

    const premake = path.join(root, 'premake-app');
    await mkdir(premake, { recursive: true });
    await writeFile(path.join(premake, 'premake5.lua'), 'workspace "w"\n', 'utf8');
    await mkdir(path.join(premake, 'bin-int'), { recursive: true });

    const qt = path.join(root, 'qt-app');
    await mkdir(qt, { recursive: true });
    await writeFile(path.join(qt, 'app.pro'), 'TEMPLATE = app\n', 'utf8');
    await mkdir(path.join(qt, 'build-Desktop-Debug'), { recursive: true });

    const report = await buildReport({ ...createOptions(root), profile: 'balanced' });
    expect(report.candidates.some((c) => c.absPath === path.join(xmake, '.build'))).toBe(true);
    expect(report.candidates.some((c) => c.absPath === path.join(premake, 'bin-int'))).toBe(true);
    expect(report.candidates.some((c) => c.absPath === path.join(qt, 'build-Desktop-Debug'))).toBe(
      true,
    );
  });

  it('discovers Bazel bazel-out on balanced profile', async () => {
    const root = await createTmpRoot('deco-bazel-');
    tmpRoots.push(root);

    await writeFile(path.join(root, 'MODULE.bazel'), 'module(name = "demo")\n', 'utf8');
    await mkdir(path.join(root, 'bazel-out'), { recursive: true });

    const report = await buildReport({ ...createOptions(root), profile: 'balanced' });
    expect(report.candidates.some((c) => c.absPath === path.join(root, 'bazel-out'))).toBe(true);
  });

  it('discovers Android .cxx on balanced when Gradle markers present', async () => {
    const root = await createTmpRoot('deco-cxx-');
    tmpRoots.push(root);

    const app = path.join(root, 'app');
    await mkdir(path.join(app, '.cxx'), { recursive: true });
    await writeFile(path.join(app, 'build.gradle'), '// stub\n', 'utf8');
    await writeFile(path.join(root, 'settings.gradle'), 'rootProject.name = "demo"\n', 'utf8');

    const report = await buildReport({ ...createOptions(root), profile: 'balanced' });
    const cxx = report.candidates.find((c) => c.absPath === path.join(app, '.cxx'));
    expect(cxx?.kind).toBe('build-artifact');
    expect(cxx?.risk).toBe('review');
    expect(cxx?.reasonCodes).toContain('GRADLE_ANDROID_CXX_BUILD');
  });

  it('discovers Bazel disk cache when BAZEL_DISK_CACHE is set and layout matches', async () => {
    const cacheRoot = await createTmpRoot('deco-bazel-disk-');
    tmpRoots.push(cacheRoot);
    await mkdir(path.join(cacheRoot, 'cas'), { recursive: true });
    const prev = process.env.BAZEL_DISK_CACHE;
    process.env.BAZEL_DISK_CACHE = cacheRoot;

    try {
      const report = await buildReport({ ...createOptions(cacheRoot), checkBazelDiskCache: true });
      const hit = report.candidates.find((c) => c.absPath === cacheRoot);
      expect(hit?.kind).toBe('bazel-disk-cache');
      expect(hit?.risk).toBe('review');
    } finally {
      if (prev === undefined) delete process.env.BAZEL_DISK_CACHE;
      else process.env.BAZEL_DISK_CACHE = prev;
    }
  });

  it('discovers vcpkg installed tree with opt-in flag', async () => {
    const root = await createTmpRoot('deco-vcpkg-');
    tmpRoots.push(root);
    const prev = process.env.VCPKG_ROOT;
    process.env.VCPKG_ROOT = root;

    try {
      await writeFile(path.join(root, '.vcpkg-root'), '', 'utf8');
      await mkdir(path.join(root, 'installed', 'x64-windows'), { recursive: true });

      const report = await buildReport({ ...createOptions(root), checkVcpkgCache: true });
      expect(report.candidates.some((c) => c.absPath === path.join(root, 'installed'))).toBe(true);
      expect(report.candidates.find((c) => c.absPath === path.join(root, 'installed'))?.risk).toBe(
        'review',
      );
    } finally {
      if (prev === undefined) delete process.env.VCPKG_ROOT;
      else process.env.VCPKG_ROOT = prev;
    }
  });

  it('classifies Visual Studio .vs folder as review', async () => {
    const root = await createTmpRoot('deco-vs-');
    tmpRoots.push(root);

    const project = path.join(root, 'native');
    await mkdir(project, { recursive: true });
    await writeFile(path.join(project, 'app.vcxproj'), '<?xml version="1.0"?>\n', 'utf8');
    await mkdir(path.join(project, '.vs'), { recursive: true });

    const report = await buildReport({ ...createOptions(root), profile: 'balanced' });
    const vs = report.candidates.find((c) => c.absPath === path.join(project, '.vs'));
    expect(vs?.kind).toBe('build-artifact');
    expect(vs?.risk).toBe('review');
    expect(vs?.reasonCodes).toContain('CPP_VS_IDE_FOLDER');
  });

  it('discovers dist-firefox as a build artifact inside a project', async () => {
    const root = await createTmpRoot('deco-firefox-');
    tmpRoots.push(root);

    const project = path.join(root, 'ext');
    await mkdir(path.join(project, 'dist-firefox'), { recursive: true });
    await writeFile(path.join(project, 'package.json'), '{}', 'utf8');

    const report = await buildReport(createOptions(root));
    const firefox = report.candidates.find((c) => c.absPath === path.join(project, 'dist-firefox'));
    expect(firefox?.kind).toBe('build-artifact');
  });
});

describe('scan root helpers', () => {
  it('dedupeScanRoots removes case-duplicate paths on Windows', () => {
    if (process.platform !== 'win32') {
      expect(dedupeScanRoots(['/a/b', '/a/c'])).toHaveLength(2);
      return;
    }
    expect(dedupeScanRoots(['C:\\Temp\\deco-dedupe', 'c:\\Temp\\deco-dedupe'])).toHaveLength(1);
  });
});
