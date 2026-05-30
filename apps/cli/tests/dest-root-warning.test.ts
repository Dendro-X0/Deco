import { describe, expect, it } from 'vitest';
import { destRootLeafWarning } from '../src/dest-root-warning.js';

describe('destRootLeafWarning', () => {
  it('warns when dest root ends with tool leaf', () => {
    const msg = destRootLeafWarning('G:\\DevToolData\\Cursor', 'cursor');
    expect(msg).toBeDefined();
    expect(msg).toContain('Cursor');
  });

  it('allows parent dest root', () => {
    expect(destRootLeafWarning('G:\\DevToolData', 'cursor')).toBeUndefined();
  });
});
