import { describe, expect, it } from 'vitest';
import { shiftRangeSelection } from '../../frontend/src/lib/shift-range-selection';

describe('shiftRangeSelection', () => {
  const ordered = ['a', 'b', 'c', 'd', 'e'] as const;

  it('toggles a single row without shift', () => {
    const { next, anchorId } = shiftRangeSelection({
      orderedIds: ordered,
      targetId: 'c',
      shiftKey: false,
      anchorId: null,
      selected: new Set(['a']),
      targetChecked: true,
    });
    expect([...next].sort()).toEqual(['a', 'c']);
    expect(anchorId).toBe('c');
  });

  it('applies range on shift+click', () => {
    const { next } = shiftRangeSelection({
      orderedIds: ordered,
      targetId: 'd',
      shiftKey: true,
      anchorId: 'b',
      selected: new Set(['b']),
      targetChecked: true,
    });
    expect([...next].sort()).toEqual(['b', 'c', 'd']);
  });

  it('clears a range on shift+click when unchecking', () => {
    const { next } = shiftRangeSelection({
      orderedIds: ordered,
      targetId: 'd',
      shiftKey: true,
      anchorId: 'b',
      selected: new Set(['a', 'b', 'c', 'd', 'e']),
      targetChecked: false,
    });
    expect([...next].sort()).toEqual(['a', 'e']);
  });
});
