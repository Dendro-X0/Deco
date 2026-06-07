# Security Policy

Deco (Developer Compact) is **local-first** disk cleanup software for developer machines. This document describes supported versions, how to report vulnerabilities, and how the product limits destructive behavior.

## Supported versions

| Version | Supported |
|---------|-----------|
| **Latest release** ([GitHub Releases](https://github.com/Dendro-X0/Deco/releases)) | Yes |
| **Prior 0.9.x** | Best-effort fixes for security issues only |
| **Pre-0.9.0 / dev builds** | Not supported |

Security fixes ship in the **next tagged release** following responsible disclosure. We do not maintain long-lived LTS branches.

## Reporting a vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Report privately via GitHub **Security Advisories**:

[Create a private security advisory](https://github.com/Dendro-X0/Deco/security/advisories/new)

Include:

- Affected version(s) and platform (Windows / macOS / Linux)
- Steps to reproduce
- Impact assessment (data loss, privilege escalation, remote code execution, etc.)
- Proof of concept if available

We aim to acknowledge reports within **7 days** and provide a fix timeline when possible. We may request a coordinated disclosure date.

## Product security model (summary)

Deco is designed to **reduce accidental data loss**, not to sandbox arbitrary file operations:

| Control | Behavior |
|---------|----------|
| **Target allowlist** | Only known artifact kinds become candidates |
| **Risk tiers** | `safe` / `review` / `blocked`; review requires extra confirmation |
| **Quarantine-first** | Default delete mode moves files aside; restore from Quarantine |
| **Global caches** | Opt-in at scan time; execute refuses if not enabled during scan |
| **Path policy** | Blocks system paths, IDE/Electron runtimes, user-configured protected paths |
| **Scan-root guardrails** | Warns before custom scans of global toolchain caches (v0.9.10+) |

Full product safety documentation: [docs/product/safety.md](docs/product/safety.md).

## Network and privacy

- **No telemetry** — scans, paths, and file metadata are not uploaded to Deco servers.
- **Optional online use** — Settings → **Check for updates** fetches public GitHub Release metadata only when you trigger it manually.
- **Open source** — audit the desktop installer build and CLI package in this repository.

See also: [README § Privacy & security](README.md#privacy--security).

## Destructive-path checklist

Before recommending Deco to others or running cleanup on a new machine, verify:

1. **Scan roots** — only developer project folders or selected volumes; not `%USERPROFILE%` or drive roots unless intentional.
2. **Custom scan mode** — heed toolchain cache warnings (`.cargo`, npm/pnpm stores); do not scan global stores unless you understand regeneration cost.
3. **Review tier** — read each row; type `DELETE REVIEW` only when you accept global cache or venv deletion.
4. **Advanced / hard delete** — leave disabled unless you explicitly need permanent deletion.
5. **Tool storage migration (Windows)** — read Plan warnings; quit running apps; verify junction + destination before deleting backups.
6. **Quarantine retention** — purge only after confirming restored paths work.

Detailed checklist: [docs/product/safety.md](docs/product/safety.md#destructive-path-checklist-v0911).

## Out of scope

Deco is **not** a substitute for:

- OS-level disk encryption or antivirus
- Backup software
- Sandboxing untrusted code
- General-purpose deletion of user Documents, photos, or email

## Classification parity

The CLI (TypeScript) and desktop engine (Rust) share [classification fixtures](tests/fixtures/classification/README.md). Wire-format stability is governed by [`schema_version`](docs/contract/changelog.md). Report classification bugs that could cause **wrong-tier deletion** as security-relevant.
