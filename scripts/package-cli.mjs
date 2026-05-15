#!/usr/bin/env node
/**
 * Stage a portable CLI folder under .artifacts/deco-cli (Node 20+ required to run).
 * CI zips this directory for GitHub Releases.
 */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const cliRoot = path.join(root, 'apps', 'cli');
const outDir = path.join(root, '.artifacts', 'deco-cli');

const pkg = JSON.parse(await readFile(path.join(cliRoot, 'package.json'), 'utf8'));

await mkdir(outDir, { recursive: true });
await cp(path.join(cliRoot, 'dist'), path.join(outDir, 'dist'), { recursive: true });

const minimalPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  type: 'module',
  bin: pkg.bin,
};
await writeFile(path.join(outDir, 'package.json'), `${JSON.stringify(minimalPkg, null, 2)}\n`, 'utf8');

await writeFile(
  path.join(outDir, 'deco.cmd'),
  '@echo off\r\nnode "%~dp0dist\\cli.js" %*\r\n',
  'utf8'
);

await writeFile(
  path.join(outDir, 'README.txt'),
  `Deco CLI ${pkg.version}

Requirements: Node.js 20 or newer on PATH.

Windows:
  deco.cmd --help

Any OS:
  node dist/cli.js --help

Examples:
  node dist/cli.js --dry-run --root . --max-depth 6 --no-size
  node dist/cli.js --check-go-cache --include-review --dry-run
`,
  'utf8'
);

process.stdout.write(`Staged CLI package: ${outDir}\n`);
