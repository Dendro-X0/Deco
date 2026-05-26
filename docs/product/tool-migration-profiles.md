# Tool migration profiles (Windows)

Canonical list for `deco migrate-tool-dir` and Settings → **Tool storage migration**.  
Implementation: `apps/cli/src/tool-migration-profiles.ts` and `apps/desktop/src-tauri/src/util/tool_migration.rs`.

**Platform:** Windows NTFS junction migrations only in v0.9.x. Other OSes: plan path checks in CI; run is blocked.

---

## Profile table

| ID | Category | Default source (Windows) | Run in UI/CLI | Notes |
|----|----------|--------------------------|---------------|-------|
| `cursor` | agent | `%APPDATA%\Cursor` | Yes | Roaming profile (chat, extensions) |
| `cursor-local` | agent | `%LOCALAPPDATA%\Cursor` | Yes | Caches, GPU data |
| `vscode` | ide | `%APPDATA%\Code` | Yes | |
| `claude-code` | agent | `%USERPROFILE%\.claude` | Yes (v0.9.1+) | Does not move `%USERPROFILE%\.claude.json` yet |
| `codex-cli` | agent | `%CODEX_HOME%` or `%USERPROFILE%\.codex` | Yes (v0.9.1+) | Honors `CODEX_HOME` |
| `claude-desktop` | agent | `%APPDATA%\Claude` | Plan only | GUI app; MSIX path may differ |
| `docker-desktop` | container | `%LOCALAPPDATA%\Docker` | Plan only | WSL2 VHDX / ProgramData need separate guidance |
| `npm-cache` | package-manager | `%LOCALAPPDATA%\npm-cache` | Plan only (v0.9.1+) | Regenerable; close Node/npm first |
| `pnpm-store` | package-manager | `%LOCALAPPDATA%\pnpm\store` | Plan only (v0.9.1+) | Custom `store-dir` → use `--source`/`--dest` |

---

## v0.9.x rollout

| Version | Focus |
|---------|--------|
| **v0.9.0** | Cursor, VS Code; Docker plan-only |
| **v0.9.1** | Correct installer versioning; profile registry; Claude Code + Codex CLI; cursor-local; npm/pnpm plan-only |
| **v0.9.2+** | Docker executable migration research; bundle multi-path agents (`.claude` + `.claude.json`); JetBrains caches |

---

## Custom paths

Always supported:

```bash
deco migrate-tool-dir plan --source "C:\Users\me\AppData\Roaming\Cursor" --dest "G:\DevToolData\Cursor"
```

---

## Safety

- Quit the target tool before **Run**.
- Destination must be on **NTFS**.
- Refuse migrating junction/symlink sources without `--force` (not in v0.9.x).
- Audit logs under Deco app data `migrations/` (desktop) or temp (CLI).
