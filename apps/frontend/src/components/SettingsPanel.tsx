import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { NumberInput } from '@/components/ui/number-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DiscoveryOptionsPanel } from '@/components/DiscoveryOptionsPanel';
import {
  clampMaxDepth,
  clampStaleDays,
  cloneSettingsDraft,
  isSettingsDraftDirty,
  mergeSettingsSavePreservingScanTargets,
  patchSettingsDraft,
} from '@/lib/settings-draft';
import { DisabledActionHint } from '@/components/DisabledActionHint';
import {
  settingsDiscardDisabledReason,
  settingsSaveDisabledReason,
} from '@/lib/disabled-reasons';
import { pickQuarantineFolder } from '@/lib/pick-folders';
import {
  isWindowsSystemDrivePath,
  quarantineStorageSummary,
} from '@/lib/quarantine-storage';
import { normalizeSettings } from '@/lib/settings-normalize';
import {
  CLEANUP_PROFILE_PRESETS,
  applyCleanupProfilePreset,
  resolveCleanupProfile,
  type CleanupProfilePreset,
} from '@/lib/cleanup-profiles';
import {
  SCAN_STRATEGY_PRESETS,
  applyScanStrategyPreset,
  resolveScanStrategy,
  type ScanStrategyPreset,
} from '@/lib/scan-strategy';
import type { Settings } from '@/types';
import { CheckForUpdatesSection } from '@/components/CheckForUpdatesSection';
import { PolicyPackSection } from '@/components/PolicyPackSection';
import { UiLocaleSection } from '@/components/UiLocaleSection';
import { IdeStorageGuideSection } from '@/components/IdeStorageGuideSection';
import { useI18n } from '@/i18n';
import {
  cleanupProfileDescription,
  cleanupProfileLabel,
  scanStrategyDescription,
  scanStrategyLabel,
} from '@/i18n/preset-labels';

