import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FolderOpen } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OperationBusyOverlay } from '@/components/OperationBusyOverlay';
import { resolveAppPlatform } from '@/lib/app-update';
import { formatBytes } from '@/lib/format';
import { pickToolMigrationRoot } from '@/lib/pick-folders';
import { revealPathInExplorer } from '@/lib/policy-pack';
import {
  toolMigrationProfilesByCategory,
  type ToolMigrationCategory,
  type ToolMigrationUiId,
} from '@/lib/tool-migration-profiles';
import type { ToolMigrationPlan, ToolMigrationResult } from '@/lib/tool-migration-types';
import { useI18n } from '@/i18n';

type SectionProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

function MigrationSettingsSection({ title, description, children }: SectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-bold tracking-tight">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
        ) : null}
      </div>
      {children ?? null}
    </section>
  );
}

function MigrationPathLine({
  label,
  path,
  openLabel,
  onError,
}: {
  label: string;
  path: string;
  openLabel: string;
  onError?: (message: string) => void;
}) {
  const open = async () => {
    try {
      await revealPathInExplorer(path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg);
    }
  };

  return (
    <div className="flex items-start gap-2">
      <p className="min-w-0 flex-1">
        <span className="text-muted-foreground">{label}</span>{' '}
        <span className="font-mono break-all">{path}</span>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 h-7 gap-1 px-2 text-[11px]"
        title={openLabel}
        onClick={() => void open()}
      >
        <FolderOpen className="h-3.5 w-3.5" aria-hidden />
        {openLabel}
      </Button>
    </div>
  );
}

type BusyKind = 'plan' | 'run';

type Props = {
  disabled?: boolean;
  onError?: (message: string) => void;
};

