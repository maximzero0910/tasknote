import { addDays, isValidISO, isValidTime, todayISO } from "./dates.ts";
import { defaultPrefs, emptyData } from "./ops.ts";
import {
  INBOX_ID,
  PROJECT_COLORS,
  type AppData,
  type CompletionRecord,
  type Label,
  type Preferences,
  type Priority,
  type Project,
  type Recurrence,
  type SavedFilter,
  type Section,
  type Task,
  type View,
} from "./types.ts";

export const BACKUP_FORMAT = "fieldnote-backup";
export const BACKUP_VERSION = 2;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const color = (v: unknown, fallback: string): string =>
  typeof v === "string" && (PROJECT_COLORS as readonly string[]).includes(v) ? v : fallback;

function recurrence(v: unknown): Recurrence | null {
  if (!isRec(v)) return null;
  const unit = v.unit;
  if (unit !== "day" && unit !== "week" && unit !== "month" && unit !== "year") return null;
  const every = Math.max(1, Math.min(999, Math.floor(num(v.every, 1))));
  const weekdays = arr(v.weekdays).filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6);
  return {
    every,
    unit,
    ...(weekdays.length ? { weekdays: [...new Set(weekdays)] } : {}),
    from: v.from === "complete" ? "complete" : "due",
  };
}

/**
 * Turns untrusted data (old storage, an imported file) into a valid AppData:
 * drops malformed rows, repairs dangling references and guarantees an Inbox.
 */
