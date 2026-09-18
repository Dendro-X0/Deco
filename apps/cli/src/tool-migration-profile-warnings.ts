import type { MigrateToolId } from './tool-migration-profiles.js';

/** Profile-specific Plan warnings (launcher scope, not game libraries). */
export function toolMigrationProfileWarnings(id: MigrateToolId): readonly string[] {
  switch (id) {
    case 'epic-games':
      return [
        'Launcher data only: migrates %LOCALAPPDATA%\\EpicGamesLauncher. Game installs may live on other drives — change install location in Epic Games settings if needed.',
      ];
    case 'steam-appdata':
      return [
        'LocalAppData\\Steam cache only — not your Steam library (steamapps). Set library folders in Steam → Settings → Storage.',
      ];
    case 'battle-net':
      return [
        'Launcher LocalAppData only — game files may be on other drives. This profile does not move Blizzard game installs.',
      ];
    case 'firefox':
      return [
        'Migrates the full %APPDATA%\\Mozilla\\Firefox folder (profiles.ini + Profiles). Quit Firefox before Run.',
      ];
    case 'google-chrome':
      return [
        'Migrates %LOCALAPPDATA%\\Google\\Chrome\\User Data (profiles, cache, extensions). Quit Chrome completely (Task Manager + tray) before Run — large trees often take several GB and need free space on both C: (during swap) and the destination.',
      ];
    default:
      return [];
  }
}
