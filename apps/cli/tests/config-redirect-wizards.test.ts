import { describe, expect, it } from 'vitest';
import {
  configRedirectCommands,
  isConfigRedirectTool,
} from '../../frontend/src/lib/config-redirect-wizards';

describe('config-redirect-wizards', () => {
  it('recognizes npm and pnpm redirect tools', () => {
    expect(isConfigRedirectTool('npm-cache')).toBe(true);
    expect(isConfigRedirectTool('pnpm-store')).toBe(true);
    expect(isConfigRedirectTool('cursor')).toBe(false);
  });

  it('builds npm cache setup and verify commands', () => {
    const { setup, verify } = configRedirectCommands('npm-cache', 'D:\\npm-cache');
    expect(setup).toEqual(['npm config set cache "D:\\npm-cache"']);
    expect(verify).toEqual(['npm config get cache']);
  });

  it('builds pnpm store setup and verify commands', () => {
    const { setup, verify } = configRedirectCommands('pnpm-store', 'G:/pnpm-store');
    expect(setup).toEqual(['pnpm config set store-dir "G:/pnpm-store"']);
    expect(verify).toEqual(['pnpm store path']);
  });

  it('returns empty commands for blank dest', () => {
    expect(configRedirectCommands('npm-cache', '  ')).toEqual({ setup: [], verify: [] });
  });
});
