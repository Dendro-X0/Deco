import { isNewerVersion } from './semver';

export const GITHUB_REPO = 'Dendro-X0/Deco';
export const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases`;
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export type ReleaseAsset = {
  name: string;
  download_url: string;
  size_bytes: number;
};

export type LatestReleaseInfo = {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  body: string;
  assets: ReleaseAsset[];
};

export type UpdateCheckResult =
  | { status: 'current'; latest: LatestReleaseInfo }
  | { status: 'update_available'; latest: LatestReleaseInfo }
  | { status: 'error'; message: string };

type GitHubReleaseJson = {
  tag_name?: string;
  name?: string;
  html_url?: string;
  published_at?: string;
  body?: string;
  assets?: Array<{
    name?: string;
    browser_download_url?: string;
    size?: number;
  }>;
};

export function parseGitHubRelease(json: unknown): LatestReleaseInfo | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as GitHubReleaseJson;
  const tag = r.tag_name?.trim();
  const html_url = r.html_url?.trim();
  if (!tag || !html_url) return null;
  const assets: ReleaseAsset[] = [];
  for (const a of r.assets ?? []) {
    const name = a.name?.trim();
    const download_url = a.browser_download_url?.trim();
    if (!name || !download_url) continue;
    assets.push({
      name,
      download_url,
      size_bytes: typeof a.size === 'number' ? a.size : 0,
    });
  }
  return {
    tag_name: tag,
    name: r.name?.trim() || tag,
    html_url,
    published_at: r.published_at ?? '',
    body: r.body ?? '',
    assets,
  };
}

/** Prefer MSI, then NSIS exe, then CLI zip for Windows desktop users. */
export function pickWindowsDownloadAssets(assets: ReleaseAsset[]): ReleaseAsset[] {
  const ranked = [...assets].sort((a, b) => scoreAsset(b.name) - scoreAsset(a.name));
  const msi = ranked.find((a) => a.name.toLowerCase().endsWith('.msi'));
  if (msi) return [msi];
  const exe = ranked.find((a) => a.name.toLowerCase().endsWith('.exe'));
  if (exe) return [exe];
  const cli = ranked.find((a) => a.name.toLowerCase().includes('deco-cli') && a.name.endsWith('.zip'));
  return cli ? [cli] : ranked.slice(0, 3);
}

function scoreAsset(name: string): number {
  const n = name.toLowerCase();
  if (n.endsWith('.msi')) return 100;
  if (n.endsWith('.exe')) return 80;
  if (n.includes('deco-cli') && n.endsWith('.zip')) return 60;
  return 10;
}

export async function fetchLatestRelease(signal?: AbortSignal): Promise<LatestReleaseInfo> {
  const res = await fetch(LATEST_RELEASE_API, {
    signal,
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  }
  const json: unknown = await res.json();
  const parsed = parseGitHubRelease(json);
  if (!parsed) throw new Error('Unexpected release JSON from GitHub');
  return parsed;
}

export function evaluateUpdate(
  currentVersion: string,
  latest: LatestReleaseInfo,
): UpdateCheckResult {
  if (isNewerVersion(latest.tag_name, currentVersion)) {
    return { status: 'update_available', latest };
  }
  return { status: 'current', latest };
}
