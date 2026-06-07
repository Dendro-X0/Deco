# Classification parity fixtures

Shared by:

- **CLI:** `apps/cli/tests/classification-parity.test.ts` (Vitest)
- **Desktop:** `apps/desktop/src-tauri/src/engine/classification_parity.rs` (cargo test)

Both engines classify synthetic trees from **`cases.json`** and assert matching `risk`, `safety_class`, and required `reason_codes`.

## Running

```bash
pnpm -F @dendro-x0/deco-cli test classification-parity
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml classification_parity
```

## Ecosystem coverage (v0.9.11)

| Ecosystem | Fixture case id | Notes |
|-----------|-----------------|-------|
| **JS / TS** | `node_modules_*`, `build_artifact_in_js_project`, `playwright_artifact_in_js_project` | Stale vs fresh `node_modules` |
| **Rust** | `rust_artifact_in_cargo_project`, `cargo_registry_global_cache` | Project `target/` vs global registry |
| **Go** | `go_artifact_in_module`, `go_global_cache` | |
| **Python** | `python_artifact_in_pyproject`, `python_venv_opt_in_kind` | venv is review + opt-in |
| **JVM** | `jvm_artifact_in_maven_project`, `jvm_global_cache` | |
| **.NET** | `dotnet_artifact_in_csproj`, `nuget_bun_global_caches` | Nuget global store |
| **IDE / globals** | `global_package_manager_caches`, `ide_global_cache`, `yarn_pip_uv_global_caches` | npm, pnpm, conda, yarn, pip, uv |
| **Runtime protection** | `electron_runtime_node_modules_blocked` | Cursor-style path blocked |

## Known acceptable drift

Parity tests assert **risk tier**, **safety class**, and a **minimum set of reason codes** — not identical ordering of all codes or byte totals.

| Topic | Policy |
|-------|--------|
| **Reason code order** | May differ between TS and Rust; tests check subset membership only |
| **Extra reason codes** | Allowed if risk and safety_class match |
| **Discovery vs classification** | Fixtures pass pre-discovered targets; walk/discovery parity is out of scope here |
| **Sizing / mtime edge cases** | Not covered; classification uses synthetic `age_days` |
| **Wire `kind` strings** | Hyphen in CLI discovery, snake in JSON contract — fixtures use discovery hyphen form |

If TS and Rust disagree on **risk** or **safety_class** for the same fixture, treat it as a **release blocker** until fixed or the fixture is updated with documented intent.

## Adding cases

1. Add a case to `cases.json` with unique `id`, `setup`, `targets`, and `expect`.
2. Run both test commands above.
3. Prefer one new case per ecosystem gap rather than large combined trees.

Parent: [v0.9.11-manifest.md](../../docs/product/v0.9.11-manifest.md) · [scan contract](../../docs/contract/scan-contract.md)