export function normalizeData(raw: unknown): AppData {
  const base = emptyData();
  if (!isRec(raw)) return base;

  const projects: Project[] = [];
  const seen = new Set<string>();
  for (const item of arr(raw.projects)) {
    if (!isRec(item) || typeof item.id !== "string" || seen.has(item.id)) continue;
    seen.add(item.id);
    const inbox = item.id === INBOX_ID;
    projects.push({
      id: item.id,
      name: str(item.name, inbox ? "Inbox" : "Untitled").trim() || "Untitled",
      color: color(item.color, "clay"),
      favorite: item.favorite === true,
      archived: inbox ? false : item.archived === true,
      inbox,
      order: num(item.order, projects.length),
      layout: item.layout === "board" && !inbox ? "board" : "list",
    });
  }
  if (!seen.has(INBOX_ID)) projects.unshift(base.projects[0]);

  const projectIds = new Set(projects.map((p) => p.id));
  const sections: Section[] = [];
  const sectionIds = new Set<string>();
  for (const item of arr(raw.sections)) {
    if (!isRec(item) || typeof item.id !== "string" || sectionIds.has(item.id)) continue;
    if (typeof item.projectId !== "string" || !projectIds.has(item.projectId) || item.projectId === INBOX_ID) continue;
    sectionIds.add(item.id);
    sections.push({
      id: item.id,
      projectId: item.projectId,
      name: str(item.name, "Section").trim() || "Section",
      order: num(item.order, sections.length),
      collapsed: item.collapsed === true,
    });
  }

  const labels: Label[] = [];
  const labelIds = new Set<string>();
  for (const item of arr(raw.labels)) {
    if (!isRec(item) || typeof item.id !== "string" || labelIds.has(item.id)) continue;
    const name = str(item.name).trim();
    if (!name) continue;
    labelIds.add(item.id);
    labels.push({ id: item.id, name, color: color(item.color, "amber") });
  }

  const filters: SavedFilter[] = [];
  const filterIds = new Set<string>();
  for (const item of arr(raw.filters)) {
    if (!isRec(item) || typeof item.id !== "string" || filterIds.has(item.id)) continue;
    filterIds.add(item.id);
    filters.push({ id: item.id, name: str(item.name, "Filter").trim() || "Filter", query: str(item.query), color: color(item.color, "slate") });
  }

  const tasks: Task[] = [];
  const taskIds = new Set<string>();
  for (const item of arr(raw.tasks)) {
    if (!isRec(item) || typeof item.id !== "string" || taskIds.has(item.id)) continue;
    const content = str(item.content).trim();
    if (!content) continue;
    taskIds.add(item.id);
    const projectId = typeof item.projectId === "string" && projectIds.has(item.projectId) ? item.projectId : INBOX_ID;
    const sec = typeof item.sectionId === "string" ? sections.find((s) => s.id === item.sectionId && s.projectId === projectId) : undefined;
    const due = isValidISO(item.due) ? item.due : null;
    const priority = [1, 2, 3, 4].includes(item.priority as number) ? (item.priority as Priority) : 4;
    tasks.push({
      id: item.id,
      content,
      description: str(item.description),
      projectId,
      sectionId: sec ? sec.id : null,
      parentId: typeof item.parentId === "string" ? item.parentId : null,
      priority,
      labelIds: [...new Set(arr(item.labelIds).filter((l): l is string => typeof l === "string" && labelIds.has(l)))],
      due,
      dueTime: due && isValidTime(item.dueTime) ? item.dueTime : null,
      recurrence: due ? recurrence(item.recurrence) : null,
      completed: item.completed === true,
      completedAt: item.completed === true ? str(item.completedAt, new Date(0).toISOString()) : null,
      createdAt: str(item.createdAt, new Date(0).toISOString()),
      order: num(item.order, tasks.length),
      deletedAt: typeof item.deletedAt === "string" ? item.deletedAt : null,
    });
  }
  // Repair parents: must exist, must not form a cycle, and subtasks follow the parent's project.
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const t of tasks) {
    if (t.parentId && (!byId.has(t.parentId) || t.parentId === t.id)) t.parentId = null;
  }
  for (const t of tasks) {
    const walk = new Set<string>([t.id]);
    let cursor: Task | undefined = t;
    while (cursor?.parentId) {
      if (walk.has(cursor.parentId)) {
        t.parentId = null;
        break;
      }
      walk.add(cursor.parentId);
      cursor = byId.get(cursor.parentId);
    }
  }
  for (const t of tasks) {
    if (t.parentId) {
      const parent = byId.get(t.parentId)!;
      t.projectId = parent.projectId;
      t.sectionId = null;
    }
  }

  const completions: CompletionRecord[] = [];
  for (const item of arr(raw.completions)) {
    if (!isRec(item) || typeof item.id !== "string" || typeof item.at !== "string") continue;
    completions.push({
      id: item.id,
      taskId: str(item.taskId),
      content: str(item.content),
      projectId: typeof item.projectId === "string" && projectIds.has(item.projectId) ? item.projectId : INBOX_ID,
      completedOn: isValidISO(item.completedOn) ? item.completedOn : item.at.slice(0, 10),
      at: item.at,
    });
  }

  const p = isRec(raw.prefs) ? raw.prefs : {};
  const prefs: Preferences = {
    weekStartsOn: p.weekStartsOn === 0 ? 0 : 1,
    showCompleted: p.showCompleted === true,
    confirmDelete: p.confirmDelete === true,
    theme: p.theme === "light" || p.theme === "dark" ? p.theme : "system",
    reminders: p.reminders === true,
    upcomingDays: Math.max(1, Math.min(60, Math.floor(num(p.upcomingDays, defaultPrefs.upcomingDays)))),
  };
  return { tasks, projects, sections, labels, filters, completions, prefs };
}

export function exportBackup(data: AppData, now = new Date()): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data }, null, 2);
}

export type ImportResult = { ok: true; data: AppData } | { ok: false; error: string };

/** Parses a Fieldnote backup file. Also accepts a bare data object. */
export function parseBackup(text: string): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (!isRec(json)) return { ok: false, error: "That file is not a Fieldnote backup." };
  const body = json.format === BACKUP_FORMAT ? json.data : json;
  if (!isRec(body) || !Array.isArray(body.tasks)) return { ok: false, error: "No tasks found in that file." };
  if (typeof json.version === "number" && json.version > BACKUP_VERSION) {
    return { ok: false, error: "This backup was made by a newer version of Fieldnote." };
  }
  return { ok: true, data: normalizeData(body) };
}

/** Exports the open tasks as CSV for spreadsheets. */
export function tasksToCsv(data: AppData): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const projectName = (id: string) => data.projects.find((p) => p.id === id)?.name ?? "";
  const labelNames = (ids: string[]) => ids.map((id) => data.labels.find((l) => l.id === id)?.name ?? "").filter(Boolean).join(" ");
  const rows = [["Task", "Notes", "Project", "Priority", "Labels", "Due", "Time", "Done"]];
  for (const t of data.tasks.filter((x) => !x.deletedAt)) {
    rows.push([t.content, t.description, projectName(t.projectId), `P${t.priority}`, labelNames(t.labelIds), t.due ?? "", t.dueTime ?? "", t.completed ? "yes" : "no"]);
  }
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}

