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
  SCAN_STRATEGY_PRESETS,
  applyScanStrategyPreset,
  resolveScanStrategy,
  type ScanStrategyPreset,
} from '@/lib/scan-strategy';
import type { Settings } from '@/types';

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
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-bold tracking-tight">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
        ) : null}
      </div>
      {children}
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

export function SettingsPanel({ settings, scanning, onSave, onDiscard }: Props) {
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
          Loading settings…
        </CardContent>
      </Card>
    );
  }

  const activeStrategy = resolveScanStrategy(draft);
  const activeStrategyMeta = SCAN_STRATEGY_PRESETS.find((p) => p.id === activeStrategy);

  const quarantineEnabled = draft.delete_mode === 'quarantine';
  const quarantineLayout = draft.quarantine_layout ?? 'per_drive';
  const quarantinePath = draft.quarantine_custom_path ?? '';

  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Global Configuration</CardTitle>
          <CardDescription>
            Safety profile, discovery options, and advanced scan behavior. Configure drives and folders on the
            Dashboard. Changes apply after you save.
          </CardDescription>
        </div>
        {dirty ? (
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/90 shrink-0">
            Unsaved changes
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-8">
        <SettingsSection
          title="Scan behavior"
          description={
            scanMode === 'partition'
              ? 'Pick a scan strategy for performance, then profile and thresholds. Scan scope is used when suggesting roots on empty drives.'
              : 'Pick a scan strategy for performance, then profile and thresholds. Custom-folder mode ignores partition layout.'
          }
        >
          <div className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                Scan strategy
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
                      {preset.label}
                    </SelectItem>
                  ))}
                  {activeStrategy === 'custom' ? (
                    <SelectItem value="custom">Custom</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {activeStrategy === 'custom'
                  ? 'Depth, size parallelism, or Quick update no longer match a preset — adjust below or pick a preset.'
                  : (activeStrategyMeta?.description ??
                    'Maps to search depth, size parallelism, and Quick update.')}
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {scanMode === 'partition' ? (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Scan scope
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
                    <SelectItem value="all">All — dev folders + drives (recommended)</SelectItem>
                    <SelectItem value="projects">Projects — profile folders only</SelectItem>
                    <SelectItem value="drives">Drives — partition roots only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                Safety profile
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
                  <SelectItem value="safe">Safe (Conservative)</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="aggressive">Aggressive (Maximum Space)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                Stale threshold (days)
              </label>
              <NumberInput
                min={1}
                max={365}
                step={1}
                value={draft.stale_days}
                disabled={scanning || saving}
                onValueChange={(v) => patch({ stale_days: clampStaleDays(v) })}
                aria-label="Stale threshold in days"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border/40 bg-muted/10 p-4">
            <div>
              <h4 className="text-xs font-bold tracking-tight">Performance tuning</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Adjusting these may switch the strategy to Custom.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Max search depth
                </label>
                <NumberInput
                  min={1}
                  max={32}
                  step={1}
                  value={draft.max_depth}
                  disabled={scanning || saving}
                  onValueChange={(v) => patch({ max_depth: clampMaxDepth(v) })}
                  aria-label="Max search depth"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Parallel workers (discover / size / delete)
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
                    <SelectItem value="auto">Auto — 6 parallel workers (recommended)</SelectItem>
                    <SelectItem value="low">Low — 2 workers (HDD / background)</SelectItem>
                    <SelectItem value="high">High — 8 workers (fast SSD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ToggleRow
              label="Incremental inventory (Quick update)"
              description="Reuse classify and size for unchanged paths. Run a full scan after changing profile or discovery options."
              checked={draft.incremental_inventory_enabled ?? true}
              onCheckedChange={(v) => patch({ incremental_inventory_enabled: v })}
              disabled={scanning || saving}
            />
          </div>
        </SettingsSection>

        <Separator />

        <SettingsSection
          title="Discovery"
          description="Optional artifact targets during scans."
        >
          <DiscoveryOptionsPanel
            settings={draft}
            disabled={scanning || saving}
            onPatch={patch}
          />
        </SettingsSection>

        <Separator />

        <SettingsSection
          title="Safety"
          description="How cleanup frees space. Use Delete when the drive is almost full."
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Delete mode</label>
            <Select
              value={draft.delete_mode === 'quarantine' ? 'quarantine' : 'delete'}
              onValueChange={(v) => patch({ delete_mode: v })}
              disabled={scanning || saving}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delete">
                  Delete in place (recommended) — frees space immediately, no copy
                </SelectItem>
                <SelectItem value="quarantine">
                  Quarantine on same drive — moves to .deco-quarantine, restorable
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Delete in place does not store backups. Use it when cleaning C: or when the disk is almost full.
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
                Fast delete for dependency trees (experimental)
              </label>
              <p className="text-xs text-muted-foreground">
                When deleting in place, removes <code className="text-[0.7rem]">node_modules</code>,{' '}
                <code className="text-[0.7rem]">target</code>, and build folders via system commands (Windows{' '}
                <code className="text-[0.7rem]">rmdir /s /q</code>, Unix <code className="text-[0.7rem]">rm -rf</code>).
                Multiple trees delete in parallel — concurrency follows Scan behavior → Performance (auto / low / high).
                Not used for quarantine.
              </p>
            </div>
          </div>
          <div
            className={`space-y-3 rounded-lg border p-4 ${quarantineEnabled ? 'border-border/60' : 'border-border/30 opacity-60'}`}
          >
            <div>
              <p className="text-sm font-bold">Quarantine storage</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {quarantineStorageSummary(draft.delete_mode, quarantineLayout, quarantinePath)}
              </p>
              {!quarantineEnabled && (
                <p className="text-xs text-amber-600/90 mt-1">
                  Enable by choosing “Quarantine on same drive” above. Payloads are never stored under
                  AppData unless you pick that folder yourself.
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
                <SelectItem value="per_drive">
                  On each source drive — {'{drive}\\.deco-quarantine'} (recommended)
                </SelectItem>
                <SelectItem value="custom">Custom folder — you choose the path</SelectItem>
              </SelectContent>
            </Select>
            {quarantineLayout === 'custom' && quarantineEnabled && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={quarantinePath}
                  onChange={(e) => patch({ quarantine_custom_path: e.target.value })}
                  placeholder="e.g. E:\\DecoQuarantine"
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
                  {pickingQuarantine ? 'Opening…' : 'Browse…'}
                </Button>
              </div>
            )}
            {quarantineEnabled &&
              quarantineLayout === 'custom' &&
              quarantinePath.trim() &&
              isWindowsSystemDrivePath(quarantinePath) && (
                <p className="text-xs text-amber-600/90">
                  This folder is on the system (C:) drive — quarantine will use space on C:.
                </p>
              )}
          </div>
          <ToggleRow
            label="Advanced mode"
            description="Enables hard-delete and experimental classifiers."
            checked={draft.advanced_mode}
            onCheckedChange={(v) => patch({ advanced_mode: v })}
            disabled={scanning || saving}
          />
          {draft.advanced_mode ? (
            <div className="space-y-2 max-w-xs pl-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                Classify parallel threshold
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
                aria-label="Minimum targets before parallel classify"
              />
              <p className="text-xs text-muted-foreground">
                Rayon classify runs when a chunk has at least this many targets (default 8).
              </p>
            </div>
          ) : null}
        </SettingsSection>

        <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-border/40">
          <DisabledActionHint reason={discardReason}>
            <Button variant="ghost" disabled={discardReason !== null} onClick={handleDiscard}>
              Discard changes
            </Button>
          </DisabledActionHint>
          <DisabledActionHint reason={saveReason}>
            <Button
              className="font-bold px-8"
              disabled={saveReason !== null}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DisabledActionHint>
        </div>
      </CardContent>
    </Card>
  );
}
