export type ConfigRedirectToolId = 'npm-cache' | 'pnpm-store';

export function isConfigRedirectTool(toolId: string): toolId is ConfigRedirectToolId {
  return toolId === 'npm-cache' || toolId === 'pnpm-store';
}

export function defaultConfigRedirectDest(toolId: ConfigRedirectToolId): string {
  if (typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent)) {
    return toolId === 'npm-cache' ? 'D:\\npm-cache' : 'D:\\pnpm-store';
  }
  const home = toolId === 'npm-cache' ? '~/npm-cache' : '~/pnpm-store';
  return home;
}

export function configRedirectCommands(
  toolId: ConfigRedirectToolId,
  destPath: string,
): { setup: string[]; verify: string[] } {
  const dest = destPath.trim();
  if (!dest) {
    return { setup: [], verify: [] };
  }
  if (toolId === 'npm-cache') {
    return {
      setup: [`npm config set cache "${dest}"`],
      verify: ['npm config get cache'],
    };
  }
  return {
    setup: [`pnpm config set store-dir "${dest}"`],
    verify: ['pnpm store path'],
  };
}