/** Example content for "Load sample data". */
export function sampleData(now = new Date()): AppData {
  const today = todayISO(now);
  const data = emptyData();
  const at = now.toISOString();
  const mk = (id: string, content: string, extra: Partial<Task>): Task => ({
    id, content, description: "", projectId: INBOX_ID, sectionId: null, parentId: null, priority: 4, labelIds: [],
    due: null, dueTime: null, recurrence: null, completed: false, completedAt: null, createdAt: at, order: 0, deletedAt: null, ...extra,
  });
  data.projects.push(
    { id: "proj_home", name: "Home", color: "moss", favorite: true, archived: false, inbox: false, order: 1, layout: "list" },
    { id: "proj_work", name: "Studio", color: "ink", favorite: true, archived: false, inbox: false, order: 2, layout: "board" },
  );
  data.sections.push(
    { id: "sec_repairs", projectId: "proj_home", name: "Repairs", order: 0, collapsed: false },
    { id: "sec_garden", projectId: "proj_home", name: "Garden", order: 1, collapsed: false },
    { id: "sec_todo", projectId: "proj_work", name: "To do", order: 0, collapsed: false },
    { id: "sec_doing", projectId: "proj_work", name: "Doing", order: 1, collapsed: false },
    { id: "sec_done", projectId: "proj_work", name: "Review", order: 2, collapsed: false },
  );
  data.labels.push(
    { id: "lab_errand", name: "errand", color: "amber" },
    { id: "lab_deep", name: "deep", color: "pine" },
    { id: "lab_wait", name: "waiting", color: "slate" },
  );
  data.filters.push(
    { id: "fil_p1", name: "Important", query: "p1 | overdue", color: "wine" },
    { id: "fil_week", name: "Next 7 days", query: "within:7", color: "moss" },
  );
  data.tasks.push(
    mk("t1", "Sketch the weekly review", { projectId: "proj_work", sectionId: "sec_doing", priority: 2, due: today, labelIds: ["lab_deep"] }),
    mk("t2", "Call the glazier", { projectId: "proj_home", sectionId: "sec_repairs", priority: 1, due: today, dueTime: "09:30", labelIds: ["lab_errand"], description: "Pane in the stairwell. Ask about lead time." }),
    mk("t3", "Order seed packets", { projectId: "proj_home", sectionId: "sec_garden", priority: 3, due: addDays(today, 2), labelIds: ["lab_errand"] }),
    mk("t4", "Write the opening paragraph", { projectId: "proj_work", sectionId: "sec_todo", priority: 2, labelIds: ["lab_deep"] }),
    mk("t5", "Collect three references", { projectId: "proj_work", parentId: "t4" }),
    mk("t6", "Water the rosemary", { projectId: "proj_home", sectionId: "sec_garden", due: addDays(today, 1), recurrence: { every: 2, unit: "day", from: "due" }, order: 1 }),
    mk("t7", "Sort the paper mail", { priority: 3, due: addDays(today, -1) }),
  );
  return data;
}

/** Falls back to Today when the saved view points at something that no longer exists. */
export function sanitizeView(view: unknown, data: AppData): View {
  const fallback: View = { kind: "today" };
  if (typeof view !== "object" || view === null) return fallback;
  const v = view as Record<string, unknown>;
  switch (v.kind) {
    case "inbox":
    case "today":
    case "upcoming":
    case "history":
      return { kind: v.kind };
    case "project":
      return data.projects.some((p) => p.id === v.projectId && !p.archived) ? { kind: "project", projectId: v.projectId as string } : fallback;
    case "label":
      return data.labels.some((l) => l.id === v.labelId) ? { kind: "label", labelId: v.labelId as string } : fallback;
    case "filter":
      return data.filters.some((f) => f.id === v.filterId) ? { kind: "filter", filterId: v.filterId as string } : fallback;
    default:
      return fallback;
  }
}

