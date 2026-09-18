import { describe, expect, it } from 'vitest';
import { toolMigrationProfileWarnings } from '../src/tool-migration-profile-warnings.js';

describe('tool-migration-profile-warnings', () => {
  it('includes launcher scope warning for epic-games', () => {
    const warnings = toolMigrationProfileWarnings('epic-games');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('EpicGamesLauncher');
    expect(warnings[0]).toContain('Game installs');
  });

  it('includes launcher scope warnings for game profiles', () => {
    expect(toolMigrationProfileWarnings('steam-appdata')[0]).toContain('steamapps');
    expect(toolMigrationProfileWarnings('battle-net')[0]).toContain('game files');
  });

  it('includes Chrome User Data quit/size guidance', () => {
    const warnings = toolMigrationProfileWarnings('google-chrome');
    expect(warnings[0]).toContain('Chrome');
    expect(warnings[0]).toContain('User Data');
  });

  it('returns empty for profiles without extra warnings', () => {
    expect(toolMigrationProfileWarnings('vscode')).toEqual([]);
  });
});
