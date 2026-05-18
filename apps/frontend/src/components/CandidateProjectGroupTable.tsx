import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { compactListPath, formatCandidateSize, formatBytes } from '@/lib/format';
import type { ProjectGroup } from '@/lib/project-grouping';
import { groupSelectionState, toggleGroupSelection } from '@/lib/project-grouping';
import type { Candidate } from '@/types';
import { cn } from '@/lib/utils';

type Props = {
  groups: ProjectGroup[];
  selectedIds: Set<string>;
  expandedGroupKeys: Set<string>;
  selectedCandidateId: string | null;
  scanning: boolean;
  onToggleGroupExpanded: (groupKey: string) => void;
  onSetSelectedIds: (ids: Set<string>) => void;
  onToggleCandidate: (id: string) => void;
  onSelectCandidate: (id: string) => void;
};

function riskBadgeClass(risk: Candidate['risk']): string {
  if (risk === 'safe') return 'text-primary border-primary/20';
  if (risk === 'review') return 'text-amber-500 border-amber-500/20';
  return 'text-destructive border-destructive/20';
}

const tableClass = 'table-fixed w-full';
const cellPad = 'px-2 py-2.5';

export function CandidateProjectGroupTable({
  groups,
  selectedIds,
  expandedGroupKeys,
  selectedCandidateId,
  scanning,
  onToggleGroupExpanded,
  onSetSelectedIds,
  onToggleCandidate,
  onSelectCandidate,
}: Props) {
  return (
    <Table className={tableClass}>
      <colgroup>
        <col className="w-10" />
        <col className="w-10" />
        <col className="w-[4.5rem]" />
        <col />
        <col className="w-[26%]" />
        <col className="w-[5.5rem]" />
      </colgroup>
      <TableHeader className="bg-muted/30">
        <TableRow>
          <TableHead className={cn(cellPad, 'w-10')} />
          <TableHead className={cn(cellPad, 'w-10 text-center')} />
          <TableHead className={cn(cellPad, 'w-[4.5rem]')}>Risk</TableHead>
          <TableHead className={cellPad}>Project</TableHead>
          <TableHead className={cellPad}>Artifacts</TableHead>
          <TableHead className={cn(cellPad, 'text-right whitespace-nowrap')}>Total size</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const expanded = expandedGroupKeys.has(group.key);
          const selection = groupSelectionState(group, selectedIds);
          const sizeLabel = group.hasUnknownSize
            ? `${formatBytes(group.totalBytes)}+`
            : formatBytes(group.totalBytes);

          return (
            <ProjectGroupRows
              key={group.key}
              group={group}
              expanded={expanded}
              selection={selection}
              sizeLabel={sizeLabel}
              selectedIds={selectedIds}
              selectedCandidateId={selectedCandidateId}
              scanning={scanning}
              onToggleExpand={() => onToggleGroupExpanded(group.key)}
              onToggleGroupSelect={(checked) => {
                onSetSelectedIds(toggleGroupSelection(group, selectedIds, checked === true));
              }}
              onToggleCandidate={onToggleCandidate}
              onSelectCandidate={onSelectCandidate}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

function ProjectGroupRows({
  group,
  expanded,
  selection,
  sizeLabel,
  selectedIds,
  selectedCandidateId,
  scanning,
  onToggleExpand,
  onToggleGroupSelect,
  onToggleCandidate,
  onSelectCandidate,
}: {
  group: ProjectGroup;
  expanded: boolean;
  selection: 'all' | 'some' | 'none';
  sizeLabel: string;
  selectedIds: Set<string>;
  selectedCandidateId: string | null;
  scanning: boolean;
  onToggleExpand: () => void;
  onToggleGroupSelect: (checked: boolean | string) => void;
  onToggleCandidate: (id: string) => void;
  onSelectCandidate: (id: string) => void;
}) {
  return (
    <>
      <TableRow
        className="bg-muted/10 hover:bg-muted/20 cursor-pointer"
        onClick={onToggleExpand}
      >
        <TableCell className={cn(cellPad, 'w-10')} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse project' : 'Expand project'}
            onClick={onToggleExpand}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </TableCell>
        <TableCell className={cn(cellPad, 'text-center')} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={
              selection === 'all' ? true : selection === 'some' ? 'indeterminate' : false
            }
            disabled={group.selectableCount === 0}
            onCheckedChange={() => onToggleGroupSelect(selection !== 'all')}
          />
        </TableCell>
        <TableCell className={cellPad}>
          <Badge variant="outline" className={cn('font-semibold', riskBadgeClass(group.worstRisk))}>
            {group.worstRisk}
          </Badge>
        </TableCell>
        <TableCell className={cn(cellPad, 'min-w-0 max-w-0')}>
          <span
            className="block truncate font-mono text-[11px] font-medium"
            title={group.projectRoot}
          >
            {compactListPath(group.projectRoot)}
          </span>
        </TableCell>
        <TableCell className={cn(cellPad, 'min-w-0 max-w-0')}>
          <span className="block truncate text-[11px] text-muted-foreground" title={group.kindSummary}>
            <span className="font-semibold text-foreground tabular-nums">{group.candidates.length}</span>
            {' · '}
            {group.kindSummary}
          </span>
        </TableCell>
        <TableCell className={cn(cellPad, 'text-right font-semibold tabular-nums text-[11px] whitespace-nowrap')}>
          {sizeLabel}
        </TableCell>
      </TableRow>
      {expanded
        ? group.candidates.map((c) => (
            <TableRow
              key={c.id}
              className={cn(
                'cursor-pointer hover:bg-muted/15',
                selectedCandidateId === c.id && 'bg-primary/5 border-l-2 border-l-primary',
              )}
              onClick={() => onSelectCandidate(c.id)}
            >
              <TableCell className={cellPad} />
              <TableCell className={cn(cellPad, 'text-center')} onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(c.id)}
                  disabled={c.risk === 'blocked'}
                  onCheckedChange={() => onToggleCandidate(c.id)}
                />
              </TableCell>
              <TableCell className={cellPad}>
                <Badge variant="outline" className={cn('font-semibold text-[10px]', riskBadgeClass(c.risk))}>
                  {c.risk}
                </Badge>
              </TableCell>
              <TableCell className={cn(cellPad, 'min-w-0 max-w-0 pl-4')}>
                <span
                  className="block truncate font-mono text-[10px] text-muted-foreground"
                  title={c.abs_path}
                >
                  {compactListPath(c.abs_path, 48)}
                </span>
              </TableCell>
              <TableCell className={cn(cellPad, 'min-w-0 max-w-0')}>
                <span className="block truncate font-mono text-[10px] uppercase tracking-tighter opacity-70">
                  {c.kind}
                </span>
              </TableCell>
              <TableCell className={cn(cellPad, 'text-right text-[11px] whitespace-nowrap')}>
                <span
                  className={
                    c.size_bytes !== undefined && !Number.isNaN(c.size_bytes)
                      ? 'font-semibold tabular-nums'
                      : 'text-muted-foreground'
                  }
                >
                  {formatCandidateSize(c.size_bytes, scanning)}
                </span>
              </TableCell>
            </TableRow>
          ))
        : null}
    </>
  );
}
