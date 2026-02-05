import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type DiskCleanupConfig = {
    readonly roots: readonly string[];
    readonly maxDepth: number;
    readonly targets: {
        readonly nodeModules?: boolean;
        readonly buildArtifacts?: boolean;
        readonly rustArtifacts?: boolean;
        readonly goArtifacts?: boolean;
        readonly playwrightArtifacts?: boolean;
    };
    readonly additionalDirNames?: {
        readonly buildArtifacts?: readonly string[];
        readonly rustArtifacts?: readonly string[];
        readonly goArtifacts?: readonly string[];
        readonly playwrightArtifacts?: readonly string[];
    };
    readonly excludeAbsPathContains?: readonly string[];
};

function isRecord(val: unknown): val is Record<string, unknown> {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function validateConfig(data: unknown): DiskCleanupConfig {
    if (!isRecord(data)) throw new Error('Config must be an object');
    if (!Array.isArray(data.roots) || data.roots.some((r) => typeof r !== 'string')) throw new Error('config.roots must be string[]');
    if (typeof data.maxDepth !== 'number') throw new Error('config.maxDepth must be a number');
    if (!isRecord(data.targets)) throw new Error('config.targets must be an object');
    const config = data as DiskCleanupConfig;
    return config;
}

/**
 * Loads and validates configuration from a file.
 * Defaults to .dcos/disk-cleanup.json in CWD if no path is provided.
 */
export async function loadConfig(explicitPath?: string): Promise<DiskCleanupConfig | null> {
    const configPath = explicitPath ?? path.join(process.cwd(), '.deco', 'disk-cleanup.json');
    try {
        const content = await readFile(configPath, 'utf8');
        const parsed = JSON.parse(content);
        return validateConfig(parsed);
    } catch (err: unknown) {
        if (explicitPath) throw err;
        return null;
    }
}
