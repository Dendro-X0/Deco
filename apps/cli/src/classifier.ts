import path from 'node:path';
import { detectProjectRoot } from './project-detection.js';
import type { CleanupCandidate, CliOptions, ReasonCode, SafetyClass } from './types.js';
import type { DiscoveredTarget } from './scan.js';

function uniqueReasonCodes(codes: readonly ReasonCode[]): readonly ReasonCode[] {
  return [...new Set(codes)];
}

function baseCandidate(
  target: DiscoveredTarget,
  risk: CleanupCandidate['risk'],
  safetyClass: SafetyClass,
  reasonCodes: readonly ReasonCode[],
  projectRoot?: string,
  staleDays?: number,
): CleanupCandidate {
  return {
    kind: target.kind,
    absPath: target.absPath,
    mtimeMs: target.mtimeMs,
    risk,
    safetyClass,
    reasonCodes: uniqueReasonCodes(reasonCodes),
    projectRoot,
    staleDays,
  };
}

export async function classifyTargets(
  discovered: readonly DiscoveredTarget[],
  options: CliOptions,
  pathPolicy: { findMatch: (absPath: string) => { risk: CleanupCandidate['risk']; safetyClass: SafetyClass; reasonCodes: readonly ReasonCode[] } | null }
): Promise<CleanupCandidate[]> {
  const nowMs = Date.now();
  const resolvedRoots = options.roots.map((root) => path.resolve(root));

  function getContainingRoot(absPath: string): string | undefined {
    const resolved = path.resolve(absPath).toLowerCase();
    let match: string | undefined;
    for (const root of resolvedRoots) {
      const lowerRoot = root.toLowerCase();
      if (resolved === lowerRoot || resolved.startsWith(`${lowerRoot}${path.sep.toLowerCase()}`)) {
        if (!match || root.length > match.length) match = root;
      }
    }
    return match;
  }

  const classified = await Promise.all(
    discovered.map(async (target): Promise<CleanupCandidate> => {
      if (
        target.kind === 'go-global-cache' ||
        target.kind === 'jvm-global-cache' ||
        target.kind === 'ide-global-cache' ||
        target.kind === 'npm-global-cache' ||
        target.kind === 'pnpm-global-store' ||
        target.kind === 'yarn-global-cache' ||
        target.kind === 'pip-global-cache' ||
        target.kind === 'uv-global-cache' ||
        target.kind === 'conda-pkgs-cache' ||
        target.kind === 'cargo-registry-cache' ||
        target.kind === 'bun-global-cache' ||
        target.kind === 'nuget-global-cache' ||
        target.kind === 'composer-global-cache' ||
        target.kind === 'vcpkg-installed-cache' ||
        target.kind === 'conan-global-cache' ||
        target.kind === 'ccache-global-cache' ||
        target.kind === 'sccache-global-cache' ||
        target.kind === 'bazel-disk-cache'
      ) {
        const reasonCodes: CleanupCandidate['reasonCodes'] = [
          'GLOBAL_CACHE_TARGET',
          'GLOBAL_CACHE_REQUIRES_OPT_IN',
        ];
        const candidate = baseCandidate(target, 'review', 'global_cache', reasonCodes);
        return {
          ...candidate,
          reasonCodes:
            target.kind === 'conda-pkgs-cache'
              ? [...reasonCodes, 'CONDA_PKGS_CACHE_ONLY' as const]
              : reasonCodes,
        };
      }

      const pathMatch = pathPolicy.findMatch(target.absPath);
      if (pathMatch) {
        return baseCandidate(target, pathMatch.risk, pathMatch.safetyClass, pathMatch.reasonCodes);
      }

      if (path.basename(target.absPath) === '.vs') {
        const scanRoot = getContainingRoot(target.absPath);
        const projectEvidence = await detectProjectRoot(path.dirname(target.absPath), 4, scanRoot);
        return baseCandidate(
          target,
          'review',
          'project_artifact',
          ['CPP_VS_IDE_FOLDER', 'IDE_INDEX_NOT_COMPILE_OUTPUT'],
          projectEvidence?.projectRoot,
        );
      }

      if (path.basename(target.absPath) === '.cxx') {
        const scanRoot = getContainingRoot(target.absPath);
        const projectEvidence = await detectProjectRoot(path.dirname(target.absPath), 4, scanRoot);
        return baseCandidate(
          target,
          'review',
          'project_artifact',
          ['GRADLE_ANDROID_CXX_BUILD', 'EXTERNAL_NATIVE_BUILD_OUTPUT'],
          projectEvidence?.projectRoot,
        );
      }

      if (target.kind === 'python-venv') {
        return baseCandidate(target, 'review', 'unknown', [
          'PYTHON_VENV_HIGH_RISK',
          'PYTHON_VENV_REQUIRES_OPT_IN',
        ]);
      }

      if (target.kind === 'unknown-artifact') {
        return baseCandidate(target, 'review', 'unknown', ['UNKNOWN_ARTIFACT', 'LOW_CONFIDENCE_ARTIFACT']);
      }

      const scanRoot = getContainingRoot(target.absPath);
      const projectEvidence = await detectProjectRoot(path.dirname(target.absPath), 4, scanRoot);
      const hasProject = Boolean(projectEvidence);

      if (target.kind === 'node_modules') {
        if (!hasProject) {
          return baseCandidate(target, 'blocked', 'unknown', ['NODE_MODULES_OUTSIDE_PROJECT', 'PROJECT_MARKERS_MISSING']);
        }

        if (typeof target.mtimeMs !== 'number') {
          return baseCandidate(
            target,
            'review',
            'project_artifact',
            ['PROJECT_MARKERS_PRESENT', 'LOW_CONFIDENCE_ARTIFACT'],
            projectEvidence?.projectRoot,
          );
        }

        const staleDays = Math.floor((nowMs - target.mtimeMs) / (1000 * 60 * 60 * 24));
        if (staleDays >= options.staleDays) {
          return baseCandidate(
            target,
            'safe',
            'project_artifact',
            ['PROJECT_MARKERS_PRESENT', 'NODE_MODULES_STALE'],
            projectEvidence?.projectRoot,
            staleDays,
          );
        }

        return baseCandidate(
          target,
          'review',
          'project_artifact',
          ['PROJECT_MARKERS_PRESENT', 'NODE_MODULES_NOT_STALE'],
          projectEvidence?.projectRoot,
          staleDays,
        );
      }

      if (hasProject) {
        return baseCandidate(target, 'safe', 'project_artifact', ['PROJECT_MARKERS_PRESENT'], projectEvidence?.projectRoot);
      }

      return baseCandidate(target, 'review', 'unknown', ['PROJECT_MARKERS_MISSING', 'LOW_CONFIDENCE_ARTIFACT']);
    })
  );

  return classified;
}
