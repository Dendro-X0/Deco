import { describe, expect, it } from 'vitest';
import {
  parseTagVersion,
  pickMacDmg,
  pickWindowsInstaller,
  sha256FromDigest,
} from '../../../scripts/lib/release-assets.mjs';

describe('release-assets', () => {
  it('parseTagVersion strips v prefix', () => {
    expect(parseTagVersion('v0.8.0')).toBe('0.8.0');
  });

  it('sha256FromDigest parses GitHub digest', () => {
    expect(sha256FromDigest('sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789')).toMatch(
      /^[A-F0-9]{64}$/,
    );
  });

  it('pickWindowsInstaller prefers msi', () => {
    const picked = pickWindowsInstaller([
      { name: 'Deco_0.7.8_x64-setup.exe', browser_download_url: 'https://x/e.exe' },
      { name: 'Deco_0.7.8_x64_en-US.msi', browser_download_url: 'https://x/a.msi', digest: 'sha256:' + 'a'.repeat(64) },
    ]);
    expect(picked?.kind).toBe('wix');
    expect(picked?.asset.name).toContain('.msi');
  });

  it('pickMacDmg prefers aarch64', () => {
    const dmg = pickMacDmg([
      { name: 'Deco_0.8.0_aarch64.dmg', browser_download_url: 'https://x/a.dmg' },
    ]);
    expect(dmg?.name).toBe('Deco_0.8.0_aarch64.dmg');
  });
});
