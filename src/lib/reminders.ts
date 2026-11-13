import { todayISO } from "./dates.ts";
import type { Task } from "./types.ts";

const fired = new Set<string>();

export function remindersSupported(): boolean {
  return typeof Notification !== "undefined";
}

/** Tasks whose due date and time equal `now` (to the minute) and that have not fired yet. */
export function dueNow(tasks: Task[], now = new Date()): Task[] {
  const key = `${todayISO(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return tasks.filter((t) => {
    if (t.deletedAt || t.completed || !t.due || !t.dueTime || `${t.due} ${t.dueTime}` !== key) return false;
    const marker = `${t.id}:${key}`;
    if (fired.has(marker)) return false;
    fired.add(marker);
    return true;
  });
}

export function showReminder(task: Task): void {
  if (!remindersSupported() || Notification.permission !== "granted") return;
  try {
    new Notification("Fieldnote", { body: task.content, tag: task.id });
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}
