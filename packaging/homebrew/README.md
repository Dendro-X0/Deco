# Homebrew

**Cask:** `packaging/homebrew/Casks/deco.rb` — install Deco desktop from the GitHub Release `.dmg` (Apple Silicon / aarch64 builds from CI).

## After each release

```bash
node scripts/sync-package-manifests.mjs v0.8.0
```

## Install (from this repo)

```bash
brew install --cask https://raw.githubusercontent.com/Dendro-X0/Deco/main/packaging/homebrew/Casks/deco.rb
```

Or clone and:

```bash
brew install --cask ./packaging/homebrew/Casks/deco.rb
```

## Future: dedicated tap

A `homebrew-tap` repository can vendor the same cask as `brew tap dendro-x0/tap && brew install --cask deco`. For `v0.8.1` the cask-in-repo path is enough.
