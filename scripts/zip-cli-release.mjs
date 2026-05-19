#!/usr/bin/env node
/**
 * Zip staged .artifacts/deco-cli for GitHub Releases.
 * Set CLI_ZIP_NAME (e.g. deco-cli-linux-x64.zip) before running.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const staged = path.join(root, '.artifacts', 'deco-cli');
const zipName = process.env.CLI_ZIP_NAME?.trim();
if (!zipName) {
  console.error('CLI_ZIP_NAME is required (e.g. deco-cli-win-x64.zip)');
  process.exit(1);
}
if (!existsSync(staged)) {
  console.error(`Missing staged CLI folder: ${staged} — run package-cli.mjs first`);
  process.exit(1);
}

const outZip = path.join(root, '.artifacts', zipName);
const isWin = process.platform === 'win32';

if (isWin) {
  execSync(
    `powershell Compress-Archive -Path "${staged}" -DestinationPath "${outZip}" -Force`,
    { stdio: 'inherit', cwd: root },
  );
} else {
  execSync(`chmod +x "${path.join(staged, 'deco')}"`, { stdio: 'inherit' });
  execSync(`zip -r -q "${outZip}" deco-cli`, {
    stdio: 'inherit',
    cwd: path.join(root, '.artifacts'),
  });
}

process.stdout.write(`Wrote ${outZip}\n`);
