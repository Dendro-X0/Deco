import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_VERSION } from '@/lib/app-version';
import {
  RELEASES_PAGE_URL,
  evaluateUpdate,
  fetchLatestRelease,
  pickWindowsDownloadAssets,
  type LatestReleaseInfo,
  type UpdateCheckResult,
} from '@/lib/github-releases';
import { formatBytes } from '@/lib/format';

async function openExternalUrl(url: string) {
  await invoke('open_url', { url });
}

type Props = {
  disabled?: boolean;
};

export function CheckForUpdatesSection({ disabled }: Props) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const latest = await fetchLatestRelease();
      setResult(evaluateUpdate(APP_VERSION, latest));
      setLastCheckedAt(Date.now());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({ status: 'error', message });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const latest: LatestReleaseInfo | null =
    result && result.status !== 'error' ? result.latest : null;
  const windowsAssets = latest ? pickWindowsDownloadAssets(latest.assets) : [];

  return (
    <div className="space-y-4 rounded-lg border border-border/40 bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold tracking-tight">Check for updates</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Compares this install with the latest release on{' '}
            <button
              type="button"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
              onClick={() => void openExternalUrl(RELEASES_PAGE_URL)}
            >
              GitHub Releases
              <ExternalLink className="h-3 w-3" />
            </button>
            .
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          disabled={disabled || checking}
          onClick={() => void runCheck()}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking…' : 'Check again'}
        </Button>
      </div>

      <p className="text-sm">
        Installed: <span className="font-mono font-semibold">v{APP_VERSION}</span>
      </p>

      {checking && !result ? (
        <p className="text-xs text-muted-foreground">Contacting GitHub…</p>
      ) : null}

      {result?.status === 'error' ? (
        <p className="text-xs text-destructive">{result.message}</p>
      ) : null}

      {result?.status === 'current' && latest ? (
        <p className="text-xs text-primary font-medium">
          You are on the latest release ({latest.tag_name}).
          {lastCheckedAt ? (
            <span className="text-muted-foreground font-normal">
              {' '}
              · checked {new Date(lastCheckedAt).toLocaleString()}
            </span>
          ) : null}
        </p>
      ) : null}

      {result?.status === 'update_available' && latest ? (
        <div className="space-y-3">
          <p className="text-xs text-amber-500 font-medium">
            Update available: {latest.tag_name} (you have v{APP_VERSION})
          </p>
          {latest.body.trim() ? (
            <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">{latest.body.trim()}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => void openExternalUrl(latest.html_url)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Release notes
            </Button>
          </div>
          {windowsAssets.length > 0 ? (
            <ul className="space-y-2">
              {windowsAssets.map((asset) => (
                <li
                  key={asset.download_url}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/30 bg-background/40 px-3 py-2"
                >
                  <span className="text-xs font-mono truncate">{asset.name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-1.5 shrink-0"
                    onClick={() => void openExternalUrl(asset.download_url)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                    {asset.size_bytes > 0 ? (
                      <span className="text-muted-foreground font-normal">
                        ({formatBytes(asset.size_bytes)})
                      </span>
                    ) : null}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No Windows installer assets listed on this release.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
