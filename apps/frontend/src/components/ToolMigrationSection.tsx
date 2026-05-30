import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FolderOpen, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Checkbox } from '@/components/ui/checkbox';
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
import { pickToolMigrationDest, pickToolMigrationRoot, pickToolMigrationSource } from '@/lib/pick-folders';
import { revealPathInExplorer } from '@/lib/policy-pack';
import {
  toolMigrationProfilesByCategory,
  type ToolMigrationCategory,
  type ToolMigrationUiId,
} from '@/lib/tool-migration-profiles';
import type {
  ToolMigrationBackupEntry,
  ToolMigrationPlan,
  ToolMigrationResult,
} from '@/lib/tool-migration-types';
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

function MigrationBackupPanel({
  backups,
  disabled,
  onError,
  onDeleted,
}: {
  backups: ToolMigrationBackupEntry[];
  disabled?: boolean;
  onError?: (message: string) => void;
  onDeleted: (path: string) => void;
}) {
  const { t } = useI18n();
  const [deleteTarget, setDeleteTarget] = useState<ToolMigrationBackupEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (backups.length === 0) return null;

  const deleteBackup = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const bytesFreed = (await invoke('migrate_tool_dir_delete_backup', {
        path: deleteTarget.path,
      })) as number;
      onDeleted(deleteTarget.path);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-xs">
        <p className="font-semibold text-amber-800 dark:text-amber-300">
          {t('settings.toolMigration.backupCleanupTitle')}
        </p>
        <p className="text-muted-foreground leading-relaxed">{t('settings.toolMigration.backupCleanupHint')}</p>
        <ul className="space-y-2 list-none pl-0">
          {backups.map((backup) => (
            <li key={backup.path} className="rounded border border-border/40 bg-background/60 p-2 space-y-1">
              {backup.leg ? <p className="font-semibold capitalize">{backup.leg}</p> : null}
              <p className="font-mono break-all">{backup.path}</p>
              {backup.bytes != null ? (
                <p>
                  <span className="text-muted-foreground">{t('settings.toolMigration.size')}</span>{' '}
                  <span className="font-mono">{formatBytes(backup.bytes)}</span>
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  disabled={disabled || deleting}
                  onClick={() => void revealPathInExplorer(backup.path).catch((err: unknown) => {
                    onError?.(err instanceof Error ? err.message : String(err));
                  })}
                >
                  <FolderOpen className="h-3.5 w-3.5" aria-hidden />
                  {t('settings.toolMigration.openBackup')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  disabled={disabled || deleting}
                  onClick={() => setDeleteTarget(backup)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {t('settings.toolMigration.deleteBackup')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <ConfirmDialog
        open={deleteTarget != null}
        title={t('settings.toolMigration.deleteBackupConfirmTitle')}
        description={t('settings.toolMigration.deleteBackupConfirmDescription', {
          path: deleteTarget?.path ?? '',
        })}
        confirmLabel={t('settings.toolMigration.deleteBackup')}
        cancelLabel={t('common.cancel')}
        destructive
        busy={deleting}
        onConfirm={() => void deleteBackup()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </>
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
  const [customMode, setCustomMode] = useState(false);
  const [destRoot, setDestRoot] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [customDest, setCustomDest] = useState('');
  const [busyKind, setBusyKind] = useState<BusyKind | null>(null);
  const [busyStartedAt, setBusyStartedAt] = useState<number | null>(null);
  const [busyElapsedMs, setBusyElapsedMs] = useState(0);
  const [plan, setPlan] = useState<ToolMigrationPlan | null>(null);
  const [result, setResult] = useState<ToolMigrationResult | null>(null);
  const [runConfirmOpen, setRunConfirmOpen] = useState(false);
  const [removedBackupPaths, setRemovedBackupPaths] = useState<Set<string>>(() => new Set());

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
    setRemovedBackupPaths(new Set());
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

  const isCustom = customMode;

  const pathLeafName = (p: string) => {
    const trimmed = p.trim().replace(/[\\/]+$/, '');
    const parts = trimmed.split(/[\\/]/);
    return parts[parts.length - 1] ?? '';
  };

  const planMigration = async () => {
    if (isCustom) {
      const source = customSource.trim();
      const dest = customDest.trim();
      if (!source) {
        onError?.(t('settings.toolMigration.customSourceRequired'));
        return;
      }
      if (!dest) {
        onError?.(t('settings.toolMigration.customDestRequired'));
        return;
      }
      const sourceLeaf = pathLeafName(source);
      const destLeaf = pathLeafName(dest);
      if (sourceLeaf && destLeaf && sourceLeaf.toLowerCase() !== destLeaf.toLowerCase()) {
        onError?.(t('settings.toolMigration.customDestMustBeLeaf'));
        return;
      }
      beginBusy('plan');
      setResult(null);
      setPlan(null);
      try {
        const next = (await invoke('migrate_tool_dir_plan', {
          tool: 'custom',
          source,
          dest,
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
      return;
    }

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
      const dest = isCustom ? customDest.trim() : destRoot.trim();
      const next = (await invoke('migrate_tool_dir_run', {
        tool: isCustom ? 'custom' : tool,
        ...(isCustom
          ? { source: customSource.trim(), dest }
          : { destRoot: dest }),
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

  const visibleBackups = useMemo(() => {
    const source = result?.pending_backups ?? plan?.pending_backups ?? [];
    return source.filter((backup) => !removedBackupPaths.has(backup.path));
  }, [plan, result, removedBackupPaths]);

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
    !plan.already_complete &&
    (plan.running_processes?.length ?? 0) === 0 &&
    (isCustom ? customSource.trim().length > 0 && customDest.trim().length > 0 : destRoot.trim().length > 0);

  const canPlan = isCustom
    ? customSource.trim().length > 0 && customDest.trim().length > 0
    : destRoot.trim().length > 0;

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

          <label
            className={`flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-background/40 p-3 cursor-pointer ${
              busy ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-semibold">{t('settings.toolMigration.customModeLabel')}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t('settings.toolMigration.customModeDescription')}
              </p>
            </div>
            <Checkbox
              checked={customMode}
              onCheckedChange={(v) => {
                setCustomMode(v === true);
                clearPlanState();
              }}
              disabled={busy}
              className="shrink-0"
              aria-label={t('settings.toolMigration.customModeLabel')}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {!isCustom ? (
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
            ) : null}
            {!isCustom ? (
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
            ) : null}
          </div>

          {isCustom ? (
              <div className="space-y-4">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t('settings.toolMigration.customModeHint')}
                </p>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    {t('settings.toolMigration.customSource')}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={customSource}
                      onChange={(e) => {
                        setCustomSource(e.target.value);
                        clearPlanState();
                      }}
                      placeholder={t('settings.toolMigration.customSourcePlaceholder')}
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
                          const picked = await pickToolMigrationSource();
                          if (picked) {
                            setCustomSource(picked);
                            clearPlanState();
                          }
                        })();
                      }}
                    >
                      {t('settings.safety.browse')}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    {t('settings.toolMigration.customDest')}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={customDest}
                      onChange={(e) => {
                        setCustomDest(e.target.value);
                        clearPlanState();
                      }}
                      placeholder={t('settings.toolMigration.customDestPlaceholder')}
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
                          const picked = await pickToolMigrationDest();
                          if (picked) {
                            setCustomDest(picked);
                            clearPlanState();
                          }
                        })();
                      }}
                    >
                      {t('settings.safety.browse')}
                    </Button>
                  </div>
                </div>
              </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !canPlan}
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
                          {leg.bytes != null ? (
                            <p>
                              <span className="text-muted-foreground">{t('settings.toolMigration.destVerifiedSize')}</span>{' '}
                              <span className="font-mono">{formatBytes(leg.bytes)}</span>
                            </p>
                          ) : null}
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
              {plan.already_complete ? (
                <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 space-y-1 text-emerald-700 dark:text-emerald-400">
                  <p className="font-semibold">{t('settings.toolMigration.alreadyCompleteTitle')}</p>
                  <p>{t('settings.toolMigration.alreadyCompleteHint')}</p>
                </div>
              ) : null}
              {visibleBackups.length > 0 ? (
                <MigrationBackupPanel
                  backups={visibleBackups}
                  disabled={busy}
                  onError={onError}
                  onDeleted={(path) => {
                    setRemovedBackupPaths((prev) => new Set(prev).add(path));
                  }}
                />
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
