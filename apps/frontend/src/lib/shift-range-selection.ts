/** Shift+click range selection for ordered lists (file-explorer style). */
export function shiftRangeSelection<T extends string>(params: {
  orderedIds: readonly T[];
  targetId: T;
  shiftKey: boolean;
  anchorId: T | null;
  selected: ReadonlySet<T>;
  /** Checked state to apply to the range (and target) on shift+click. */
  targetChecked: boolean;
}): { next: Set<T>; anchorId: T } {
  const { orderedIds, targetId, shiftKey, anchorId, selected, targetChecked } = params;
  const targetIndex = orderedIds.indexOf(targetId);
  if (targetIndex < 0) {
    return { next: new Set(selected), anchorId: targetId };
  }

  if (!shiftKey || anchorId === null) {
    const next = new Set(selected);
    if (targetChecked) next.add(targetId);
    else next.delete(targetId);
    return { next, anchorId: targetId };
  }

  const anchorIndex = orderedIds.indexOf(anchorId);
  if (anchorIndex < 0) {
    const next = new Set(selected);
    if (targetChecked) next.add(targetId);
    else next.delete(targetId);
    return { next, anchorId: targetId };
  }

  const lo = Math.min(anchorIndex, targetIndex);
  const hi = Math.max(anchorIndex, targetIndex);
  const next = new Set(selected);
  for (let i = lo; i <= hi; i += 1) {
    const id = orderedIds[i];
    if (targetChecked) next.add(id);
    else next.delete(id);
  }
  return { next, anchorId: targetId };
}
