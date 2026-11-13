export type Toast = { id: number; message: string; tone: "info" | "error"; action?: { label: string; run: () => void } };

let toasts: Toast[] = [];
let counter = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function getToasts(): Toast[] {
  return toasts;
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string, options: { action?: Toast["action"]; tone?: Toast["tone"]; ms?: number } = {}): void {
  counter += 1;
  const id = counter;
  toasts = [...toasts.slice(-2), { id, message, tone: options.tone ?? "info", action: options.action }];
  emit();
  setTimeout(() => dismissToast(id), options.ms ?? (options.action ? 6000 : 3000));
}
