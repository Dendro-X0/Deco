import path from 'node:path';
import { stat } from 'node:fs/promises';

export type DockerDiskBreakdown = {
  readonly dockerRoot: string;
  readonly totalBytes?: number;
  readonly vhdxPath?: string;
  readonly vhdxBytes?: number;
  readonly appdataExcludingVhdxBytes?: number;
};

const VHDX_REL_PATHS = [
  ['wsl', 'data', 'ext4.vhdx'],
  ['wsl', 'disk', 'ext4.vhdx'],
] as const;

export function dockerVhdxCandidates(dockerRoot: string): string[] {
  return VHDX_REL_PATHS.map((parts) => path.join(dockerRoot, ...parts));
}

export async function findDockerVhdx(dockerRoot: string): Promise<string | undefined> {
  for (const candidate of dockerVhdxCandidates(dockerRoot)) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // missing path — try next candidate
    }
  }
  return undefined;
}

export async function analyzeDockerDisk(
  dockerRoot: string,
  totalBytes?: number,
): Promise<DockerDiskBreakdown> {
  const vhdxPath = await findDockerVhdx(dockerRoot);
  const vhdxBytes = vhdxPath
    ? await stat(vhdxPath)
        .then((s) => (s.isFile() ? s.size : undefined))
        .catch(() => undefined)
    : undefined;

  const appdataExcludingVhdxBytes =
    totalBytes == null
      ? undefined
      : vhdxBytes == null
        ? totalBytes
        : Math.max(0, totalBytes - vhdxBytes);

  return {
    dockerRoot,
    totalBytes,
    vhdxPath,
    vhdxBytes,
    appdataExcludingVhdxBytes,
  };
}

export function dockerBreakdownWarnings(breakdown: DockerDiskBreakdown): string[] {
  const warnings = [
    'Docker Desktop is plan-only: Deco does not migrate ext4.vhdx via junction Run. Use Docker Desktop disk settings (config wizard in Settings).',
  ];

  if (breakdown.vhdxBytes != null && breakdown.vhdxPath) {
    warnings.push(
      `WSL disk image (ext4.vhdx): ${formatBytesHint(breakdown.vhdxBytes)} at ${breakdown.vhdxPath}`,
    );
  }

  if (breakdown.appdataExcludingVhdxBytes != null) {
    warnings.push(
      `Docker LocalAppData (excluding VHDX): ${formatBytesHint(breakdown.appdataExcludingVhdxBytes)}`,
    );
  }

  if (vhdxIsDominant(breakdown)) {
    warnings.push(
      'Most Docker disk usage is in ext4.vhdx. Junction-migrating only LocalAppData\\Docker would not free meaningful space. Use Docker Desktop → Settings → Resources → Advanced → Disk image location.',
    );
  }

  return warnings;
}

function vhdxIsDominant(breakdown: DockerDiskBreakdown): boolean {
  const vhdx = breakdown.vhdxBytes;
  if (vhdx == null || vhdx < 500 * 1024 * 1024) return false;
  const meta = breakdown.appdataExcludingVhdxBytes;
  return meta == null ? vhdx >= 500 * 1024 * 1024 : vhdx > meta;
}

function formatBytesHint(bytes: number): string {
  const gb = 1024 ** 3;
  const mb = 1024 ** 2;
  if (bytes >= gb) return `${(bytes / gb).toFixed(1)} GB`;
  if (bytes >= mb) return `${Math.round(bytes / mb)} MB`;
  return `${bytes} bytes`;
}
