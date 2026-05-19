import { useCallback, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  countEnabledInCategory,
  DISCOVERY_CATEGORIES,
  discoveryRowId,
  patchCategorySelection,
  selectableRowIds,
  type DiscoveryCategoryId,
  type DiscoveryOptionKey,
  type DiscoveryRowId,
} from '@/lib/discovery-options';
import { shiftRangeSelection } from '@/lib/shift-range-selection';
import { useI18n } from '@/i18n';
import type { Settings } from '@/types';

type Props = {
  settings: Settings;
  disabled?: boolean;
  onPatch: (patch: Partial<Settings>) => void;
};

function isRowChecked(settings: Settings, rowId: DiscoveryRowId): boolean {
  if (rowId.startsWith('placeholder:')) return false;
  return Boolean(settings[rowId as DiscoveryOptionKey]);
}

function CategoryToolbar({
  catId,
  settings,
  disabled,
  onPatch,
}: {
  catId: DiscoveryCategoryId;
  settings: Settings;
  disabled?: boolean;
  onPatch: (patch: Partial<Settings>) => void;
}) {
  const { t } = useI18n();
  const { enabled, total } = countEnabledInCategory(settings, catId);
  const allOn = total > 0 && enabled === total;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <p className="text-[10px] text-muted-foreground/80">{t('settings.discovery.shiftHint')}</p>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground tabular-nums">
          {t('settings.discovery.enabledCount', { enabled, total })}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 text-xs"
          disabled={disabled || total === 0}
          onClick={() => onPatch(patchCategorySelection(catId, !allOn))}
        >
          {allOn ? t('settings.discovery.clearAll') : t('settings.discovery.selectAll')}
        </Button>
      </div>
    </div>
  );
}

export function DiscoveryOptionsPanel({ settings, disabled, onPatch }: Props) {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState<DiscoveryCategoryId>('general');
  const anchorRef = useRef<DiscoveryRowId | null>(null);

  const orderedIds = useMemo(() => selectableRowIds(activeCategory), [activeCategory]);
  const selectedSet = useMemo(() => {
    const set = new Set<DiscoveryRowId>();
    for (const id of orderedIds) {
      if (isRowChecked(settings, id)) set.add(id);
    }
    return set;
  }, [orderedIds, settings]);

  const applySelection = useCallback(
    (next: Set<DiscoveryRowId>) => {
      const patch: Partial<Settings> = {};
      for (const id of orderedIds) {
        patch[id as DiscoveryOptionKey] = next.has(id);
      }
      onPatch(patch);
    },
    [onPatch, orderedIds],
  );

  const handleRowActivate = useCallback(
    (rowId: DiscoveryRowId, shiftKey: boolean) => {
      if (rowId.startsWith('placeholder:') || disabled) return;
      const targetChecked = !selectedSet.has(rowId);
      const { next, anchorId } = shiftRangeSelection({
        orderedIds,
        targetId: rowId,
        shiftKey,
        anchorId: anchorRef.current,
        selected: selectedSet,
        targetChecked,
      });
      anchorRef.current = anchorId;
      applySelection(next);
    },
    [applySelection, disabled, orderedIds, selectedSet],
  );

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-4">
      <Tabs
        value={activeCategory}
        onValueChange={(v) => {
          setActiveCategory(v as DiscoveryCategoryId);
          anchorRef.current = null;
        }}
      >
        <div className="overflow-x-auto overflow-y-visible deco-scrollbar -mx-1 px-1 pt-2 pb-2">
          <TabsList className="inline-flex h-10 w-max min-w-full justify-start gap-1 bg-muted/40 p-1.5">
            {DISCOVERY_CATEGORIES.map((cat) => {
              const counts = countEnabledInCategory(settings, cat.id);
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  disabled={disabled}
                  className="shrink-0 text-xs sm:text-sm px-3 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:ring-1 data-[state=active]:ring-primary/40"
                >
                  {t(`settings.discovery.categories.${cat.id}.label`)}
                  {counts.total > 0 ? (
                    <span className="ml-1.5 tabular-nums text-[10px] text-muted-foreground">
                      {counts.enabled}/{counts.total}
                    </span>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {DISCOVERY_CATEGORIES.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="mt-3 space-y-3 focus-visible:outline-none">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(`settings.discovery.categories.${cat.id}.description`)}
            </p>
            <CategoryToolbar catId={cat.id} settings={settings} disabled={disabled} onPatch={onPatch} />

            <div className="space-y-2" role="list">
              {cat.rows.map((row) => {
                const rowId = discoveryRowId(row);
                const isPlaceholder = row.type === 'placeholder';
                const checked = isPlaceholder ? false : Boolean(settings[row.key]);

                return (
                  <div
                    key={rowId}
                    role="listitem"
                    tabIndex={isPlaceholder || disabled ? -1 : 0}
                    aria-disabled={isPlaceholder || disabled}
                    onClick={(e) => {
                      if (isPlaceholder || disabled) return;
                      handleRowActivate(rowId, e.shiftKey);
                    }}
                    onKeyDown={(e) => {
                      if (isPlaceholder || disabled) return;
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleRowActivate(rowId, e.shiftKey);
                      }
                    }}
                    className={`flex items-center justify-between gap-4 rounded-lg p-4 transition-colors ${
                      isPlaceholder
                        ? 'bg-muted/10 opacity-55 cursor-default'
                        : disabled
                          ? 'bg-muted/20 opacity-60 cursor-not-allowed'
                          : 'bg-muted/20 cursor-pointer hover:bg-muted/30'
                    } ${!isPlaceholder && checked ? 'ring-1 ring-primary/25' : ''}`}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold">
                          {row.type === 'option'
                            ? t(`settings.discovery.options.${row.key as DiscoveryOptionKey}.label`)
                            : row.label}
                        </p>
                        {isPlaceholder ? (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-semibold">
                            Soon
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {row.type === 'option'
                          ? t(`settings.discovery.options.${row.key as DiscoveryOptionKey}.description`)
                          : row.description}
                      </p>
                    </div>
                    <Checkbox
                      checked={checked}
                      disabled={isPlaceholder || disabled}
                      className="shrink-0 pointer-events-none"
                      aria-hidden={isPlaceholder}
                      tabIndex={-1}
                    />
                  </div>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
