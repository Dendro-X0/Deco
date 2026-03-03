# Release Checklist (CLI)

## Pre-Release

1. Verify version sync:
   - `package.json`
   - `jsr.json`
   - `CHANGELOG.md`
2. Run checks:
   - `npm run build`
   - `pnpm test`
3. Smoke test CLI:
   - `node dist/cli.js --help`
   - `node dist/cli.js --version`
   - `node dist/cli.js --dry-run --json --root <fixture>`
   - `node dist/cli.js --delete --yes --root <fixture>`
   - `node dist/cli.js --restore <id> --root <fixture>`
   - `node dist/cli.js --purge-quarantine --yes --root <fixture>`
4. Validate package payload:
   - `npm pack --dry-run`
   - Confirm only runtime/docs files are included.

## Publish

1. Commit release changes.
2. Tag release:
   - `git tag v0.3.0`
3. Publish npm package:
   - `npm publish --access public`
4. Push commits and tags:
   - `git push && git push --tags`

## Post-Publish

1. Install from registry and smoke test globally:
   - `npm i -g @dendro-x0/deco@0.3.0`
   - `deco --version`
   - `deco --help`
2. Verify quarantine flow on a small fixture.