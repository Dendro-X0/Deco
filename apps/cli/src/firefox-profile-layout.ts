import { access, readdir } from 'node:fs/promises';
import path from 'node:path';

export type FirefoxLayoutCheck = {
  readonly warnings: string[];
  readonly errors: string[];
};

async function isDirectory(p: string): Promise<boolean> {
  try {
    const { stat } = await import('node:fs/promises');
    const info = await stat(p);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function isFile(p: string): Promise<boolean> {
  try {
    await access(p);
    const { stat } = await import('node:fs/promises');
    const info = await stat(p);
    return info.isFile();
  } catch {
    return false;
  }
}

export async function validateFirefoxProfileLayout(source: string): Promise<FirefoxLayoutCheck> {
  const warnings = [
    'Quit Firefox completely (Task Manager + tray) before Run migration.',
  ];
  const errors: string[] = [];

  if (!(await isDirectory(source))) {
    errors.push(`Firefox profile root is not a directory: ${source}`);
    return { warnings, errors };
  }

  const profilesIni = path.join(source, 'profiles.ini');
  if (!(await isFile(profilesIni))) {
    errors.push(
      `Firefox profiles.ini not found at ${profilesIni}. Select the full %APPDATA%\\Mozilla\\Firefox folder, not a single profile subfolder.`,
    );
    return { warnings, errors };
  }

  const profilesDir = path.join(source, 'Profiles');
  if (await isDirectory(profilesDir)) {
    const entries = await readdir(profilesDir, { withFileTypes: true });
    const profileCount = entries.filter((e) => e.isDirectory()).length;
    if (profileCount === 0) {
      warnings.push(
        'Profiles folder exists but contains no profile directories — verify this is your active Firefox data before Run.',
      );
    } else {
      warnings.push(
        `Found ${profileCount} profile folder(s) under Profiles/. Junction migration moves the entire Mozilla\\Firefox tree.`,
      );
    }
  } else {
    warnings.push(
      'Profiles subdirectory not found. Portable or custom installs may use a different layout — open profiles.ini and confirm paths before Run.',
    );
  }

  return { warnings, errors };
}
