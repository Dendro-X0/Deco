import { describe, expect, it } from 'vitest';
import {
  cleanSelectedDisabledReason,
  settingsSaveDisabledReason,
} from '../../frontend/src/lib/disabled-reasons';

describe('disabled-reasons', () => {
  it('explains clean selected when nothing picked', () => {
    expect(
      cleanSelectedDisabledReason({
        selectedCount: 0,
        scanning: false,
        busy: false,
        hasScanResults: true,
      }),
    ).toMatch(/Select one or more/);
  });

  it('explains clean selected before scan', () => {
    expect(
      cleanSelectedDisabledReason({
        selectedCount: 0,
        scanning: false,
        busy: false,
        hasScanResults: false,
      }),
    ).toMatch(/Run a scan first/);
  });

  it('save disabled when not dirty', () => {
    expect(
      settingsSaveDisabledReason({ dirty: false, saving: false, scanning: false }),
    ).toMatch(/No changes/);
  });
});
