import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import type { GitDormancyHint } from '@/lib/dormancy-signals';

export function useGitDormancy(absPath: string | undefined, enabled: boolean) {
  const [hint, setHint] = useState<GitDormancyHint | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !absPath) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const result = await invoke<GitDormancyHint | null>('get_git_dormancy_hint', {
          absPath,
        });
        if (!cancelled) setHint(result);
      } catch {
        if (!cancelled) setHint(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [absPath, enabled]);

  if (!enabled) {
    return { hint: null, loading: false };
  }
  return { hint, loading };
}
