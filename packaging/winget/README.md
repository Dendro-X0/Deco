# Windows Package Manager (winget)

Deco publishes **manifest templates** here for submission to [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs).

**Package identifier:** `Dendro-X0.Deco`

## After each release

When the GitHub Release includes a Windows `.msi` (or NSIS `.exe`):

```bash
node scripts/sync-package-manifests.mjs v0.8.0
```

Copy the generated folder to the community repo:

```text
packaging/winget/manifests/d/De/Dendro-X0.Deco/<version>/
  → manifests/d/De/Dendro-X0.Deco/<version>/
```

Open a PR against `microsoft/winget-pkgs` (see [their contributing guide](https://github.com/microsoft/winget-pkgs/blob/master/doc/README.md)).

## End-user install (after manifest is merged)

```powershell
winget install Dendro-X0.Deco
```

Until the PR is merged, install from [GitHub Releases](https://github.com/Dendro-X0/Deco/releases).

## Validate locally

```powershell
winget validate --manifest packaging/winget/manifests/d/De/Dendro-X0.Deco/0.8.0
```

(Adjust version path after sync.)
