/** Short unique id with a readable prefix. Uses the platform UUID when available. */
export function uid(prefix: string): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const random = c?.randomUUID
    ? c.randomUUID().replace(/-/g, "").slice(0, 12)
    : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return `${prefix}_${random}`;
}
