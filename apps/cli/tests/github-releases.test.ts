import { describe, expect, it } from 'vitest';
import {
  evaluateUpdate,
  parseGitHubRelease,
  pickPlatformDownloadAssets,
  pickWindowsDownloadAssets,
} from '../../frontend/src/lib/github-releases';

describe('github-releases', () => {
  it('parses release JSON', () => {
    const release = parseGitHubRelease({
      tag_name: 'v0.6.7',
      html_url: 'https://github.com/Dendro-X0/Deco/releases/tag/v0.6.7',
      assets: [
        {
          name: 'Deco_0.6.7_x64-setup.msi',
          browser_download_url: 'https://example.com/a.msi',
          size: 1024,
        },
      ],
    });
    expect(release?.tag_name).toBe('v0.6.7');
    expect(release?.assets).toHaveLength(1);
  });

  it('prefers MSI on Windows', () => {
    const picked = pickWindowsDownloadAssets([
      { name: 'deco-cli.zip', download_url: 'https://x/cli.zip', size_bytes: 1 },
      { name: 'setup.msi', download_url: 'https://x/a.msi', size_bytes: 2 },
    ]);
    expect(picked[0]?.name).toBe('setup.msi');
  });

  it('prefers MSI over EXE on Windows x64', () => {
    const picked = pickPlatformDownloadAssets(
      [
        { name: 'Deco_0.8.2_x64-setup.exe', download_url: 'https://x/a.exe', size_bytes: 1 },
        { name: 'Deco_0.8.2_x64_en-US.msi', download_url: 'https://x/a.msi', size_bytes: 2 },
      ],
      { os: 'windows', arch: 'x86_64' },
    );
    expect(picked[0]?.install_kind).toBe('msi');
  });

  it('picks macOS dmg when present', () => {
    const picked = pickPlatformDownloadAssets(
      [
        { name: 'Deco_0.8.2_x64-setup.msi', download_url: 'https://x/a.msi', size_bytes: 1 },
        { name: 'Deco_0.8.2_universal.dmg', download_url: 'https://x/a.dmg', size_bytes: 2 },
      ],
      { os: 'macos', arch: 'aarch64' },
    );
    expect(picked[0]?.install_kind).toBe('dmg');
  });

  it('picks Linux AppImage when present', () => {
    const picked = pickPlatformDownloadAssets(
      [
        { name: 'Deco_0.8.2_amd64.AppImage', download_url: 'https://x/a.AppImage', size_bytes: 2 },
        { name: 'deco-cli-linux-x64.zip', download_url: 'https://x/cli.zip', size_bytes: 1 },
      ],
      { os: 'linux', arch: 'x86_64' },
    );
    expect(picked[0]?.install_kind).toBe('appimage');
  });

  it('picks Tauri-style deb without linux in filename', () => {
    const picked = pickPlatformDownloadAssets(
      [{ name: 'deco_0.8.2_amd64.deb', download_url: 'https://x/a.deb', size_bytes: 1 }],
      { os: 'linux', arch: 'x86_64' },
    );
    expect(picked[0]?.install_kind).toBe('deb');
  });

  it('picks aarch64 dmg on Apple Silicon Mac', () => {
    const picked = pickPlatformDownloadAssets(
      [
        { name: 'Deco_0.8.2_x64-setup.msi', download_url: 'https://x/a.msi', size_bytes: 1 },
        { name: 'Deco_0.8.2_aarch64.dmg', download_url: 'https://x/a.dmg', size_bytes: 2 },
      ],
      { os: 'macos', arch: 'aarch64' },
    );
    expect(picked[0]?.install_kind).toBe('dmg');
  });

  it('detects update available', () => {
    const latest = parseGitHubRelease({
      tag_name: 'v0.6.8',
      html_url: 'https://github.com/Dendro-X0/Deco/releases/tag/v0.6.8',
      assets: [],
    })!;
    expect(evaluateUpdate('0.6.7', latest).status).toBe('update_available');
    expect(evaluateUpdate('0.6.8', latest).status).toBe('current');
  });
});
