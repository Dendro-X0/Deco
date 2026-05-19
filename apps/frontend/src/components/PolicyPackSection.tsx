import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/i18n';
import {
  applyPolicyPack,
  listPolicyPackExamples,
  pickPolicyPackSource,
  pickPolicyPackTarget,
  previewPolicyPack,
  readPolicyPackContents,
  revealPathInExplorer,
  type PolicyPackExample,
  type PolicyPackPreview,
} from '@/lib/policy-pack';

type Props = {
  disabled?: boolean;
  onError?: (message: string) => void;
};

const CUSTOM_SOURCE = '__custom__';

export function PolicyPackSection({ disabled, onError }: Props) {
  const { t } = useI18n();
  const [examples, setExamples] = useState<PolicyPackExample[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(true);
  const [sourceChoice, setSourceChoice] = useState<string>('');
  const [customSource, setCustomSource] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [targetRoot, setTargetRoot] = useState<string | null>(null);
  const [preview, setPreview] = useState<PolicyPackPreview | null>(null);
  const [jsonPreview, setJsonPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickingSource, setPickingSource] = useState(false);
  const [pickingTarget, setPickingTarget] = useState(false);
  const [appliedPath, setAppliedPath] = useState<string | null>(null);

  const resolvedSource =
    sourceChoice === CUSTOM_SOURCE
      ? customSource
      : (examples.find((e) => e.id === sourceChoice)?.path ?? null);

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
    if (!resolvedSource) {
      setJsonPreview(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const contents = await readPolicyPackContents(resolvedSource);
        if (!cancelled) {
          setJsonPreview(contents.ok ? contents.jsonPretty : null);
          if (!contents.ok) onError?.(contents.error ?? 'Failed to read policy pack.');
        }
      } catch (e) {
        if (!cancelled) {
          setJsonPreview(null);
          onError?.(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedSource, onError]);

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

  const selectExample = (ex: PolicyPackExample) => {
    setSourceChoice(ex.id);
    setCustomSource(null);
    setCustomLabel(null);
    setAppliedPath(null);
  };

  const handleApply = async () => {
    if (!resolvedSource || !targetRoot) {
      onError?.(t('settings.policyPack.chooseFolder'));
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
  const selectedTitle =
    sourceChoice === CUSTOM_SOURCE
      ? (customLabel ?? t('settings.policyPack.customPack'))
      : (examples.find((e) => e.id === sourceChoice)?.label ?? t('settings.policyPack.defaultTitle'));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('settings.policyPack.intro')}
        </p>
        {loadingExamples ? (
          <p className="text-sm text-muted-foreground">{t('settings.policyPack.loading')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {examples.map((ex) => {
              const selected = sourceChoice === ex.id;
              return (
                <button
                  key={ex.id}
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => selectExample(ex)}
                  className={`text-left rounded-lg border p-4 transition-colors ${
                    selected
                      ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border/40 bg-muted/10 hover:bg-muted/20'
                  }`}
                >
                  <p className="text-sm font-bold">{ex.label}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ex.description}</p>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
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
                    setCustomLabel(picked.split(/[/\\]/).filter(Boolean).pop() ?? picked);
                    setSourceChoice(CUSTOM_SOURCE);
                    setAppliedPath(null);
                  }
                } finally {
                  setPickingSource(false);
                }
              })();
            }}
          >
            {pickingSource ? t('settings.policyPack.opening') : t('settings.policyPack.browseCustom')}
          </Button>
        </div>
        {customSource ? (
          <p className="text-xs font-mono text-muted-foreground break-all">{customSource}</p>
        ) : null}
      </div>

      {jsonPreview ? (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
            {t('settings.policyPack.previewTitle', { title: selectedTitle })}
          </p>
          <ScrollArea className="h-48 rounded-lg border border-border/40 bg-muted/10">
            <pre className="p-3 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all">
              {jsonPreview}
            </pre>
          </ScrollArea>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 border-t border-border/40 pt-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
            {t('settings.policyPack.applyToProject')}
          </label>
          {targetRoot ? (
            <p className="text-xs font-mono text-muted-foreground break-all rounded-lg border border-border/40 bg-muted/10 p-3">
              {targetRoot}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('settings.policyPack.noFolder')}</p>
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
                  if (picked) {
                    setTargetRoot(picked);
                    setAppliedPath(null);
                  }
                } finally {
                  setPickingTarget(false);
                }
              })();
            }}
          >
            {pickingTarget ? t('settings.policyPack.opening') : t('settings.policyPack.chooseFolder')}
          </Button>
        </div>
      </div>

      {preview ? (
        <div
          className={`rounded-lg border p-4 text-xs space-y-2 ${
            preview.ok ? 'border-border/40 bg-muted/10' : 'border-destructive/40 bg-destructive/5'
          }`}
        >
          {preview.ok ? (
            <>
              <p className="font-medium text-sm">{t('settings.policyPack.validationOk')}</p>
              <p className="text-muted-foreground font-mono break-all">{preview.configPath}</p>
              <p>
                {t('settings.policyPack.incoming')}: {preview.summary}
              </p>
              {preview.existingSummary ? (
                <p>
                  {t('settings.policyPack.current')}: {preview.existingSummary}
                </p>
              ) : null}
              {preview.targetExisting && preview.diffLines.length > 0 ? (
                <div className="pt-2 space-y-1">
                  <p className="font-medium text-amber-600/90">{t('settings.policyPack.replacePreview')}</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                    {preview.diffLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="text-amber-600/90 pt-1">
                    {t('settings.policyPack.replaceWarning')}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-destructive">{preview.error ?? t('settings.policyPack.validationFailed')}</p>
          )}
        </div>
      ) : null}

      {appliedPath ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-emerald-600/90">
            {t('settings.policyPack.applied')}{' '}
            <span className="font-mono break-all">{appliedPath}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={controlsDisabled}
            onClick={() => void revealPathInExplorer(appliedPath)}
          >
            {t('settings.policyPack.revealExplorer')}
          </Button>
        </div>
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
          {busy ? t('settings.policyPack.applying') : t('settings.policyPack.apply')}
        </Button>
      </div>
    </div>
  );
}

