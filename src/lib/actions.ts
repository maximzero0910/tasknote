/** UI-level actions: pure ops + store + feedback toasts. */
import { formatLong } from "./dates.ts";
import { parseQuickAdd } from "./parse.ts";
import * as ops from "./ops.ts";
import { getState, mutate } from "./store.ts";
import { toast } from "./toast.ts";
import { PROJECT_COLORS, type AppData } from "./types.ts";

export function snapshot(): AppData {
  const { tasks, projects, sections, labels, filters, completions, prefs } = getState();
  return { tasks, projects, sections, labels, filters, completions, prefs };
}

/** Runs a change and offers Undo. Undo restores the snapshot if nothing else changed meanwhile. */
function undoable(message: string, change: (d: AppData) => AppData, inverse: (d: AppData) => AppData): void {
  const before = snapshot();
  mutate(change);
  const after = getState().tasks;
  toast(message, {
    action: {
      label: "Undo",
      run: () => (getState().tasks === after ? mutate(() => before) : mutate(inverse)),
    },
  });
}

export type QuickContext = { projectId: string; sectionId?: string | null; parentId?: string | null };

/** Parses a quick-add line and creates the task. Returns the new id, or null (after toasting why). */
export function quickAdd(raw: string, ctx: QuickContext): string | null {
  const parsed = parseQuickAdd(raw);
  if (!parsed.content) {
    toast("Write the task title before the date and tags.", { tone: "error" });
    return null;
  }
  const state = getState();
  let projectId = ctx.projectId;
  let sectionId = ctx.sectionId ?? null;
  if (parsed.projectName && !ctx.parentId) {
    const needle = parsed.projectName.toLowerCase();
    const found = state.projects.find((p) => p.name.toLowerCase() === needle && !p.archived);
    if (!found) {
      toast(`No project named “${parsed.projectName}”.`, { tone: "error" });
      return null;
    }
    if (found.id !== projectId) sectionId = null;
    projectId = found.id;
  }
  let createdId: string | null = null;
  mutate((d) => {
    let data = d;
    const labelIds: string[] = [];
    for (const name of parsed.labelNames) {
      const r = ops.addLabel(data, name, PROJECT_COLORS[(data.labels.length + 1) % PROJECT_COLORS.length]);
      data = r.data;
      if (r.id) labelIds.push(r.id);
    }
    const r = ops.addTask(data, {
      content: parsed.content, projectId, sectionId, parentId: ctx.parentId ?? null, priority: parsed.priority,
      labelIds, due: parsed.due, dueTime: parsed.dueTime, recurrence: parsed.recurrence,
    });
    createdId = r.id;
    return r.data;
  });
  return createdId;
}

export function completeTask(id: string): void {
  const task = getState().tasks.find((t) => t.id === id);
  if (!task) return;
  const repeats = !!task.recurrence;
  undoable(
    repeats ? "Done. Rescheduled to the next date." : "Completed",
    (d) => ops.completeTask(d, id),
    (d) => ops.uncompleteTask(d, id),
  );
  if (repeats) {
    const next = getState().tasks.find((t) => t.id === id)?.due;
    if (next) toast(`Next: ${formatLong(next)}`, { ms: 2500 });
  }
}

export function reopenTask(id: string): void {
  mutate((d) => ops.uncompleteTask(d, id));
}

export function removeTask(id: string): void {
  const task = getState().tasks.find((t) => t.id === id);
  if (!task) return;
  if (getState().prefs.confirmDelete && typeof window !== "undefined" && !window.confirm(`Delete “${task.content}”?`)) return;
  undoable("Moved to trash", (d) => ops.deleteTask(d, id), (d) => ops.restoreTask(d, id));
}

export function duplicateTask(id: string): string | null {
  let created: string | null = null;
  mutate((d) => {
    const r = ops.duplicateTask(d, id);
    created = r.id;
    return r.data;
  });
  if (created) toast("Duplicated");
  return created;
}
