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

    const report = await buildReport(options, (update) => {
        s.message(`Scanning... ${pc.cyan(update.scannedDirs)} dirs visited | ${pc.cyan(update.foundTargets)} targets found`);
    });

    s.stop(`Scan complete. Found ${pc.cyan(report.targets.length)} targets in ${pc.cyan(report.scannedDirs)} directories.`);

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

    await showDashboard(report);
}

async function showDashboard(report: ScanReport): Promise<void> {
    const grouped = groupTargets(report.targets);
    const summary = Object.entries(grouped)
        .map(([kind, targets]) => {
            const size = targets.reduce((acc, t) => acc + (t.size || 0), 0);
            return `• ${pc.cyan(kind.padEnd(20))}: ${pc.bold(targets.length.toString().padStart(3))} projects (${pc.green(formatBytes(size))})`;
        })
        .join('\n');

    p.note(
        summary + `\n${pc.dim('─'.repeat(40))}\n` +
        `Total: ${pc.bold(report.targets.length)} targets (${pc.green(formatBytes(report.totalBytes))})`,
        'Scan Summary'
    );

    while (true) {
        const action = await p.select({
            message: 'What would you like to do?',
            options: [
                { value: 'clean-all', label: 'Clean All', hint: 'Delete everything found' },
                { value: 'clean-by-type', label: 'Clean by Category', hint: 'Pick specific types to remove' },
                { value: 'interactive', label: 'Manual Selection', hint: 'Pick individual folders' },
                { value: 'exit', label: 'Exit', hint: 'Quit without cleaning' },
            ],
        });

        if (p.isCancel(action) || action === 'exit') {
            p.outro('Goodbye!');
            return;
        }

        if (action === 'clean-all') {
            await handleCleanAll(report.targets);
            return;
        }

        if (action === 'clean-by-type') {
            const done = await handleCleanByType(grouped);
            if (done) return;
        }

        if (action === 'interactive') {
            const done = await handleManualSelection(report.targets, report.totalBytes);
            if (done) return;
        }
    }
}

function groupTargets(targets: readonly TargetDir[]): Record<TargetDirKind, TargetDir[]> {
    const grouped: Record<TargetDirKind, TargetDir[]> = {
        'node_modules': [],
        'build-artifact': [],
        'rust-artifact': [],
        'go-artifact': [],
        'go-global-cache': [],
        'playwright-artifact': [],
    };
    for (const t of targets) {
        grouped[t.kind].push(t);
    }
    // Remove empty groups
    for (const key of Object.keys(grouped) as TargetDirKind[]) {
        if (grouped[key].length === 0) delete grouped[key];
    }
    return grouped;
}

async function handleCleanAll(targets: readonly TargetDir[]): Promise<void> {
    const totalSize = targets.reduce((acc, t) => acc + (t.size || 0), 0);
    const confirmed = await p.confirm({
        message: `Delete ALL ${pc.red(targets.length)} targets (${pc.green(formatBytes(totalSize))})?`,
    });

    if (p.isCancel(confirmed) || !confirmed) return;

    const s = p.spinner();
    s.start('Deleting...');
    const errors = await deleteTargets(targets, (done) => {
        s.message(`Deleting ${pc.cyan(done)}/${pc.cyan(targets.length)} items...`);
    });
    s.stop(pc.green('Deletion process finished.'));

    if (errors.length > 0) {
        p.note(
            errors.slice(0, 5).map(e => pc.yellow(`! ${e}`)).join('\n') +
            (errors.length > 5 ? `\n...and ${errors.length - 5} more failed` : ''),
            'Partial Deletion Warnings'
        );
    }

    const successfulCount = targets.length - errors.length;
    if (successfulCount > 0) {
        // Recalculate reclaimed size based on successful deletions
        const reclaimedSize = targets
            .filter(t => !errors.some(e => e.includes(t.absPath)))
            .reduce((acc, t) => acc + (t.size || 0), 0);
        p.outro(pc.bgGreen(pc.black(` Reclaimed ${formatBytes(reclaimedSize)} (${successfulCount} items deleted) `)));
    } else {
        p.outro(pc.yellow('No items were deleted. Check the warnings above.'));
    }
}

