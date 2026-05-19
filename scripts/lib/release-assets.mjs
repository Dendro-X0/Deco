/** @typedef {{ name: string; browser_download_url: string; digest?: string }} GhAsset */

export const GITHUB_REPO = 'Dendro-X0/Deco';

export function parseTagVersion(tag) {
  const t = String(tag).trim().replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+/.test(t)) throw new Error(`Invalid release tag: ${tag}`);
  return t;
}

/** @param {GhAsset[]} assets @param {(name: string) => boolean} pred */
export function findReleaseAsset(assets, pred) {
  return assets.find((a) => pred(a.name.toLowerCase()));
}

export function sha256FromDigest(digest) {
  if (!digest || typeof digest !== 'string') return null;
  const m = digest.match(/^sha256:([a-f0-9]{64})$/i);
  return m ? m[1].toUpperCase() : null;
}

/** Prefer MSI, then NSIS EXE. */
export function pickWindowsInstaller(assets) {
  const msi =
    findReleaseAsset(assets, (n) => n.endsWith('.msi') && n.includes('deco') && n.includes('x64')) ??
    findReleaseAsset(assets, (n) => n.endsWith('.msi'));
  if (msi) return { kind: 'wix', asset: msi };
  const exe =
    findReleaseAsset(assets, (n) => n.endsWith('.exe') && n.includes('setup') && n.includes('deco')) ??
    findReleaseAsset(assets, (n) => n.endsWith('.exe') && n.includes('deco'));
  if (exe) return { kind: 'nullsoft', asset: exe };
  return null;
}

export function pickMacDmg(assets) {
  const dmg =
    findReleaseAsset(assets, (n) => n.endsWith('.dmg') && n.includes('aarch64')) ??
    findReleaseAsset(assets, (n) => n.endsWith('.dmg'));
  return dmg ?? null;
}

export function dmgUrl(version, assetName) {
  return `https://github.com/${GITHUB_REPO}/releases/download/v${version}/${assetName}`;
}
