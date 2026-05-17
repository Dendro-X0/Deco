import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
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
import { ScanTargetsPanel } from '@/components/ScanTargetsPanel';
import type { ScanMode } from '@/components/ScanModeSelector';
import {
  clampMaxDepth,
  clampStaleDays,
  cloneSettingsDraft,
  isSettingsDraftDirty,
  patchSettingsDraft,
} from '@/lib/settings-draft';
import { DisabledActionHint } from '@/components/DisabledActionHint';
import {
  settingsDiscardDisabledReason,
  settingsSaveDisabledReason,
} from '@/lib/disabled-reasons';
import { normalizeSettings } from '@/lib/settings-normalize';
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

export function SettingsPanel({ settings, scanning, onSave, onDiscard, onError }: Props) {
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

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

  const scanMode: ScanMode = draft?.use_custom_scan_roots ? 'custom' : 'partition';

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
      const payload = normalizeSettings({
        ...draft,
        stale_days: clampStaleDays(draft.stale_days),
        max_depth: clampMaxDepth(draft.max_depth),
      });
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

  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Global Configuration</CardTitle>
          <CardDescription>
            Scan targets, safety profile, and discovery options. Changes apply after you save.
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
          title="Where to scan"
          description="Choose partition-based scanning or pick specific folders. Only the active mode is shown below."
        >
          <ScanTargetsPanel
            layout="exclusive"
            mode={scanMode}
            onModeChange={(mode) =>
              patch({ use_custom_scan_roots: mode === 'custom' })
            }
            selectedVolumes={draft.selected_volumes ?? []}
            includeProjectFolders={draft.include_project_folders ?? true}
            customScanRoots={draft.roots ?? []}
            onSelectedVolumesChange={(mounts) => patch({ selected_volumes: mounts })}
            onIncludeProjectFoldersChange={(value) =>
              patch({ include_project_folders: value })
            }
            onCustomScanRootsChange={(roots) => patch({ roots })}
            disabled={scanning || saving}
            onError={onError}
          />
        </SettingsSection>

        <Separator />

        <SettingsSection
          title="Scan behavior"
          description={
            scanMode === 'partition'
              ? 'Profile and thresholds apply to every scan. Scan scope is used when suggesting roots on empty drives.'
              : 'Profile and thresholds apply to every scan. Custom-folder mode ignores partition layout.'
          }
        >
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
          </div>
        </SettingsSection>

        <Separator />

        <SettingsSection
          title="Discovery"
          description="Optional targets and performance trade-offs during scans."
        >
          <div className="space-y-2">
            <ToggleRow
              label="Calculate sizes"
              description="Turn off for a faster scan (CLI: --no-size)."
              checked={draft.include_size}
              onCheckedChange={(v) => patch({ include_size: v })}
              disabled={scanning || saving}
            />
            <ToggleRow
              label="Check global Go cache"
              description="Opt-in scan for GOCACHE and GOMODCACHE via go env."
              checked={draft.check_go_cache}
              onCheckedChange={(v) => patch({ check_go_cache: v })}
              disabled={scanning || saving}
            />
            <ToggleRow
              label="Global JVM caches"
              description="~/.m2/repository and ~/.gradle/caches (review tier)."
              checked={draft.check_jvm_global_cache}
              onCheckedChange={(v) => patch({ check_jvm_global_cache: v })}
              disabled={scanning || saving}
            />
            <ToggleRow
              label="Xcode DerivedData"
              description="IDE global cache (review tier; opt-in)."
              checked={draft.check_ide_global_cache}
              onCheckedChange={(v) => patch({ check_ide_global_cache: v })}
              disabled={scanning || saving}
            />
            <ToggleRow
              label="npm cache"
              description="npm cache directory with _cacache (regenerate: npm cache clean)."
              checked={draft.check_npm_cache}
              onCheckedChange={(v) => patch({ check_npm_cache: v })}
              disabled={scanning || saving}
            />
            <ToggleRow
              label="pnpm store"
              description="pnpm content store (v3); respects PNPM_STORE_PATH / pnpm store path."
              checked={draft.check_pnpm_store}
              onCheckedChange={(v) => patch({ check_pnpm_store: v })}
              disabled={scanning || saving}
            />
            <ToggleRow
              label="Yarn cache"
              description="Yarn Classic (v6) or Berry global cache; uses yarn cache dir when available."
              checked={draft.check_yarn_cache}
              onCheckedChange={(v) => patch({ check_yarn_cache: v })}
              disabled={scanning || saving}
            />
            <ToggleRow
              label="pip cache"
              description="pip download cache (wheels/http); regen with pip cache purge."
              checked={draft.check_pip_cache}
              onCheckedChange={(v) => patch({ check_pip_cache: v })}
              disabled={scanning || saving}
            />
            <ToggleRow
              label="uv cache"
              description="uv package cache; respects UV_CACHE_DIR / uv cache dir."
              checked={draft.check_uv_cache}
              onCheckedChange={(v) => patch({ check_uv_cache: v })}
              disabled={scanning || saving}
            />
            <ToggleRow
              label="Conda pkgs cache"
              description="Conda/Miniconda package cache (pkgs only; never envs/). Regenerate: conda clean."
              checked={draft.check_conda_pkgs_cache}
              onCheckedChange={(v) => patch({ check_conda_pkgs_cache: v })}
              disabled={scanning || saving}
            />
            <ToggleRow
              label="Include Python venv"
              description="venv / .venv when a Python project is detected (high risk)."
              checked={draft.include_python_venv}
              onCheckedChange={(v) => patch({ include_python_venv: v })}
              disabled={scanning || saving}
            />
          </div>
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
              Quarantine never copies to another drive (avoids “not enough space” when E: is full).
            </p>
          </div>
          <ToggleRow
            label="Advanced mode"
            description="Enables hard-delete and experimental classifiers."
            checked={draft.advanced_mode}
            onCheckedChange={(v) => patch({ advanced_mode: v })}
            disabled={scanning || saving}
          />
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
