# Tool migration profiles (Windows)

Canonical list for `deco migrate-tool-dir` (CLI) and desktop **Settings → Tool storage migration**. The manual [IDE storage guide](../desktop/ide-storage-off-os-drive.md) remains the fallback.  
Implementation: `apps/cli/src/tool-migration-profiles.ts` and `apps/desktop/src-tauri/src/util/tool_migration.rs`.

**Platform:** Windows NTFS junction migrations only in v0.9.x. Other OSes: plan path checks in CI; run is blocked.

---

## Profile table

### Agents & IDEs

| ID | Category | Default source (Windows) | Run | Notes |
|----|----------|--------------------------|-----|-------|
| `cursor` | agent | Roaming + Local (bundle) | Yes | `%APPDATA%\Cursor` + `%LOCALAPPDATA%\Cursor` |
| `cursor-roaming` | agent | `%APPDATA%\Cursor` | Yes | Single leg (CLI/advanced) |
| `cursor-local` | agent | `%LOCALAPPDATA%\Cursor` | Yes | Single leg (CLI/advanced) |
| `vscode` | ide | `%APPDATA%\Code` | Yes | |
| `claude-code` | agent | `%USERPROFILE%\.claude` | Yes | Does not move `.claude.json` yet |
| `codex-cli` | agent | `%CODEX_HOME%` or `%USERPROFILE%\.codex` | Yes | Honors `CODEX_HOME` |
| `claude-desktop` | agent | `%APPDATA%\Claude` | Plan only | MSIX path may differ |

### Browsers (AppData)

| ID | Category | Default source | Run | Notes |
|----|----------|----------------|-----|-------|
| `google-chrome` | browser | `%LOCALAPPDATA%\Google\Chrome\User Data` | Yes | Quit Chrome fully |
| `microsoft-edge` | browser | `%LOCALAPPDATA%\Microsoft\Edge\User Data` | Yes | Quit Edge fully |
| `brave` | browser | `%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data` | Yes | Quit Brave fully |
| `firefox` | browser | `%APPDATA%\Mozilla\Firefox` | Plan only | Profile layout varies |

### Utilities (AppData)

| ID | Category | Default source | Run | Notes |
|----|----------|----------------|-----|-------|
| `discord` | utility | Roaming + Local (bundle) | Yes | `%APPDATA%\discord` + `%LOCALAPPDATA%\Discord` |
| `spotify` | utility | `%APPDATA%\Spotify` | Yes | |
| `slack` | utility | `%APPDATA%\Slack` | Yes | |
| `telegram` | utility | `%APPDATA%\Telegram Desktop` | Yes | |
| `notion` | utility | `%APPDATA%\Notion` | Yes | |
| `obs-studio` | utility | `%APPDATA%\obs-studio` | Yes | Scenes and settings |

### Games (AppData)

| ID | Category | Default source | Run | Notes |
|----|----------|----------------|-----|-------|
| `epic-games` | game | `%LOCALAPPDATA%\EpicGamesLauncher` | Plan only | Game installs may live elsewhere |
| `steam-appdata` | game | `%LOCALAPPDATA%\Steam` | Plan only | Not the Steam library under Program Files |
| `battle-net` | game | `%LOCALAPPDATA%\Battle.net` | Plan only | Game files may be on other drives |

### Containers & package managers

| ID | Category | Default source | Run | Notes |
|----|----------|----------------|-----|-------|
| `docker-desktop` | container | `%LOCALAPPDATA%\Docker` | Plan only | WSL2 VHDX / ProgramData separate |
| `npm-cache` | package-manager | `%LOCALAPPDATA%\npm-cache` | Plan only | Regenerable |
| `pnpm-store` | package-manager | `%LOCALAPPDATA%\pnpm\store` | Plan only | Custom `store-dir` → `--source`/`--dest` |

---

## v0.9.x rollout

| Version | Focus |
|---------|--------|
| **v0.9.0** | Cursor, VS Code; Docker plan-only |
| **v0.9.1** | Profile registry; Claude Code + Codex CLI |
| **v0.9.4** | Desktop Plan + Run wizard relaunch |
| **v0.9.7** | Backup cleanup; destination verification on re-plan | Shipped |
| **v0.9.8** | Custom folder migration + path blocklist; custom mode toggle | Shipped — [v0.9.8-manifest.md](v0.9.8-manifest.md) |
| **v0.9.9** | Managed migrations registry; dest-root validation warning | Shipped — [v0.9.9-manifest.md](v0.9.9-manifest.md) |

---

## Custom folder migration (v0.9.8+)

**Desktop:** Settings → Tool storage migration → **Custom folder** toggle  
**CLI:** `--source` and `--dest` (unchanged)

Use when no profile matches — e.g. `Documents\Electronic Arts\The Sims 4\Mods` → `G:\Games\Sims4\Mods`.

**Blocked (blocklist):** drive roots; `Windows`, `Program Files`, `ProgramData`; entire `%USERPROFILE%`, `Documents`, `AppData`, `Desktop`, etc.  
**Allowed:** specific subfolders under those paths.

---

## Custom paths (CLI advanced)

Always supported:

```bash
deco migrate-tool-dir plan --source "C:\Users\me\AppData\Roaming\Spotify" --dest "G:\AppData\Spotify"
```

---

## Safety

- Quit the target app before **Run** (browsers, Discord, games, etc.).
- Destination must be on **NTFS**; use a **parent** folder (e.g. `G:\AppData`), not `G:\AppData\Spotify` — Deco appends the profile leaf name.
- Refuse migrating junction/symlink sources without `--force` (not in v0.9.x).
- **Plan only** profiles: sizing and path validation only — verify layout before manual or CLI `--source`/`--dest` run.
- Audit logs under Deco app data `migrations/` (desktop) or temp (CLI).
