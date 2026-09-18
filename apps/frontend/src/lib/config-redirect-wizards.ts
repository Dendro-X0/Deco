export type ConfigRedirectToolId = 'npm-cache' | 'pnpm-store' | 'docker-desktop';

export type ConfigRedirectStep = {
  /** Human-readable instruction; optional when `command` alone is enough. */
  readonly text?: string;
  readonly command?: string;
};

export function isConfigRedirectTool(toolId: string): toolId is ConfigRedirectToolId {
  return toolId === 'npm-cache' || toolId === 'pnpm-store' || toolId === 'docker-desktop';
}

export function defaultConfigRedirectDest(toolId: ConfigRedirectToolId): string {
  if (typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent)) {
    if (toolId === 'npm-cache') return 'D:\\npm-cache';
    if (toolId === 'pnpm-store') return 'D:\\pnpm-store';
    return 'G:\\DockerData';
  }
  if (toolId === 'npm-cache') return '~/npm-cache';
  if (toolId === 'pnpm-store') return '~/pnpm-store';
  return '~/DockerData';
}

export function configRedirectSteps(
  toolId: ConfigRedirectToolId,
  destPath: string,
): { setup: ConfigRedirectStep[]; verify: ConfigRedirectStep[] } {
  const dest = destPath.trim();
  if (toolId === 'docker-desktop') {
    return {
      setup: [
        { text: 'Quit Docker Desktop completely (tray icon + Task Manager).' },
        { text: 'Shut down WSL before relocating the disk image:', command: 'wsl --shutdown' },
        {
          text: 'Open Docker Desktop → Settings → Resources → Advanced → Disk image location.',
        },
        {
          text: dest
            ? `Choose an NTFS folder with enough free space (e.g. ${dest}).`
            : 'Choose an NTFS folder on another drive with enough free space.',
        },
        { text: 'Click Apply & Restart and wait for Docker to finish moving data.' },
      ],
      verify: [
        { text: 'Confirm Docker starts and containers/images are visible.' },
        { command: 'docker info' },
        {
          text: 'Optional: check the new disk image path in Settings → Resources → Advanced.',
        },
      ],
    };
  }

  if (!dest) {
    return { setup: [], verify: [] };
  }

  if (toolId === 'npm-cache') {
    return {
      setup: [{ command: `npm config set cache "${dest}"` }],
      verify: [{ command: 'npm config get cache' }],
    };
  }

  return {
    setup: [{ command: `pnpm config set store-dir "${dest}"` }],
    verify: [{ command: 'pnpm store path' }],
  };
}

/** @deprecated Use configRedirectSteps — kept for tests expecting command-only rows. */
export function configRedirectCommands(
  toolId: ConfigRedirectToolId,
  destPath: string,
): { setup: string[]; verify: string[] } {
  const { setup, verify } = configRedirectSteps(toolId, destPath);
  return {
    setup: setup.map((s) => s.command ?? s.text ?? '').filter(Boolean),
    verify: verify.map((s) => s.command ?? s.text ?? '').filter(Boolean),
  };
}
