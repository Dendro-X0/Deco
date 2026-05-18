import { invoke } from '@tauri-apps/api/core';
import {
  detectBrowserPlatform,
  type AppPlatform,
  type PlatformInstallAsset,
} from './github-releases';

export type DownloadInstallProgress =
  | { phase: 'downloading' }
  | { phase: 'installing' }
  | { phase: 'done'; saved_path: string };

export async function resolveAppPlatform(): Promise<AppPlatform> {
  try {
    const native = await invoke<{ os: string; arch: string }>('get_app_platform');
    const os = native.os === 'windows' || native.os === 'macos' || native.os === 'linux' ? native.os : 'linux';
    return { os, arch: native.arch || 'x86_64' };
  } catch {
    return detectBrowserPlatform();
  }
}

export async function downloadAndInstallReleaseAsset(
  asset: PlatformInstallAsset,
  onProgress?: (p: DownloadInstallProgress) => void,
): Promise<string> {
  onProgress?.({ phase: 'downloading' });
  const savedPath = await invoke<string>('download_release_asset', {
    url: asset.download_url,
    filename: asset.name,
  });
  onProgress?.({ phase: 'installing' });
  await invoke('launch_installer_for_download', { path: savedPath });
  onProgress?.({ phase: 'done', saved_path: savedPath });
  return savedPath;
}