async function handleCleanByType(grouped: Record<string, TargetDir[]>): Promise<boolean> {
    const selectedKinds = await p.multiselect({
        message: 'Select categories to clean',
        options: Object.entries(grouped).map(([kind, targets]) => {
            const size = targets.reduce((acc, t) => acc + (t.size || 0), 0);
            return {
                value: kind,
                label: kind,
                hint: `${targets.length} items, ${formatBytes(size)}`
            };
        }),
    });

    if (p.isCancel(selectedKinds) || (selectedKinds as string[]).length === 0) return false;

    const targetsToDelete = (selectedKinds as string[]).flatMap(kind => grouped[kind]);
    const totalSize = targetsToDelete.reduce((acc, t) => acc + (t.size || 0), 0);

    const confirmed = await p.confirm({
        message: `Delete ${pc.red(targetsToDelete.length)} items from selected categories (${pc.green(formatBytes(totalSize))})?`,
    });

    if (p.isCancel(confirmed) || !confirmed) return false;

    const s = p.spinner();
    s.start('Deleting...');
    const errors = await deleteTargets(targetsToDelete, (done) => {
        s.message(`Deleting ${pc.cyan(done)}/${pc.cyan(targetsToDelete.length)} items...`);
    });
    s.stop(pc.green('Deletion process finished.'));

    if (errors.length > 0) {
        p.note(
            errors.slice(0, 5).map(e => pc.yellow(`! ${e}`)).join('\n') +
            (errors.length > 5 ? `\n...and ${errors.length - 5} more failed` : ''),
            'Partial Deletion Warnings'
        );
    }

    const successfulCount = targetsToDelete.length - errors.length;
    if (successfulCount > 0) {
        const reclaimedSize = targetsToDelete
            .filter(t => !errors.some(e => e.includes(t.absPath)))
            .reduce((acc, t) => acc + (t.size || 0), 0);
        p.outro(pc.bgGreen(pc.black(` Reclaimed ${formatBytes(reclaimedSize)} (${successfulCount} items deleted) `)));
    } else {
        p.outro(pc.yellow('No items were deleted. Check the warnings above.'));
    }
    return true;
}

async function handleManualSelection(targets: readonly TargetDir[], totalBytes: number): Promise<boolean> {
    const selectedPaths = await p.multiselect({
        message: `Select targets to delete (${pc.green(formatBytes(totalBytes))} reclaimable)`,
        options: targets.map((t) => ({
            value: t.absPath,
            label: `${pc.cyan(t.kind)}: ${path.relative(process.cwd(), t.absPath) || t.absPath}`,
            hint: t.absPath
        })),
        initialValues: targets.map(t => t.absPath),
    });

    if (p.isCancel(selectedPaths) || (selectedPaths as string[]).length === 0) return false;

    const targetsToDelete = targets.filter(t => (selectedPaths as string[]).includes(t.absPath));
    const sizeToDelete = targetsToDelete.reduce((acc, t) => acc + (t.size || 0), 0);

    const confirmed = await p.confirm({
        message: `Are you sure you want to delete ${pc.red(targetsToDelete.length)} targets?`,
    });

    if (p.isCancel(confirmed) || !confirmed) return false;

    const s = p.spinner();
    s.start('Deleting...');
    const errors = await deleteTargets(targetsToDelete, (done) => {
        s.message(`Deleting ${pc.cyan(done)}/${pc.cyan(targetsToDelete.length)} items...`);
    });
    s.stop(pc.green('Deletion process finished.'));

    if (errors.length > 0) {
        p.note(
            errors.slice(0, 5).map(e => pc.yellow(`! ${e}`)).join('\n') +
            (errors.length > 5 ? `\n...and ${errors.length - 5} more failed` : ''),
            'Partial Deletion Warnings'
        );
    }

    const successfulCount = targetsToDelete.length - errors.length;
    if (successfulCount > 0) {
        const reclaimedSize = targetsToDelete
            .filter(t => !errors.some(e => e.includes(t.absPath)))
            .reduce((acc, t) => acc + (t.size || 0), 0);
        p.outro(pc.bgGreen(pc.black(` Reclaimed ${formatBytes(reclaimedSize)} (${successfulCount} items deleted) `)));
    } else {
        p.outro(pc.yellow('No items were deleted. Check the warnings above.'));
    }
    return true;
}
