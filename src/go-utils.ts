import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Retrieves a Go environment variable using `go env`.
 */
export async function getGoEnv(key: string): Promise<string | undefined> {
    try {
        const { stdout } = await execAsync(`go env ${key}`);
        const result = stdout.trim();
        return result.length > 0 ? result : undefined;
    } catch {
        return undefined;
    }
}
