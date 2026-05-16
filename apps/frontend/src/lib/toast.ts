export type ToastVariant = 'default' | 'info' | 'destructive';

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(items));
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(items);
  return () => listeners.delete(listener);
}

export function toast(input: {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}): string {
  const id = crypto.randomUUID();
  const entry: ToastItem = {
    id,
    title: input.title,
    description: input.description,
    variant: input.variant ?? 'info',
  };
  items = [...items, entry];
  emit();
  const duration = input.durationMs ?? 6000;
  window.setTimeout(() => dismissToast(id), duration);
  return id;
}

export function dismissToast(id: string): void {
  const next = items.filter((t) => t.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}
