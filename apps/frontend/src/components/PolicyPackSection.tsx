import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  applyPolicyPack,
  listPolicyPackExamples,
  pickPolicyPackSource,
  pickPolicyPackTarget,
  previewPolicyPack,
  type PolicyPackExample,
  type PolicyPackPreview,
} from '@/lib/policy-pack';

type Props = {
  disabled?: boolean;
  onError?: (message: string) => void;
};

const CUSTOM_SOURCE = '__custom__';

export function PolicyPackSection({ disabled, onError }: Props) {
  const [examples, setExamples] = useState<PolicyPackExample[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(true);
  const [sourceChoice, setSourceChoice] = useState<string>('');
  const [customSource, setCustomSource] = useState<string | null>(null);
  const [targetRoot, setTargetRoot] = useState<string | null>(null);
  const [preview, setPreview] = useState<PolicyPackPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickingSource, setPickingSource] = useState(false);
  const [pickingTarget, setPickingTarget] = useState(false);
  const [appliedPath, setAppliedPath] = useState<string | null>(null);

  const resolvedSource =
    sourceChoice === CUSTOM_SOURCE ? customSource : examples.find((e) => e.id === sourceChoice)?.path ?? null;

  const loadExamples = useCallback(async () => {
    setLoadingExamples(true);
    try {
      const list = await listPolicyPackExamples();
      setExamples(list);
      setSourceChoice((prev) => {
        if (prev && (prev === CUSTOM_SOURCE || list.some((e) => e.id === prev))) return prev;
        return list[0]?.id ?? '';
      });
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingExamples(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadExamples();
  }, [loadExamples]);

  useEffect(() => {
    if (!resolvedSource || !targetRoot) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await previewPolicyPack(resolvedSource, targetRoot);
        if (!cancelled) setPreview(result);
      } catch (e) {
        if (!cancelled) {
          setPreview(null);
          onError?.(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedSource, targetRoot, onError]);

  const handleApply = async () => {
    if (!resolvedSource || !targetRoot) {
      onError?.('Choose a policy pack and a target project folder.');
      return;
    }
    if (preview && !preview.ok) {
      onError?.(preview.error ?? 'Policy pack failed validation.');
      return;
    }
    setBusy(true);
    try {
      const dest = await applyPolicyPack(resolvedSource, targetRoot);
      setAppliedPath(dest);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const controlsDisabled = Boolean(disabled) || busy;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
            Policy pack
          </label>
          <Select
            value={sourceChoice || undefined}
            onValueChange={(v) => {
              setSourceChoice(v);
              if (v !== CUSTOM_SOURCE) setCustomSource(null);
            }}
            disabled={controlsDisabled || loadingExamples}
          >
            <SelectTrigger className="bg-background/50">
              <SelectValue placeholder={loadingExamples ? 'Loading…' : 'Select pack'} />
            </SelectTrigger>
            <SelectContent>
              {examples.map((ex) => (
                <SelectItem key={ex.id} value={ex.id}>
                  {ex.label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_SOURCE}>Browse folder…</SelectItem>
            </SelectContent>
          </Select>
          {sourceChoice && sourceChoice !== CUSTOM_SOURCE ? (
            <p className="text-xs text-muted-foreground">
              {examples.find((e) => e.id === sourceChoice)?.description}
            </p>
          ) : null}
          {customSource ? (
            <p className="text-xs font-mono text-muted-foreground break-all">{customSource}</p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={controlsDisabled || pickingSource}
            onClick={() => {
              void (async () => {
                setPickingSource(true);
                try {
                  const picked = await pickPolicyPackSource();
                  if (picked) {
                    setCustomSource(picked);
                    setSourceChoice(CUSTOM_SOURCE);
                  }
                } finally {
                  setPickingSource(false);
                }
              })();
            }}
          >
            {pickingSource ? 'Opening…' : 'Browse policy folder…'}
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
            Apply to project
          </label>
          {targetRoot ? (
            <p className="text-xs font-mono text-muted-foreground break-all rounded-lg border border-border/40 bg-muted/10 p-3">
              {targetRoot}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No folder selected.</p>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={controlsDisabled || pickingTarget}
            onClick={() => {
              void (async () => {
                setPickingTarget(true);
                try {
                  const picked = await pickPolicyPackTarget();
                  if (picked) setTargetRoot(picked);
                } finally {
                  setPickingTarget(false);
                }
              })();
            }}
          >
            {pickingTarget ? 'Opening…' : 'Choose project folder…'}
          </Button>
        </div>
      </div>

      {preview ? (
        <div
          className={`rounded-lg border p-4 text-xs space-y-1 ${
            preview.ok ? 'border-border/40 bg-muted/10' : 'border-destructive/40 bg-destructive/5'
          }`}
        >
          {preview.ok ? (
            <>
              <p className="font-medium text-sm">Validation OK</p>
              <p className="text-muted-foreground font-mono break-all">{preview.configPath}</p>
              <p>{preview.summary}</p>
              {preview.targetExisting ? (
                <p className="text-amber-600/90 pt-1">
                  Existing <code className="text-[0.7rem]">.deco/disk-cleanup.json</code> will be
                  replaced.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-destructive">{preview.error ?? 'Validation failed.'}</p>
          )}
        </div>
      ) : null}

      {appliedPath ? (
        <p className="text-xs text-emerald-600/90">
          Applied — wrote <span className="font-mono break-all">{appliedPath}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="font-bold"
          disabled={
            controlsDisabled || !resolvedSource || !targetRoot || (preview !== null && !preview.ok)
          }
          onClick={() => void handleApply()}
        >
          {busy ? 'Applying…' : 'Apply policy pack'}
        </Button>
      </div>
    </div>
  );
}
