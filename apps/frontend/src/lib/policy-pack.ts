import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export type PolicyPackExample = {
  id: string;
  label: string;
  description: string;
  path: string;
};

export type PolicyPackPreview = {
  ok: boolean;
  configPath: string;
  summary: string;
  targetExisting: boolean;
  existingSummary: string | null;
  diffLines: string[];
  error?: string | null;
};

export type PolicyPackContents = {
  ok: boolean;
  configPath: string;
  summary: string;
  jsonPretty: string;
  error?: string | null;
};

type PolicyPackPreviewWire = {
  ok: boolean;
  configPath: string;
  summary: string;
  targetExisting: boolean;
  existingSummary?: string | null;
  diffLines?: string[];
  error?: string | null;
};

type PolicyPackContentsWire = {
  ok: boolean;
  configPath: string;
  summary: string;
  jsonPretty: string;
  error?: string | null;
};

export async function listPolicyPackExamples(): Promise<PolicyPackExample[]> {
  return (await invoke('list_policy_pack_examples')) as PolicyPackExample[];
}

export async function readPolicyPackContents(source: string): Promise<PolicyPackContents> {
  const wire = (await invoke('read_policy_pack_contents', { source })) as PolicyPackContentsWire;
  return {
    ok: wire.ok,
    configPath: wire.configPath,
    summary: wire.summary,
    jsonPretty: wire.jsonPretty,
    error: wire.error ?? null,
  };
}

export async function previewPolicyPack(
  source: string,
  targetRoot: string,
): Promise<PolicyPackPreview> {
  const wire = (await invoke('preview_policy_pack', {
    source,
    targetRoot,
  })) as PolicyPackPreviewWire;
  return {
    ok: wire.ok,
    configPath: wire.configPath,
    summary: wire.summary,
    targetExisting: wire.targetExisting,
    existingSummary: wire.existingSummary ?? null,
    diffLines: wire.diffLines ?? [],
    error: wire.error ?? null,
  };
}

export async function applyPolicyPack(source: string, targetRoot: string): Promise<string> {
  return (await invoke('apply_policy_pack', { source, targetRoot })) as string;
}

export async function revealPathInExplorer(path: string): Promise<void> {
  await invoke('reveal_path_in_explorer', { path });
}

/** Folder containing a policy pack (or `.deco` layout). */
export async function pickPolicyPackSource(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: 'Select policy pack folder',
  });
  if (result === null) return null;
  const path = String(Array.isArray(result) ? result[0] : result).trim();
  return path || null;
}

/** Project root where `.deco/disk-cleanup.json` will be written. */
export async function pickPolicyPackTarget(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: 'Select project folder for .deco policy',
  });
  if (result === null) return null;
  const path = String(Array.isArray(result) ? result[0] : result).trim();
  return path || null;
}
