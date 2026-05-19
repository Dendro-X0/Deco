import type { MessageTree } from './catalog';

/** Collect dot-separated leaf keys from a message tree. */
export function collectMessageKeys(tree: MessageTree, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [part, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${part}` : part;
    if (typeof value === 'string') keys.push(path);
    else keys.push(...collectMessageKeys(value, path));
  }
  return keys.sort();
}

/** Keys present in `a` but missing in `b`. */
export function missingMessageKeys(a: MessageTree, b: MessageTree): string[] {
  const aKeys = new Set(collectMessageKeys(a));
  const bKeys = new Set(collectMessageKeys(b));
  return [...aKeys].filter((k) => !bKeys.has(k)).sort();
}
