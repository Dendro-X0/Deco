import { describe, expect, it } from 'vitest';
import {
  evaluateUpdate,
  parseGitHubRelease,
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

  it('prefers MSI download', () => {
    const picked = pickWindowsDownloadAssets([
      { name: 'deco-cli.zip', download_url: 'https://x/cli.zip', size_bytes: 1 },
      { name: 'setup.msi', download_url: 'https://x/a.msi', size_bytes: 2 },
    ]);
    expect(picked[0]?.name).toBe('setup.msi');
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
