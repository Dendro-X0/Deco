import type { ReasonCode, RiskLevel, SafetyClass } from './types.js';

export type PathPolicyConfig = {
  readonly extraProtectedPathContains: readonly string[];
  readonly allowPathContains: readonly string[];
};

export type PathPolicyMatch = {
  readonly risk: RiskLevel;
  readonly safetyClass: SafetyClass;
  readonly reasonCodes: readonly ReasonCode[];
  readonly matchedPattern?: string;
};

type ProtectedRule = {
  readonly pattern: string;
  readonly safetyClass: SafetyClass;
  readonly reasonCode: ReasonCode;
};

const SYSTEM_RULES: readonly ProtectedRule[] = [
  { pattern: '/windows/', safetyClass: 'system', reasonCode: 'PROTECTED_SYSTEM_PATH' },
  { pattern: '/system32/', safetyClass: 'system', reasonCode: 'PROTECTED_SYSTEM_PATH' },
  { pattern: '/program files/', safetyClass: 'system', reasonCode: 'PROTECTED_SYSTEM_PATH' },
  { pattern: '/program files (x86)/', safetyClass: 'system', reasonCode: 'PROTECTED_SYSTEM_PATH' },
  { pattern: '/appdata/', safetyClass: 'system', reasonCode: 'PROTECTED_SYSTEM_PATH' },
  { pattern: '/$recycle.bin/', safetyClass: 'system', reasonCode: 'PROTECTED_SYSTEM_PATH' },
  { pattern: '/system volume information/', safetyClass: 'system', reasonCode: 'PROTECTED_SYSTEM_PATH' },
  { pattern: '/config.msi/', safetyClass: 'system', reasonCode: 'PROTECTED_SYSTEM_PATH' },
];

const APP_RUNTIME_RULES: readonly ProtectedRule[] = [
  { pattern: '/resources/app/', safetyClass: 'app_runtime', reasonCode: 'ELECTRON_RUNTIME_PATH' },
  { pattern: '/resources/app.asar/', safetyClass: 'app_runtime', reasonCode: 'ELECTRON_RUNTIME_PATH' },
  { pattern: '/.vscode/', safetyClass: 'app_runtime', reasonCode: 'IDE_RUNTIME_PATH' },
  { pattern: '/.vscode-insiders/', safetyClass: 'app_runtime', reasonCode: 'IDE_RUNTIME_PATH' },
  { pattern: '/.cursor/', safetyClass: 'app_runtime', reasonCode: 'IDE_RUNTIME_PATH' },
  { pattern: '/microsoft vs code/', safetyClass: 'app_runtime', reasonCode: 'IDE_RUNTIME_PATH' },
  { pattern: '/cursor/', safetyClass: 'app_runtime', reasonCode: 'IDE_RUNTIME_PATH' },
];

function normalizePath(value: string): string {
  const replaced = value.replaceAll('\\', '/').toLowerCase();
  if (replaced.endsWith('/')) return replaced;
  return `${replaced}/`;
}

function normalizePattern(value: string): string {
  const replaced = value.replaceAll('\\', '/').toLowerCase();
  if (replaced.startsWith('/')) {
    return replaced.endsWith('/') ? replaced : `${replaced}/`;
  }
  const wrapped = `/${replaced}`;
  return wrapped.endsWith('/') ? wrapped : `${wrapped}/`;
}

export function createPathPolicy(config: PathPolicyConfig) {
  const customRules: ProtectedRule[] = config.extraProtectedPathContains.map((pattern) => ({
    pattern: normalizePattern(pattern),
    safetyClass: 'app_runtime',
    reasonCode: 'CUSTOM_PROTECTED_PATH',
  }));
  const rules = [...SYSTEM_RULES, ...APP_RUNTIME_RULES, ...customRules];
  const allowPatterns = config.allowPathContains.map((pattern) => normalizePattern(pattern));

  function findMatch(absPath: string): PathPolicyMatch | null {
    const normalized = normalizePath(absPath);
    for (const rule of rules) {
      if (!normalized.includes(rule.pattern)) continue;
      const allowMatched = allowPatterns.some((allowPattern) => normalized.includes(allowPattern));
      if (allowMatched && rule.safetyClass !== 'system') {
        return {
          risk: 'review',
          safetyClass: rule.safetyClass,
          reasonCodes: [rule.reasonCode, 'ALLOWLIST_DOWNGRADE'],
          matchedPattern: rule.pattern,
        };
      }
      return {
        risk: 'blocked',
        safetyClass: rule.safetyClass,
        reasonCodes: [rule.reasonCode],
        matchedPattern: rule.pattern,
      };
    }
    return null;
  }

  function shouldPrune(absPath: string): boolean {
    const match = findMatch(absPath);
    return match?.risk === 'blocked';
  }

  return {
    findMatch,
    shouldPrune,
    normalizePath,
  };
}