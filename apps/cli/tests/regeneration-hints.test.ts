import { describe, expect, it } from 'vitest';
import {
  parseRegenerationFromSummary,
  reasonSummaryWithoutRegeneration,
  regenerationHintForKind,
  resolveRegenerationHint,
} from '../../frontend/src/lib/regeneration-hints';

describe('regeneration-hints', () => {
  it('returns hint for npm global cache kind', () => {
    expect(regenerationHintForKind('npm-global-cache')).toContain('npm cache clean');
  });

  it('parses hint from engine summary', () => {
    const summary =
      'global cache target, global cache requires opt in. Regenerate: `npm cache clean --force`';
    expect(parseRegenerationFromSummary(summary)).toContain('npm cache clean');
    expect(reasonSummaryWithoutRegeneration(summary)).not.toContain('Regenerate:');
  });

  it('falls back to kind when summary has no suffix', () => {
    expect(resolveRegenerationHint('pnpm-global-store', 'pnpm store')).toContain('pnpm store prune');
  });
});
