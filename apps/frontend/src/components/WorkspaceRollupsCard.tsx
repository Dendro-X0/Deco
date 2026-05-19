import { useMemo, useState } from 'react';
import { FolderTree, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { compactListPath, formatBytes } from '@/lib/format';
import {
  buildWorkspaceRollups,
  reclaimableBytesFromRollups,
  rollupSafeSelectionState,
  toggleRollupSafeSelection,
  WORKSPACE_ROLLUP_TOP_N,
  type WorkspaceRollup,
} from '@/lib/workspace-rollups';
import type { Candidate } from '@/types';

type Props = {
  candidates: Candidate[];
  selectedIds: Set<string>;
  onSetSelectedIds: (ids: Set<string>) => void;
};

function riskPillClass(risk: 'safe' | 'review' | 'blocked'): string {
  if (risk === 'safe') return 'text-primary';
  if (risk === 'review') return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

function RollupRiskMini({ rollup }: { rollup: WorkspaceRollup }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tabular-nums">
      {(['safe', 'review', 'blocked'] as const).map((risk) => {
        const t = rollup.totalsByRisk[risk];
        if (t.count === 0) return null;
        return (
          <span key={risk} className={riskPillClass(risk)}>
            <span className="font-semibold">{t.count}</span> {risk}{' '}
            <span className="text-muted-foreground">
              {t.hasUnknownSize && t.bytes === 0 ? '…' : formatBytes(t.bytes)}
            </span>
          </span>
        );
      })}
    </div>
  );
}


export function WorkspaceRollupsCard({ candidates, selectedIds, onSetSelectedIds }: Props) {
  const [expanded, setExpanded] = useState(false);
  const rollups = useMemo(() => buildWorkspaceRollups(candidates), [candidates]);
  const visible = expanded ? rollups : rollups.slice(0, WORKSPACE_ROLLUP_TOP_N);
  const reclaimable = reclaimableBytesFromRollups(rollups);

  if (rollups.length === 0) return null;

  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <FolderTree size={18} aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">Workspace summary</CardTitle>
            <CardDescription>
              {rollups.length} project{rollups.length === 1 ? '' : 's'} ·{' '}
              {formatBytes(reclaimable)} reclaimable (safe + review) — each folder counted once
            </CardDescription>
          </div>
        </div>
        {rollups.length > WORKSPACE_ROLLUP_TOP_N ? (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1 h-8"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Show less' : `All ${rollups.length}`}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <ScrollArea className={expanded && rollups.length > 8 ? 'h-[min(24rem,50vh)]' : undefined}>
          <div className="space-y-2 pr-3">
            {visible.map((rollup) => {
              const sel = rollupSafeSelectionState(rollup, candidates, selectedIds);
              const hasSafe = rollup.totalsByRisk.safe.count > 0;
              return (
                <div
                  key={rollup.key}
                  className="rounded-lg border border-border/50 bg-muted/15 px-3 py-2.5 space-y-1.5"
                >
                  <div className="flex items-start gap-2">
                    {hasSafe ? (
                      <Checkbox
                        checked={sel === 'all' ? true : sel === 'some' ? 'indeterminate' : false}
                        onCheckedChange={() =>
                          onSetSelectedIds(toggleRollupSafeSelection(rollup, candidates, selectedIds))
                        }
                        aria-label={`Select safe items in ${rollup.projectRoot}`}
                        className="mt-0.5"
                      />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className="text-sm font-semibold truncate"
                          title={rollup.projectRoot}
                        >
                          {compactListPath(rollup.projectRoot, 72)}
                        </p>
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                          {formatBytes(rollup.totalBytes)}
                          {rollup.hasUnknownSize ? '+' : ''}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{rollup.kindSummary}</p>
                      <RollupRiskMini rollup={rollup} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
