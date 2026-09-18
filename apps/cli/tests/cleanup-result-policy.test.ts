import { describe, expect, it } from 'vitest';

/** Mirrors apps/frontend/src/lib/cleanup-result.ts */

const USER_CANCEL_RE = /cleanup canceled by user/i;

function isUserCanceledCleanup(result: { errors?: string[] }): boolean {
  return (result.errors ?? []).some((e) => USER_CANCEL_RE.test(e));
}

function shouldRaiseGlobalCleanupError(result: {
  quarantined_count?: number;
  deleted_count?: number;
  errors?: string[];
}): boolean {
  if (isUserCanceledCleanup(result)) return false;
  const moved = (result.quarantined_count ?? 0) + (result.deleted_count ?? 0);
  return moved === 0 && (result.errors?.length ?? 0) > 0;
}

describe('shouldRaiseGlobalCleanupError', () => {
  it('is false when items were quarantined even if soft errors exist', () => {
    expect(
      shouldRaiseGlobalCleanupError({
        quarantined_count: 3,
        deleted_count: 0,
        errors: ['one locked path'],
      }),
    ).toBe(false);
  });

  it('is true when nothing moved and errors exist', () => {
    expect(
      shouldRaiseGlobalCleanupError({
        quarantined_count: 0,
        deleted_count: 0,
        errors: ['blocked'],
      }),
    ).toBe(true);
  });

  it('is false when nothing moved and the only error is user cancel', () => {
    expect(
      shouldRaiseGlobalCleanupError({
        quarantined_count: 0,
        deleted_count: 0,
        errors: ['Cleanup canceled by user.'],
      }),
    ).toBe(false);
  });

  it('is false when user cancel is accompanied by soft path noise', () => {
    expect(
      shouldRaiseGlobalCleanupError({
        quarantined_count: 0,
        deleted_count: 0,
        errors: ['Cleanup canceled by user.', 'path locked during stop'],
      }),
    ).toBe(false);
  });

  it('is false when partial progress then user cancel', () => {
    expect(
      shouldRaiseGlobalCleanupError({
        quarantined_count: 2,
        deleted_count: 0,
        errors: ['Cleanup canceled by user.'],
      }),
    ).toBe(false);
  });
});

describe('isUserCanceledCleanup', () => {
  it('matches engine cancel message case-insensitively', () => {
    expect(isUserCanceledCleanup({ errors: ['cleanup CANCELED by user'] })).toBe(true);
    expect(isUserCanceledCleanup({ errors: ['disk full'] })).toBe(false);
    expect(isUserCanceledCleanup({ errors: [] })).toBe(false);
  });
});