export function ToolMigrationSection({ disabled, onError }: Props) {
  const { t } = useI18n();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [tool, setTool] = useState<ToolMigrationUiId>('cursor');
  const [destRoot, setDestRoot] = useState('');
  const [busyKind, setBusyKind] = useState<BusyKind | null>(null);
  const [busyStartedAt, setBusyStartedAt] = useState<number | null>(null);
  const [busyElapsedMs, setBusyElapsedMs] = useState(0);
  const [plan, setPlan] = useState<ToolMigrationPlan | null>(null);
  const [result, setResult] = useState<ToolMigrationResult | null>(null);
  const [runConfirmOpen, setRunConfirmOpen] = useState(false);

  useEffect(() => {
    void resolveAppPlatform().then((p) => setSupported(p.os === 'windows'));
  }, []);

  useEffect(() => {
    if (!busyKind || busyStartedAt == null) return;
    const tick = () => setBusyElapsedMs(Date.now() - busyStartedAt);
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [busyKind, busyStartedAt]);

  const clearPlanState = () => {
    setPlan(null);
    setResult(null);
  };

  const beginBusy = (kind: BusyKind) => {
    setBusyKind(kind);
    setBusyStartedAt(Date.now());
    setBusyElapsedMs(0);
  };

  const endBusy = () => {
    setBusyKind(null);
    setBusyStartedAt(null);
  };

  const profileGroups = useMemo(() => toolMigrationProfilesByCategory(), []);

  const categoryLabel = (category: ToolMigrationCategory) =>
    t(`settings.toolMigration.categories.${category}` as 'settings.toolMigration.categories.agent');

  const planMigration = async () => {
    const dest = destRoot.trim();
    if (!dest) {
      onError?.(t('settings.toolMigration.destRootRequired'));
      return;
    }
    beginBusy('plan');
    setResult(null);
    setPlan(null);
    try {
      const next = (await invoke('migrate_tool_dir_plan', {
        tool,
        destRoot: dest,
        includeSize: true,
      })) as ToolMigrationPlan;
      setPlan(next);
      if (!next.ok) onError?.(next.errors?.[0] ?? 'Migration plan failed.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg);
    } finally {
      endBusy();
    }
  };

  const runMigration = async () => {
    if (!plan?.ok || plan.plan_only) return;
    const running = plan.running_processes ?? [];
    if (running.length > 0) {
      onError?.(
        t('settings.toolMigration.processesRunningDetail', {
          processes: running.join(', '),
        }),
      );
      return;
    }
    setRunConfirmOpen(false);
    beginBusy('run');
    setResult(null);
    try {
      const dest = destRoot.trim();
      const next = (await invoke('migrate_tool_dir_run', {
        tool,
        destRoot: dest,
        copyOnly: false,
      })) as ToolMigrationResult;
      setResult(next);
      if (!next.ok) onError?.(next.errors?.[0] ?? 'Migration failed.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg);
    } finally {
      endBusy();
    }
  };

  const runConfirmDescription = useMemo(() => {
    const base = t('settings.toolMigration.runConfirmDescription');
    const bundle =
      plan?.legs && plan.legs.length > 1 ? `\n\n${t('settings.toolMigration.runConfirmBundleNote')}` : '';
    return `${base}${bundle}`;
  }, [plan?.legs, t]);

  if (supported === false) {
    return (
      <MigrationSettingsSection
        title={t('settings.toolMigration.title')}
        description={t('settings.toolMigration.unsupportedPlatform')}
      />
    );
  }

  if (supported === null) return null;

  const busy = Boolean(disabled) || busyKind != null;
  const canRun =
    plan?.ok &&
    !plan.plan_only &&
    (plan.running_processes?.length ?? 0) === 0 &&
    destRoot.trim().length > 0;

  const overlayDetail =
    busyKind === 'run'
      ? t('settings.toolMigration.runOverlayDetail')
      : t('settings.toolMigration.planOverlayDetail');

  return (
    <>
      <OperationBusyOverlay
        visible={busyKind != null}
        title={t('settings.toolMigration.busyTitle')}
        detail={overlayDetail}
        elapsedMs={busyElapsedMs}
      />

      <ConfirmDialog
        open={runConfirmOpen}
        title={t('settings.toolMigration.runConfirmTitle')}
        description={runConfirmDescription}
        confirmLabel={t('settings.toolMigration.run')}
        cancelLabel={t('common.cancel')}
        destructive
        busy={busyKind === 'run'}
        onConfirm={() => void runMigration()}
        onCancel={() => busyKind !== 'run' && setRunConfirmOpen(false)}
      />

      <MigrationSettingsSection
        title={t('settings.toolMigration.title')}
        description={t('settings.toolMigration.description')}
      >
        <div className="space-y-3 rounded-lg border border-border/40 bg-muted/10 p-4 max-w-2xl">
          <p className="text-xs text-muted-foreground leading-relaxed">{t('settings.toolMigration.planFirstNote')}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                {t('settings.toolMigration.tool')}
              </label>
              <Select
                value={tool}
                onValueChange={(v) => {
                  setTool(v as ToolMigrationUiId);
                  clearPlanState();
                }}
                disabled={busy}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {profileGroups.map(({ category, profiles }) => (
                    <SelectGroup key={category}>
                      <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {categoryLabel(category)}
                      </SelectLabel>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                {t('settings.toolMigration.destRoot')}
              </label>
              <div className="flex gap-2">
                <Input
                  value={destRoot}
                  onChange={(e) => {
                    setDestRoot(e.target.value);
                    clearPlanState();
                  }}
                  placeholder={t('settings.toolMigration.destRootPlaceholder')}
                  className="font-mono text-sm flex-1"
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      const picked = await pickToolMigrationRoot();
                      if (picked) {
                        setDestRoot(picked);
                        clearPlanState();
                      }
                    })();
                  }}
                >
                  {t('settings.safety.browse')}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{t('settings.toolMigration.destRootHint')}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || destRoot.trim().length === 0}
              onClick={() => void planMigration()}
            >
              {busyKind === 'plan' ? t('common.loading') : t('settings.toolMigration.plan')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !canRun}
              onClick={() => setRunConfirmOpen(true)}
            >
              {busyKind === 'run' ? t('common.loading') : t('settings.toolMigration.run')}
            </Button>
          </div>

          {plan ? (
            <div className="space-y-2 text-xs">
              <p className="font-semibold">{t('settings.toolMigration.planSummary')}</p>
              {plan.legs && plan.legs.length > 0 ? (
                <ul className="space-y-2 list-none pl-0">
                  {plan.legs.map((leg) => (
                    <li key={leg.leg} className="rounded border border-border/40 p-2 space-y-1">
                      <p className="font-semibold capitalize">{leg.leg}</p>
                      {leg.skipped ? (
                        <>
                          <MigrationPathLine
                            label={t('settings.toolMigration.source')}
                            path={leg.source}
                            openLabel={t('settings.toolMigration.openSource')}
                            onError={onError}
                          />
                          <MigrationPathLine
                            label={t('settings.toolMigration.dest')}
                            path={leg.dest}
                            openLabel={t('settings.toolMigration.openDest')}
                            onError={onError}
                          />
                          <p className="text-muted-foreground">{leg.skip_reason ?? t('settings.toolMigration.legSkipped')}</p>
                        </>
                      ) : (
                        <>
                          <MigrationPathLine
                            label={t('settings.toolMigration.source')}
                            path={leg.source}
                            openLabel={t('settings.toolMigration.openSource')}
                            onError={onError}
                          />
                          <MigrationPathLine
                            label={t('settings.toolMigration.dest')}
                            path={leg.dest}
                            openLabel={t('settings.toolMigration.openDest')}
                            onError={onError}
                          />
                          {leg.bytes != null ? (
                            <p>
                              <span className="text-muted-foreground">{t('settings.toolMigration.size')}</span>{' '}
                              <span className="font-mono">{formatBytes(leg.bytes)}</span>
                            </p>
                          ) : null}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <MigrationPathLine
                    label={t('settings.toolMigration.source')}
                    path={plan.source}
                    openLabel={t('settings.toolMigration.openSource')}
                    onError={onError}
                  />
                  <MigrationPathLine
                    label={t('settings.toolMigration.dest')}
                    path={plan.dest}
                    openLabel={t('settings.toolMigration.openDest')}
                    onError={onError}
                  />
                </>
              )}
              {plan.bytes != null ? (
                <p>
                  <span className="text-muted-foreground">{t('settings.toolMigration.totalSize')}</span>{' '}
                  <span className="font-mono">{formatBytes(plan.bytes)}</span>
                </p>
              ) : null}
              {plan.plan_only ? (
                <p className="text-amber-600/90">{t('settings.toolMigration.planOnly')}</p>
              ) : null}
              {(plan.running_processes?.length ?? 0) > 0 ? (
                <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 space-y-1 text-amber-600/95">
                  <p className="font-semibold">{t('settings.toolMigration.processesRunning')}</p>
                  <p>
                    {t('settings.toolMigration.processesRunningDetail', {
                      processes: plan.running_processes!.join(', '),
                    })}
                  </p>
                </div>
              ) : null}
              {plan.warnings?.length ? (
                <div className="space-y-1 text-amber-600/90">
                  <p className="font-semibold">
                    {t('settings.toolMigration.warnings', { count: plan.warnings.length })}
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {plan.warnings.map((warning, index) => (
                      <li key={`${index}-${warning.slice(0, 24)}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {plan.ok && !plan.plan_only ? (
                <p className="text-muted-foreground border-t border-border/40 pt-2">
                  {t('settings.toolMigration.verifyHint')}
                </p>
              ) : null}
              {plan?.errors?.length ? (
                <ul className="list-disc pl-4 space-y-0.5 text-destructive">
                  {plan.errors.map((err, index) => (
                    <li key={`${index}-${err.slice(0, 24)}`}>{err}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <div className="space-y-2 text-xs border-t border-border/40 pt-2">
              <p className="font-semibold">
                {result.ok ? t('settings.toolMigration.doneOk') : t('settings.toolMigration.doneFail')}
              </p>
              {result.audit_log_path ? (
                <p>
                  <span className="text-muted-foreground">{t('settings.toolMigration.audit')}</span>{' '}
                  <span className="font-mono break-all">{result.audit_log_path}</span>
                </p>
              ) : null}
              {result.backup_path ? (
                <p className="text-amber-600/90">
                  <span className="text-muted-foreground">{t('settings.toolMigration.backup')}</span>{' '}
                  <span className="font-mono break-all">{result.backup_path}</span>
                </p>
              ) : null}
              {result.legs?.map((leg) =>
                leg.backup_path ? (
                  <p key={leg.leg} className="text-amber-600/90">
                    <span className="text-muted-foreground capitalize">{leg.leg}</span>{' '}
                    <span className="font-mono break-all">{leg.backup_path}</span>
                  </p>
                ) : null,
              )}
              {result.warnings?.length ? (
                <ul className="list-disc pl-4 space-y-0.5 text-amber-600/90">
                  {result.warnings.map((warning, index) => (
                    <li key={`${index}-${warning.slice(0, 24)}`}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </MigrationSettingsSection>
    </>
  );
}
