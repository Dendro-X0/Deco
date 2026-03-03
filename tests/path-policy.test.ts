import { describe, expect, it } from 'vitest';
import { createPathPolicy } from '../src/path-policy.js';

describe('path-policy', () => {
  it('blocks system paths even when they contain target names', () => {
    const policy = createPathPolicy({ extraProtectedPathContains: [], allowPathContains: [] });
    const match = policy.findMatch('C:/Program Files/Cursor/resources/app/node_modules');

    expect(match).not.toBeNull();
    expect(match?.risk).toBe('blocked');
    expect(match?.safetyClass).toBe('system');
    expect(match?.reasonCodes).toContain('PROTECTED_SYSTEM_PATH');
  });

  it('blocks electron runtime paths outside system folders', () => {
    const policy = createPathPolicy({ extraProtectedPathContains: [], allowPathContains: [] });
    const match = policy.findMatch('E:/Apps/Cursor/resources/app/node_modules');

    expect(match).not.toBeNull();
    expect(match?.risk).toBe('blocked');
    expect(match?.safetyClass).toBe('app_runtime');
    expect(match?.reasonCodes).toContain('ELECTRON_RUNTIME_PATH');
  });

  it('downgrades non-system blocked paths when allowlisted', () => {
    const policy = createPathPolicy({
      extraProtectedPathContains: ['/custom/runtime/'],
      allowPathContains: ['/custom/runtime/dev/'],
    });

    const match = policy.findMatch('E:/custom/runtime/dev/node_modules');
    expect(match?.risk).toBe('review');
    expect(match?.reasonCodes).toContain('ALLOWLIST_DOWNGRADE');
  });

  it('does not downgrade system protections via allowlist', () => {
    const policy = createPathPolicy({
      extraProtectedPathContains: [],
      allowPathContains: ['/program files/'],
    });

    const match = policy.findMatch('C:/Program Files/node_modules');
    expect(match?.risk).toBe('blocked');
    expect(match?.safetyClass).toBe('system');
  });
});