type Props = {
  settings: Settings | null;
  scanning: boolean;
  onSave: (settings: Settings) => Promise<void>;
  onDiscard: () => void;
  onError?: (message: string) => void;
};

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
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

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 bg-muted/20 p-4 rounded-lg cursor-pointer ${
        disabled ? 'opacity-60 pointer-events-none' : ''
      }`}
    >
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className="shrink-0"
      />
    </label>
  );
}

export function SettingsPanel({ settings, scanning, onSave, onDiscard, onError }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickingQuarantine, setPickingQuarantine] = useState(false);

  const saved = useMemo(
    () => (settings ? normalizeSettings(settings) : null),
    [settings],
  );

  const dirty = useMemo(
    () => (draft && saved ? isSettingsDraftDirty(draft, saved) : false),
    [draft, saved],
  );

  useEffect(() => {
    if (!saved) return;
    setDraft((prev) => {
      if (prev && isSettingsDraftDirty(prev, saved)) return prev;
      return cloneSettingsDraft(saved);
    });
  }, [saved]);

  const patch = useCallback((patch: Partial<Settings>) => {
    setDraft((prev) => (prev ? patchSettingsDraft(prev, patch) : prev));
  }, []);

  const scanMode = draft?.use_custom_scan_roots ? 'custom' : 'partition';

  const saveReason = settingsSaveDisabledReason({ dirty, saving, scanning });
  const discardReason = settingsDiscardDisabledReason({ dirty, saving, scanning });

  const handleDiscard = () => {
    if (saved) setDraft(cloneSettingsDraft(saved));
    onDiscard();
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = normalizeSettings(
        mergeSettingsSavePreservingScanTargets(
          {
            ...draft,
            stale_days: clampStaleDays(draft.stale_days),
            max_depth: clampMaxDepth(draft.max_depth),
          },
          saved!,
        ),
      );
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <Card className="border-border/40 bg-card/30">
        <CardContent className="py-16 text-center text-muted-foreground text-sm">
          {t('settings.loading')}
        </CardContent>
      </Card>
    );
  }

  const activeProfile = resolveCleanupProfile(draft);
  const activeProfileMeta = CLEANUP_PROFILE_PRESETS.find((p) => p.id === activeProfile);
  const activeStrategy = resolveScanStrategy(draft);
  const activeStrategyMeta = SCAN_STRATEGY_PRESETS.find((p) => p.id === activeStrategy);

  const quarantineEnabled = draft.delete_mode === 'quarantine';
  const quarantineLayout = draft.quarantine_layout ?? 'per_drive';
  const quarantinePath = draft.quarantine_custom_path ?? '';

  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{t('settings.title')}</CardTitle>
          <CardDescription>{t('settings.description')}</CardDescription>
        </div>
        {dirty ? (
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/90 shrink-0">
            {t('settings.unsaved')}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-8">
        <UiLocaleSection />
        <Separator className="opacity-50" />

        <SettingsSection title={t('settings.updates.title')} description={t('settings.updates.description')}>
          <CheckForUpdatesSection disabled={scanning || saving} />
        </SettingsSection>

        <Separator className="opacity-50" />

        <SettingsSection
          title={t('settings.scanBehavior.title')}
          description={
            scanMode === 'partition'
              ? t('settings.scanBehavior.descriptionPartition')
              : t('settings.scanBehavior.descriptionCustom')
          }
        >
          <div className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                {t('settings.scanBehavior.cleanupProfile')}
              </label>
              <Select
                value={activeProfile === 'custom' ? 'custom' : activeProfile}
                onValueChange={(v) => {
                  if (v === 'custom') return;
                  patch(applyCleanupProfilePreset(v as CleanupProfilePreset));
                }}
                disabled={scanning || saving}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLEANUP_PROFILE_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {cleanupProfileLabel(t, preset.id)}
                    </SelectItem>
                  ))}
                  {activeProfile === 'custom' ? (
                    <SelectItem value="custom">{t('common.custom')}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {activeProfile === 'custom'
                  ? t('settings.scanBehavior.customMismatchProfile')
                  : activeProfileMeta
                    ? cleanupProfileDescription(t, activeProfileMeta.id)
                    : t('settings.scanBehavior.profileBundleHint')}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                {t('settings.scanBehavior.scanStrategy')}
              </label>
              <Select
                value={activeStrategy === 'custom' ? 'custom' : activeStrategy}
                onValueChange={(v) => {
                  if (v === 'custom') return;
                  patch(applyScanStrategyPreset(v as ScanStrategyPreset));
                }}
                disabled={scanning || saving}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCAN_STRATEGY_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {scanStrategyLabel(t, preset.id)}
                    </SelectItem>
                  ))}
                  {activeStrategy === 'custom' ? (
                    <SelectItem value="custom">{t('common.custom')}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {activeStrategy === 'custom'
                  ? t('settings.scanBehavior.customMismatchStrategy')
                  : activeStrategyMeta
                    ? scanStrategyDescription(t, activeStrategyMeta.id)
                    : t('settings.scanBehavior.strategyBundleHint')}
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {scanMode === 'partition' ? (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  {t('settings.scanBehavior.scanScope')}
                </label>
                <Select
                  value={draft.scan_scope ?? 'all'}
                  onValueChange={(v) => patch({ scan_scope: v })}
                  disabled={scanning || saving}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('settings.presets.scanScope.all')}</SelectItem>
                    <SelectItem value="projects">{t('settings.presets.scanScope.projects')}</SelectItem>
                    <SelectItem value="drives">{t('settings.presets.scanScope.drives')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                {t('settings.scanBehavior.safetyProfile')}
              </label>
              <Select
                value={draft.profile}
                onValueChange={(v) => patch({ profile: v })}
                disabled={scanning || saving}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="safe">{t('settings.presets.safetyProfile.safe')}</SelectItem>
                  <SelectItem value="balanced">{t('settings.presets.safetyProfile.balanced')}</SelectItem>
                  <SelectItem value="aggressive">{t('settings.presets.safetyProfile.aggressive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                {t('settings.scanBehavior.staleThreshold')}
              </label>
              <NumberInput
                min={1}
                max={365}
                step={1}
                value={draft.stale_days}
                disabled={scanning || saving}
                onValueChange={(v) => patch({ stale_days: clampStaleDays(v) })}
                aria-label={t('settings.scanBehavior.staleAria')}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border/40 bg-muted/10 p-4">
            <div>
              <h4 className="text-xs font-bold tracking-tight">
                {t('settings.scanBehavior.performance.title')}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {t('settings.scanBehavior.performance.hint')}
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  {t('settings.scanBehavior.performance.maxDepth')}
                </label>
                <NumberInput
                  min={1}
                  max={32}
                  step={1}
                  value={draft.max_depth}
                  disabled={scanning || saving}
                  onValueChange={(v) => patch({ max_depth: clampMaxDepth(v) })}
                  aria-label={t('settings.scanBehavior.performance.maxDepthAria')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  {t('settings.scanBehavior.performance.workers')}
                </label>
                <Select
                  value={
                    ['auto', 'low', 'high'].includes(draft.scan_concurrency_mode ?? '')
                      ? (draft.scan_concurrency_mode as string)
                      : 'auto'
                  }
                  onValueChange={(v) => patch({ scan_concurrency_mode: v })}
                  disabled={scanning || saving}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t('settings.presets.concurrency.auto')}</SelectItem>
                    <SelectItem value="low">{t('settings.presets.concurrency.low')}</SelectItem>
                    <SelectItem value="high">{t('settings.presets.concurrency.high')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ToggleRow
              label={t('settings.scanBehavior.performance.gitDormancy')}
              description={t('settings.scanBehavior.performance.gitDormancyDesc')}
              checked={draft.check_git_dormancy ?? false}
              onCheckedChange={(v) => patch({ check_git_dormancy: v })}
              disabled={scanning || saving}
            />
            <ToggleRow
              label={t('settings.scanBehavior.performance.quickUpdate')}
              description={t('settings.scanBehavior.performance.quickUpdateDesc')}
              checked={draft.incremental_inventory_enabled ?? true}
              onCheckedChange={(v) => patch({ incremental_inventory_enabled: v })}
              disabled={scanning || saving}
            />
            <ToggleRow
              label={t('settings.scanBehavior.performance.fastSize')}
              description={t('settings.scanBehavior.performance.fastSizeDesc')}
              checked={draft.fast_dependency_size_estimate ?? true}
              onCheckedChange={(v) => patch({ fast_dependency_size_estimate: v })}
              disabled={scanning || saving}
            />
          </div>
        </SettingsSection>

        <Separator />

        <SettingsSection
          title={t('settings.policyPack.title')}
          description={t('settings.policyPack.description')}
        >
          <PolicyPackSection
            disabled={scanning || saving}
            onError={onError}
          />
        </SettingsSection>

        <Separator />

        <SettingsSection
          title={t('settings.discovery.title')}
          description={t('settings.discovery.description')}
        >
          <DiscoveryOptionsPanel
            settings={draft}
            disabled={scanning || saving}
            onPatch={patch}
          />
        </SettingsSection>

        <Separator />

        <SettingsSection
          title={t('settings.safety.title')}
          description={t('settings.safety.description')}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.safety.deleteMode')}</label>
            <Select
              value={draft.delete_mode === 'quarantine' ? 'quarantine' : 'delete'}
              onValueChange={(v) => patch({ delete_mode: v })}
              disabled={scanning || saving}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delete">{t('settings.safety.deleteInPlace')}</SelectItem>
                <SelectItem value="quarantine">{t('settings.safety.quarantineSameDrive')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('settings.safety.deleteHint')}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.safety.cleanupDiskMode')}</label>
            <Select
              value={
                ['auto', 'hdd', 'standard'].includes(draft.cleanup_disk_mode ?? '')
                  ? (draft.cleanup_disk_mode as string)
                  : 'auto'
              }
              onValueChange={(v) => patch({ cleanup_disk_mode: v })}
              disabled={scanning || saving}
            >
              <SelectTrigger className="w-full max-w-md bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t('settings.presets.cleanupDiskMode.auto')}</SelectItem>
                <SelectItem value="hdd">{t('settings.presets.cleanupDiskMode.hdd')}</SelectItem>
                <SelectItem value="standard">{t('settings.presets.cleanupDiskMode.standard')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('settings.safety.diskHint')}
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-border/60 p-4">
            <Checkbox
              id="fast-tree-delete"
              checked={draft.fast_tree_delete_enabled ?? true}
              onCheckedChange={(v) => patch({ fast_tree_delete_enabled: v === true })}
              disabled={scanning || saving}
            />
            <div className="space-y-1">
              <label htmlFor="fast-tree-delete" className="text-sm font-medium leading-none cursor-pointer">
                {t('settings.safety.fastDelete')}
              </label>
              <p className="text-xs text-muted-foreground">{t('settings.safety.fastDeleteDesc')}</p>
            </div>
          </div>
          <div
            className={`space-y-3 rounded-lg border p-4 ${quarantineEnabled ? 'border-border/60' : 'border-border/30 opacity-60'}`}
          >
            <div>
              <p className="text-sm font-bold">{t('settings.safety.quarantineStorage')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {quarantineStorageSummary(draft.delete_mode, quarantineLayout, quarantinePath)}
              </p>
              {!quarantineEnabled && (
                <p className="text-xs text-amber-600/90 mt-1">
                  {t('settings.safety.quarantineEnableHint')}
                </p>
              )}
            </div>
            <Select
              value={quarantineLayout === 'custom' ? 'custom' : 'per_drive'}
              onValueChange={(v) =>
                patch({
                  quarantine_layout: v,
                  ...(v === 'per_drive' ? { quarantine_custom_path: '' } : {}),
                })
              }
              disabled={scanning || saving || !quarantineEnabled}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="per_drive">{t('settings.safety.quarantinePerDrive')}</SelectItem>
                <SelectItem value="custom">{t('settings.safety.quarantineCustom')}</SelectItem>
              </SelectContent>
            </Select>
            {quarantineLayout === 'custom' && quarantineEnabled && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={quarantinePath}
                  onChange={(e) => patch({ quarantine_custom_path: e.target.value })}
                  placeholder={t('settings.safety.quarantinePlaceholder')}
                  className="font-mono text-sm flex-1"
                  disabled={scanning || saving}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  disabled={scanning || saving || pickingQuarantine}
                  onClick={() => {
                    void (async () => {
                      setPickingQuarantine(true);
                      try {
                        const picked = await pickQuarantineFolder();
                        if (picked) patch({ quarantine_custom_path: picked, quarantine_layout: 'custom' });
                      } finally {
                        setPickingQuarantine(false);
                      }
                    })();
                  }}
                >
                  {pickingQuarantine ? t('settings.policyPack.opening') : t('settings.safety.browse')}
                </Button>
              </div>
            )}
            {quarantineEnabled &&
              quarantineLayout === 'custom' &&
              quarantinePath.trim() &&
              isWindowsSystemDrivePath(quarantinePath) && (
                <p className="text-xs text-amber-600/90">
                  {t('settings.safety.systemDriveWarning')}
                </p>
              )}
          </div>
          <ToggleRow
            label={t('settings.safety.advancedMode')}
            description={t('settings.safety.advancedDesc')}
            checked={draft.advanced_mode}
            onCheckedChange={(v) => patch({ advanced_mode: v })}
            disabled={scanning || saving}
          />
          {draft.advanced_mode ? (
            <div className="space-y-2 max-w-xs pl-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                {t('settings.safety.classifyThreshold')}
              </label>
              <NumberInput
                min={1}
                max={128}
                step={1}
                value={draft.classify_parallel_threshold ?? 8}
                disabled={scanning || saving}
                onValueChange={(v) =>
                  patch({
                    classify_parallel_threshold: Math.min(128, Math.max(1, Math.round(v))),
                  })
                }
                aria-label={t('settings.safety.classifyAria')}
              />
              <p className="text-xs text-muted-foreground">{t('settings.safety.classifyHint')}</p>
            </div>
          ) : null}
        </SettingsSection>

        <SettingsSection
          title={t('settings.experimental.title')}
          description={t('settings.experimental.description')}
        >
          <div className="flex items-start gap-3 rounded-lg border border-border/60 p-4">
            <Checkbox
              id="ntfs-usn-probe"
              checked={draft.experimental_windows_ntfs_usn_inventory === true}
              onCheckedChange={(v) => patch({ experimental_windows_ntfs_usn_inventory: v === true })}
              disabled={scanning || saving}
            />
            <div className="space-y-1">
              <label htmlFor="ntfs-usn-probe" className="text-sm font-medium leading-none cursor-pointer">
                {t('settings.experimental.ntfsUsn')}
              </label>
              <p className="text-xs text-muted-foreground">{t('settings.experimental.ntfsUsnDesc')}</p>
            </div>
          </div>
        </SettingsSection>

        <Separator />

        <IdeStorageGuideSection />

        <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-border/40">
          <DisabledActionHint reason={discardReason}>
            <Button variant="ghost" disabled={discardReason !== null} onClick={handleDiscard}>
              {t('common.discard')}
            </Button>
          </DisabledActionHint>
          <DisabledActionHint reason={saveReason}>
            <Button
              className="font-bold px-8"
              disabled={saveReason !== null}
              onClick={() => void handleSave()}
            >
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DisabledActionHint>
        </div>
      </CardContent>
    </Card>
  );
}
