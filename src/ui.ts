import * as p from '@clack/prompts';
import pc from 'picocolors';
import path from 'node:path';
import {
    type CliOptions,
    type TargetDir,
    type ScanReport,
    type TargetDirKind,
    buildReport,
    deleteTargets,
    formatBytes
} from './cli.js';

/**
 * Runs the interactive TUI for Deco.
 */
export async function runInteractive(options: CliOptions): Promise<void> {
    p.intro(pc.bgCyan(pc.black(' Deco — Developer Compact ')));

    const s = p.spinner();
    s.start('Scanning directories...');

    const report = await buildReport({
        ...options,
        // Ensure no progress is printed to stdout during scan to not mess up TUI
        // Note: CLI.TS currently prints if isTTY. We'll need to handle that.
    });

    s.stop(`Scan complete. Found ${pc.cyan(report.targets.length)} targets.`);

    if (report.targets.length === 0) {
        p.outro(pc.green('No targets found. Your disk is clean!'));
        return;
    }

    if (report.errors.length > 0) {
        p.note(
            report.errors.slice(0, 5).map(e => pc.yellow(`! ${e}`)).join('\n') +
            (report.errors.length > 5 ? `\n...and ${report.errors.length - 5} more` : ''),
            'Warnings'
        );
    }

    const selectedPaths = await p.multiselect({
        message: `Select targets to delete (${pc.green(formatBytes(report.totalBytes))} reclaimable)`,
        options: report.targets.map((t) => ({
            value: t.absPath,
            label: `${pc.cyan(t.kind)}: ${path.relative(process.cwd(), t.absPath) || t.absPath}`,
            hint: t.absPath // Show full path as hint
        })),
        initialValues: report.targets.map(t => t.absPath),
    });

    if (p.isCancel(selectedPaths)) {
        p.cancel('Operation cancelled.');
        return;
    }

    if ((selectedPaths as string[]).length === 0) {
        p.outro('No items selected. Nothing to do.');
        return;
    }

    const confirmed = await p.confirm({
        message: `Are you sure you want to delete ${pc.red((selectedPaths as string[]).length)} targets?`,
    });

    if (p.isCancel(confirmed) || !confirmed) {
        p.cancel('Deletion aborted.');
        return;
    }

    const targetsToDelete = report.targets.filter(t => (selectedPaths as string[]).includes(t.absPath));

    s.start('Deleting...');
    await deleteTargets(targetsToDelete);
    s.stop(pc.green('Deletion complete.'));

    p.outro(pc.bgGreen(pc.black(` Reclaimed ${formatBytes(targetsToDelete.reduce((acc, t) => acc + (t.size || 0), 0))} `)));
    // Note: To get accurate reclaimed size, ideally we'd have the individual target sizes.
    // For now, it's just a placeholder or we can calculate it if we store it in TargetDir.
}
