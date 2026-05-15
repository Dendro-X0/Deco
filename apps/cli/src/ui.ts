import * as p from '@clack/prompts';
import pc from 'picocolors';
import path from 'node:path';
import {
  type CleanupCandidate,
  type CliOptions,
  type ScanReport,
  buildReport,
  executeDeletion,
  formatBytes,
} from './cli.js';

function summarizeByRisk(report: ScanReport): string {
  const lines = ['safe', 'review', 'blocked'].map((risk) => {
    const totals = report.totalsByRisk[risk as keyof typeof report.totalsByRisk];
    return `- ${pc.cyan(risk.padEnd(7))}: ${pc.bold(totals.count.toString().padStart(4))} targets (${pc.green(formatBytes(totals.bytes))})`;
  });
  return lines.join('\n');
}

function summarizeByKind(report: ScanReport): string {
  return Object.entries(report.totalsByKind)
    .map(([kind, totals]) => `- ${pc.cyan(kind.padEnd(20))}: ${totals.count} (${pc.green(formatBytes(totals.bytes))})`)
    .join('\n');
}

function getSafeTargets(report: ScanReport): CleanupCandidate[] {
  return report.candidates.filter((candidate) => candidate.risk === 'safe');
}

function getReviewTargets(report: ScanReport): CleanupCandidate[] {
  return report.candidates.filter((candidate) => candidate.risk === 'review');
}

function getBlockedTargets(report: ScanReport): CleanupCandidate[] {
  return report.candidates.filter((candidate) => candidate.risk === 'blocked');
}

async function confirmReviewDeletion(reviewTargets: readonly CleanupCandidate[]): Promise<boolean> {
  if (reviewTargets.length === 0) return true;
  const confirmed = await p.confirm({
    message: `Include ${pc.yellow(reviewTargets.length)} review-risk targets? This requires explicit confirmation.`,
    initialValue: false,
  });

  if (p.isCancel(confirmed) || !confirmed) return false;

  const second = await p.confirm({
    message: 'Confirm again: delete review-risk targets now?',
    initialValue: false,
  });

  return !p.isCancel(second) && Boolean(second);
}

async function runDeletion(options: CliOptions, targets: readonly CleanupCandidate[]): Promise<void> {
  if (targets.length === 0) {
    p.outro(pc.yellow('No deletable targets selected.'));
    return;
  }

  const size = targets.reduce((sum, target) => sum + (target.size ?? 0), 0);
  const confirmed = await p.confirm({
    message: `Delete ${pc.red(targets.length)} targets (${pc.green(formatBytes(size))}) using ${pc.cyan(options.deleteMode)} mode?`,
    initialValue: false,
  });
  if (p.isCancel(confirmed) || !confirmed) return;

  const spinner = p.spinner();
  spinner.start('Deleting targets...');
  const result = await executeDeletion(targets, options, (done) => {
    spinner.message(`Deleting ${pc.cyan(done)}/${pc.cyan(targets.length)} items...`);
  });
  spinner.stop('Deletion finished.');

  if (result.warnings.length > 0) {
    p.note(result.warnings.join('\n'), 'Warnings');
  }

  if (result.errors.length > 0) {
    p.note(
      result.errors.slice(0, 10).map((error) => `! ${error}`).join('\n') +
      (result.errors.length > 10 ? `\n...and ${result.errors.length - 10} more` : ''),
      'Deletion Errors'
    );
  }

  if (result.quarantined.length > 0) {
    p.note(
      result.quarantined.slice(0, 10).map((entry) => `${entry.id} -> ${entry.originalPath}`).join('\n') +
      (result.quarantined.length > 10 ? `\n...and ${result.quarantined.length - 10} more` : ''),
      'Quarantine IDs'
    );
  }

  const succeeded = targets.length - result.errors.length;
  if (succeeded > 0) {
    p.outro(pc.bgGreen(pc.black(` Reclaimed ${formatBytes(size)} (${succeeded} items processed) `)));
  } else {
    p.outro(pc.yellow('No items were deleted.'));
  }
}

