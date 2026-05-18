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

export type AppOs = 'windows' | 'macos' | 'linux';
export type AppArch = 'x86_64' | 'aarch64' | string;

export type AppPlatform = {
  os: AppOs;
  arch: AppArch;
};

export type PlatformInstallKind = 'msi' | 'exe' | 'dmg' | 'pkg' | 'appimage' | 'deb' | 'rpm' | 'zip' | 'unknown';

export type PlatformInstallAsset = ReleaseAsset & {
  install_kind: PlatformInstallKind;
  /** Higher = preferred when multiple assets match. */
  score: number;
};

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

function assetNameLower(name: string): string {
  return name.toLowerCase();
}

function matchesArch(nameLower: string, arch: AppArch): boolean {
  if (arch === 'aarch64' || arch === 'arm64') {
    return (
      nameLower.includes('aarch64') ||
      nameLower.includes('arm64') ||
      nameLower.includes('universal') ||
      nameLower.includes('apple-silicon')
    );
  }
  if (arch === 'x86_64' || arch === 'amd64') {
    if (nameLower.includes('aarch64') || nameLower.includes('arm64')) return false;
    return (
      nameLower.includes('x64') ||
      nameLower.includes('x86_64') ||
      nameLower.includes('amd64') ||
      nameLower.includes('win64') ||
      !nameLower.includes('i386')
    );
  }
  return true;
}

function classifyInstallKind(name: string, os: AppOs): PlatformInstallKind {
  const n = assetNameLower(name);
  if (n.endsWith('.msi')) return 'msi';
  if (n.endsWith('.exe')) return 'exe';
  if (n.endsWith('.dmg')) return 'dmg';
  if (n.endsWith('.pkg')) return 'pkg';
  if (n.endsWith('.appimage') || n.includes('.appimage')) return 'appimage';
  if (n.endsWith('.deb')) return 'deb';
  if (n.endsWith('.rpm')) return 'rpm';
  if (n.endsWith('.zip')) {
    if (os === 'windows' && n.includes('deco-cli')) return 'zip';
    if (os === 'macos' && (n.includes('deco-cli') || n.includes('macos') || n.includes('darwin'))) return 'zip';
    if (os === 'linux' && (n.includes('deco-cli') || n.includes('linux'))) return 'zip';
    return 'zip';
  }
  return 'unknown';
}

function scoreAssetForPlatform(name: string, os: AppOs, arch: AppArch): number {
  const n = assetNameLower(name);
  const kind = classifyInstallKind(name, os);
  let score = 0;

  if (kind === 'unknown') return -1;

  if (os === 'windows') {
    if (!n.includes('win') && !n.endsWith('.msi') && !n.endsWith('.exe') && !n.includes('deco-cli')) {
      if (kind !== 'zip' || !n.includes('deco-cli')) return -1;
    }
    if (kind === 'msi') score += 100;
    else if (kind === 'exe') score += 80;
    else if (kind === 'zip' && n.includes('deco-cli')) score += 40;
    else return -1;
  } else if (os === 'macos') {
    const macish =
      n.includes('macos') ||
      n.includes('darwin') ||
      n.includes('mac_') ||
      n.endsWith('.dmg') ||
      n.endsWith('.pkg') ||
      (n.includes('deco-cli') && (n.includes('mac') || n.includes('darwin')));
    if (!macish) return -1;
    if (kind === 'dmg') score += 100;
    else if (kind === 'pkg') score += 90;
    else if (kind === 'zip') score += 50;
    else return -1;
  } else {
    const linuxish =
      n.includes('linux') ||
      n.endsWith('.appimage') ||
      n.endsWith('.deb') ||
      n.endsWith('.rpm') ||
      (n.includes('deco-cli') && n.includes('linux'));
    if (!linuxish) return -1;
    if (kind === 'appimage') score += 100;
    else if (kind === 'deb') score += 90;
    else if (kind === 'rpm') score += 85;
    else if (kind === 'zip') score += 45;
    else return -1;
  }

  if (matchesArch(n, arch)) score += 30;
  else score -= 20;

  if (n.includes('setup') || n.includes('installer')) score += 5;
  if (n.includes('deco-cli') && kind === 'zip') score -= 5;

  return score;
}

/** Rank release assets for the current OS/arch (best first). */
export function pickPlatformDownloadAssets(
  assets: ReleaseAsset[],
  platform: AppPlatform,
): PlatformInstallAsset[] {
  const ranked: PlatformInstallAsset[] = [];
  for (const asset of assets) {
    const score = scoreAssetForPlatform(asset.name, platform.os, platform.arch);
    if (score < 0) continue;
    ranked.push({
      ...asset,
      install_kind: classifyInstallKind(asset.name, platform.os),
      score,
    });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

/** @deprecated Use pickPlatformDownloadAssets with a platform. */
export function pickWindowsDownloadAssets(assets: ReleaseAsset[]): ReleaseAsset[] {
  return pickPlatformDownloadAssets(assets, { os: 'windows', arch: 'x86_64' }).slice(0, 3);
}

export function platformLabel(platform: AppPlatform): string {
  const os =
    platform.os === 'windows' ? 'Windows' : platform.os === 'macos' ? 'macOS' : 'Linux';
  const arch =
    platform.arch === 'aarch64' || platform.arch === 'arm64'
      ? 'ARM64'
      : platform.arch === 'x86_64'
        ? 'x64'
        : platform.arch;
  return `${os} (${arch})`;
}

export function installKindLabel(kind: PlatformInstallKind): string {
  switch (kind) {
    case 'msi':
      return 'Windows installer (MSI)';
    case 'exe':
      return 'Windows installer (EXE)';
    case 'dmg':
      return 'macOS disk image';
    case 'pkg':
      return 'macOS package';
    case 'appimage':
      return 'Linux AppImage';
    case 'deb':
      return 'Linux .deb';
    case 'rpm':
      return 'Linux .rpm';
    case 'zip':
      return 'Portable ZIP';
    default:
      return 'Download';
  }
}

export function canDirectInstall(kind: PlatformInstallKind): boolean {
  return kind !== 'unknown' && kind !== 'zip';
}

export function platformInstallHint(platform: AppOs): string {
  switch (platform) {
    case 'windows':
      return 'Downloads the installer to your Downloads folder, then starts the MSI or EXE setup.';
    case 'macos':
      return 'Opens the .dmg or .pkg from Downloads. Drag Deco to Applications when the disk image opens. If Install fails, use Browser or GitHub Releases.';
    case 'linux':
      return 'Runs AppImage after download, or opens .deb / .rpm with your desktop package tool. Linux bundles are best-effort until release CI ships them.';
  }
}

export function noAssetsMessage(platform: AppPlatform): string {
  return `No ${platformLabel(platform)} installer is attached to this release yet. Open GitHub Releases to see all files — desktop bundles for macOS/Linux may still be rolling out.`;
}

/** Infer platform in browser dev (non-Tauri); desktop uses Rust `get_app_platform`. */
export function detectBrowserPlatform(): AppPlatform {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  let os: AppOs = 'linux';
  if (ua.includes('win')) os = 'windows';
  else if (ua.includes('mac')) os = 'macos';

  let arch: AppArch = 'x86_64';
  if (ua.includes('arm64') || ua.includes('aarch64')) arch = 'aarch64';

  return { os, arch };
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
