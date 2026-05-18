# Deco documentation

Project encyclopedia for **Deco** (desktop + CLI disk cleanup for developer machines). Start here, then drill into a category.

## Start here

| Doc | What it covers |
|-----|----------------|
| [Getting started — Overview](getting-started/overview.md) | What Deco is, surfaces, safety model at a glance |
| [Getting started — Install](getting-started/install.md) | Download desktop + CLI from GitHub Releases |
| [Getting started — Quickstart](getting-started/quickstart.md) | First scan and cleanup in minutes |

## By category

### Product

| Doc | What it covers |
|-----|----------------|
| [Features](product/features.md) | Desktop UX, engine capabilities, commands |
| [Project status](product/status.md) | Handoff snapshot, completed milestones, next steps |
| [Version roadmap](product/version-roadmap.md) | Forward plan: v0.4.x–v0.8+ (UX, ecosystems, engine, trust) |
| [Safety model](product/safety.md) | Risk tiers, quarantine, review confirmation |
| [Roadmap](../ROADMAP.md) | Milestone archive M0–M8 + links to version roadmap |
| [PROJECT.md](../PROJECT.md) | North star, goals, non-goals (repo root) |

### Desktop app

| Doc | What it covers |
|-----|----------------|
| [User guide](desktop/user-guide.md) | Guided cleanup, preview, planner, quarantine UI |

### CLI

| Doc | What it covers |
|-----|----------------|
| [CLI usage](cli/usage.md) | Commands, flags, JSON output |
| [CI automation](cli/ci-automation.md) | Dry-run `--json`, exit codes, reclaim gate script |
| [Configuration](cli/configuration.md) | `.deco/disk-cleanup.json`, `--config` |

### Distribution

| Doc | What it covers |
|-----|----------------|
| [GitHub Releases](distribution/github-releases.md) | **Primary install channel** — MSI, NSIS, CLI zip |
| [Release process](distribution/release-process.md) | Tagging, CI artifacts, maintainer checklist |
| [CI / release platforms](distribution/ci-and-release-platforms.md) | Which OSes get installers (Windows today) |

### Scan contract (automation)

| Doc | What it covers |
|-----|----------------|
| [Scan contract](contract/scan-contract.md) | Wire JSON, risk semantics, versioning |
| [Contract changelog](contract/changelog.md) | `schema_version` history |
| [JSON Schema](schemas/scan-report.schema.json) | Machine-readable report shape |

### Development

| Doc | What it covers |
|-----|----------------|
| [Contributing](development/contributing.md) | Repo layout, build, test commands |
| [CI and testing](development/ci-and-testing.md) | GitHub Actions, release workflow |

### Milestones (delivery archive)

Shipped capability checklists M0–M8:

| | | |
|--|--|--|
| [M0](milestones/milestone-0.md) Baseline | [M1](milestones/milestone-1.md) Reliability | [M2](milestones/milestone-2.md) Contract |
| [M3](milestones/milestone-3.md) Config | [M4](milestones/milestone-4.md) Go cache | [M5](milestones/milestone-5.md) Performance |
| [M6](milestones/milestone-6.md) CI / releases | [M7](milestones/milestone-7.md) Ecosystems | [M8](milestones/milestone-8.md) Desktop UX |

[Index of all milestones](milestones/README.md)

## Repository map

```
apps/cli/           TypeScript CLI (deco)
apps/desktop/       Tauri shell + Rust engine
apps/frontend/      Vite + React UI
docs/               This tree
```

## External links

- [CHANGELOG.md](../CHANGELOG.md) — user-visible changes
- [LICENSE](../LICENSE)