function optionLabel(candidate: CleanupCandidate): string {
  const rel = path.relative(process.cwd(), candidate.absPath) || candidate.absPath;
  const reason = candidate.reasonCodes.join(',');
  return `[${candidate.risk}] ${candidate.kind}: ${rel} (${reason})`;
}

export async function runInteractive(options: CliOptions): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' Deco - Safety First Cleanup ')));

  const spinner = p.spinner();
  spinner.start('Scanning directories...');

  const report = await buildReport({ ...options, showBlocked: true }, (update) => {
    const phase = update.phase ?? 'discover';
    const phaseLabel =
      phase === 'classify' ? 'Classifying' : phase === 'size' ? 'Sizing' : 'Scanning';
    const extra =
      phase === 'size' && update.sizedCandidates !== undefined
        ? ` | sized ${update.sizedCandidates}/${update.foundTargets}`
        : '';
    spinner.message(
      `${phaseLabel}... ${pc.cyan(update.scannedDirs)} dirs | ${pc.cyan(update.foundTargets)} targets${extra}`
    );
  });

  spinner.stop(`Scan complete. Found ${pc.cyan(report.candidates.length)} candidates in ${pc.cyan(report.scannedDirs)} directories.`);

  if (report.candidates.length === 0) {
    p.outro(pc.green('No cleanup candidates found.'));
    return;
  }

  p.note(
    `${summarizeByRisk(report)}\n${pc.dim('-'.repeat(40))}\n${summarizeByKind(report)}\n${pc.dim('-'.repeat(40))}\nTotal reclaimable: ${pc.green(formatBytes(report.totalBytes))}`,
    'Scan Summary'
  );

  const blocked = getBlockedTargets(report);
  if (blocked.length > 0) {
    p.note(
      blocked.slice(0, 8).map((candidate) => `${candidate.absPath} (${candidate.reasonCodes.join(',')})`).join('\n') +
      (blocked.length > 8 ? `\n...and ${blocked.length - 8} more blocked targets` : ''),
      'Blocked (read-only)'
    );
  }

  while (true) {
    const action = await p.select({
      message: 'Choose cleanup action',
      options: [
        { value: 'safe-only', label: 'Clean Safe Targets', hint: 'Recommended default' },
        { value: 'safe-plus-review', label: 'Clean Safe + Review', hint: 'Needs extra confirmation' },
        { value: 'manual', label: 'Manual Selection', hint: 'Pick individual targets' },
        { value: 'exit', label: 'Exit', hint: 'Quit without cleaning' },
      ],
    });

    if (p.isCancel(action) || action === 'exit') {
      p.outro('Goodbye.');
      return;
    }

    if (action === 'safe-only') {
      await runDeletion(options, getSafeTargets(report));
      return;
    }

    if (action === 'safe-plus-review') {
      const review = getReviewTargets(report);
      const allowed = await confirmReviewDeletion(review);
      if (!allowed) continue;
      await runDeletion(options, [...getSafeTargets(report), ...review]);
      return;
    }

    if (action === 'manual') {
      const selectable = report.candidates.filter((candidate) => candidate.risk !== 'blocked');
      const safeInitial = selectable.filter((candidate) => candidate.risk === 'safe').map((candidate) => candidate.absPath);
      const selected = await p.multiselect({
        message: 'Select targets to delete',
        options: selectable.map((candidate) => ({
          value: candidate.absPath,
          label: optionLabel(candidate),
          hint: candidate.absPath,
        })),
        initialValues: safeInitial,
      });

      if (p.isCancel(selected) || (selected as string[]).length === 0) continue;

      const targets = selectable.filter((candidate) => (selected as string[]).includes(candidate.absPath));
      const includesReview = targets.some((candidate) => candidate.risk === 'review');
      if (includesReview) {
        const allowed = await confirmReviewDeletion(targets.filter((candidate) => candidate.risk === 'review'));
        if (!allowed) continue;
      }

      await runDeletion(options, targets);
      return;
    }
  }
}