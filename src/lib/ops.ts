/**
 * Pure state transitions. Every function takes the current AppData and returns
 * a new one, so the logic is testable without a DOM or a store.
 */
import { nextDueDate, todayISO } from "./dates.ts";
import { uid } from "./ids.ts";
import {
  INBOX_ID,
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
} from "./types.ts";

export type TaskDraft = {
  content: string;
  description?: string;
  projectId?: string;
  sectionId?: string | null;
  parentId?: string | null;
  priority?: Priority;
  labelIds?: string[];
  due?: string | null;
  dueTime?: string | null;
  recurrence?: Recurrence | null;
};

export const MAX_COMPLETIONS = 500;

export const defaultPrefs: Preferences = {
  weekStartsOn: 1,
  showCompleted: false,
  confirmDelete: false,
  theme: "system",
  reminders: false,
  upcomingDays: 7,
};

export function emptyData(): AppData {
  return {
    tasks: [],
    projects: [
      {
        id: INBOX_ID, name: "Inbox", color: "terracotta", favorite: false, archived: false,
        inbox: true, order: 0, layout: "list",
      },
    ],
    sections: [],
    labels: [],
    filters: [],
    completions: [],
    prefs: { ...defaultPrefs },
  };
}

/* ---------- helpers ---------- */

export function descendantIds(tasks: Task[], id: string): Set<string> {
  const ids = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of tasks) {
      if (t.parentId && (t.parentId === id || ids.has(t.parentId)) && !ids.has(t.id)) {
        ids.add(t.id);
        grew = true;
      }
    }
  }
  return ids;
}

function nextOrder(tasks: Task[], projectId: string, sectionId: string | null, parentId: string | null): number {
  return (
    tasks
      .filter((t) => !t.deletedAt && t.projectId === projectId && t.sectionId === sectionId && t.parentId === parentId)
      .reduce((max, t) => Math.max(max, t.order), -1) + 1
  );
}

function mapTask(data: AppData, id: string, fn: (t: Task) => Task): AppData {
  return { ...data, tasks: data.tasks.map((t) => (t.id === id ? fn(t) : t)) };
}

/* ---------- tasks ---------- */

export function addTask(data: AppData, draft: TaskDraft, id = uid("task"), now = new Date()): { data: AppData; id: string | null } {
  const content = draft.content.trim();
  if (!content) return { data, id: null };
  const parent = draft.parentId ? data.tasks.find((t) => t.id === draft.parentId && !t.deletedAt) : undefined;
  const projectId = parent ? parent.projectId : data.projects.some((p) => p.id === draft.projectId) ? draft.projectId! : INBOX_ID;
  const sectionId = parent ? null : data.sections.some((s) => s.id === draft.sectionId && s.projectId === projectId) ? draft.sectionId! : null;
  const parentId = parent ? parent.id : null;
  const task: Task = {
    id,
    content,
    description: draft.description?.trim() ?? "",
    projectId,
    sectionId,
    parentId,
    priority: draft.priority ?? 4,
    labelIds: [...new Set(draft.labelIds ?? [])],
    due: draft.due ?? null,
    dueTime: draft.due ? (draft.dueTime ?? null) : null,
    recurrence: draft.due ? (draft.recurrence ?? null) : null,
    completed: false,
    completedAt: null,
    createdAt: now.toISOString(),
    order: nextOrder(data.tasks, projectId, sectionId, parentId),
    deletedAt: null,
  };
  return { data: { ...data, tasks: [...data.tasks, task] }, id };
}

export function updateTask(data: AppData, id: string, patch: Partial<Task>): AppData {
  const { id: _ignored, projectId: _p, sectionId: _s, parentId: _pa, ...safe } = patch;
  void _ignored; void _p; void _s; void _pa;
  return mapTask(data, id, (t) => {
    const next = { ...t, ...safe };
    if (!next.due) {
      next.dueTime = null;
      next.recurrence = null;
    }
    return next;
  });
}

/** Moves a task (and its subtasks) to another project, optionally into a section. */
export function moveTaskToProject(data: AppData, id: string, projectId: string, sectionId: string | null = null): AppData {
  if (!data.projects.some((p) => p.id === projectId)) return data;
  const target = data.tasks.find((t) => t.id === id);
  if (!target) return data;
  const section = data.sections.find((s) => s.id === sectionId && s.projectId === projectId);
  const subs = descendantIds(data.tasks, id);
  const order = nextOrder(data.tasks, projectId, section ? section.id : null, null);
  return {
    ...data,
    tasks: data.tasks.map((t) => {
      if (t.id === id) return { ...t, projectId, sectionId: section ? section.id : null, parentId: null, order };
      if (subs.has(t.id)) return { ...t, projectId, sectionId: null };
      return t;
    }),
  };
}

export function moveTaskToSection(data: AppData, id: string, sectionId: string | null): AppData {
  const t = data.tasks.find((x) => x.id === id);
  if (!t || t.parentId) return data;
  const section = data.sections.find((s) => s.id === sectionId && s.projectId === t.projectId);
  const target = section ? section.id : null;
  const order = nextOrder(data.tasks, t.projectId, target, null);
  return mapTask(data, id, (x) => ({ ...x, sectionId: target, order }));
}

export function completeTask(data: AppData, id: string, now = new Date()): AppData {
  const today = todayISO(now);
  const target = data.tasks.find((t) => t.id === id);
  if (!target || target.deletedAt || target.completed) return data;
  const at = now.toISOString();
  const record = (t: Task): CompletionRecord => ({
    id: uid("done"), taskId: t.id, content: t.content, projectId: t.projectId, completedOn: today, at,
  });
  const subs = descendantIds(data.tasks, id);

  if (target.recurrence) {
    // A repeating task stays open with its next date; its subtasks reset.
    const anchor = target.recurrence.from === "complete" ? today : (target.due ?? today);
    const due = nextDueDate(target.recurrence, anchor, today);
    return {
      ...data,
      completions: [record(target), ...data.completions].slice(0, MAX_COMPLETIONS),
      tasks: data.tasks.map((t) => {
        if (t.id === id) return { ...t, due };
        if (subs.has(t.id)) return { ...t, completed: false, completedAt: null };
        return t;
      }),
    };
  }

  const open = data.tasks.filter((t) => subs.has(t.id) && !t.completed && !t.deletedAt);
  return {
    ...data,
    completions: [record(target), ...open.map(record), ...data.completions].slice(0, MAX_COMPLETIONS),
    tasks: data.tasks.map((t) => (t.id === id || open.some((o) => o.id === t.id) ? { ...t, completed: true, completedAt: at } : t)),
  };
}

/** Reopens a task and any completed ancestors, and drops its latest history entry. */
export function uncompleteTask(data: AppData, id: string): AppData {
  const ancestors = new Set<string>([id]);
  let cursor = data.tasks.find((t) => t.id === id);
  while (cursor?.parentId && !ancestors.has(cursor.parentId)) {
    ancestors.add(cursor.parentId);
    cursor = data.tasks.find((t) => t.id === cursor!.parentId);
  }
  const dropIndex = data.completions.findIndex((c) => c.taskId === id);
  return {
    ...data,
    completions: dropIndex < 0 ? data.completions : data.completions.filter((_, i) => i !== dropIndex),
    tasks: data.tasks.map((t) => (ancestors.has(t.id) ? { ...t, completed: false, completedAt: null } : t)),
  };
}

export function deleteTask(data: AppData, id: string, now = new Date()): AppData {
  const ids = descendantIds(data.tasks, id);
  ids.add(id);
  const stamp = now.toISOString();
  return { ...data, tasks: data.tasks.map((t) => (ids.has(t.id) && !t.deletedAt ? { ...t, deletedAt: stamp } : t)) };
}

export function restoreTask(data: AppData, id: string): AppData {
  const target = data.tasks.find((t) => t.id === id);
  if (!target?.deletedAt) return data;
  const stamp = target.deletedAt;
  const subs = descendantIds(data.tasks, id);
  const parent = target.parentId ? data.tasks.find((t) => t.id === target.parentId) : undefined;
  return {
    ...data,
    tasks: data.tasks.map((t) => {
      if (t.id === id) return { ...t, deletedAt: null, parentId: parent && !parent.deletedAt ? t.parentId : null };
      if (subs.has(t.id) && t.deletedAt === stamp) return { ...t, deletedAt: null };
      return t;
    }),
  };
}

export function purgeDeleted(data: AppData): AppData {
  return { ...data, tasks: data.tasks.filter((t) => !t.deletedAt) };
}

export function duplicateTask(data: AppData, id: string, now = new Date()): { data: AppData; id: string | null } {
  const source = data.tasks.find((t) => t.id === id && !t.deletedAt);
  if (!source) return { data, id: null };
  const created = addTask(
    data,
    {
      content: source.content, description: source.description, projectId: source.projectId,
      sectionId: source.sectionId, parentId: source.parentId, priority: source.priority,
      labelIds: source.labelIds, due: source.due, dueTime: source.dueTime, recurrence: source.recurrence,
    },
    uid("task"),
    now,
  );
  return created;
}

/** Swaps a task with its previous or next sibling and re-indexes the group. */
export function moveTask(data: AppData, id: string, direction: -1 | 1): AppData {
  const current = data.tasks.find((t) => t.id === id);
  if (!current) return data;
  const siblings = data.tasks
    .filter((t) => !t.deletedAt && t.projectId === current.projectId && t.sectionId === current.sectionId && t.parentId === current.parentId)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  const index = siblings.findIndex((t) => t.id === id);
  const swapIndex = index + direction;
  if (index < 0 || swapIndex < 0 || swapIndex >= siblings.length) return data;
  [siblings[index], siblings[swapIndex]] = [siblings[swapIndex], siblings[index]];
  const orderOf = new Map(siblings.map((t, i) => [t.id, i]));
  return { ...data, tasks: data.tasks.map((t) => (orderOf.has(t.id) ? { ...t, order: orderOf.get(t.id)! } : t)) };
}

/* ---------- projects & sections ---------- */

export function addProject(data: AppData, name: string, color = "clay", id = uid("proj")): { data: AppData; id: string | null } {
  const trimmed = name.trim();
  if (!trimmed) return { data, id: null };
  const order = data.projects.reduce((max, p) => Math.max(max, p.order), 0) + 1;
  const project: Project = { id, name: trimmed, color, favorite: false, archived: false, inbox: false, order, layout: "list" };
  return { data: { ...data, projects: [...data.projects, project] }, id };
}

export function updateProject(data: AppData, id: string, patch: Partial<Project>): AppData {
  const { id: _i, inbox: _in, ...safe } = patch;
  void _i; void _in;
  const inbox = id === INBOX_ID;
  if (inbox) delete safe.archived;
  if (typeof safe.name === "string") {
    safe.name = safe.name.trim();
    if (!safe.name) delete safe.name;
  }
  return { ...data, projects: data.projects.map((p) => (p.id === id ? { ...p, ...safe } : p)) };
}

/** Deleting a project keeps its tasks: they move to the Inbox. */
export function deleteProject(data: AppData, id: string): AppData {
  if (id === INBOX_ID) return data;
  const moving = data.tasks.filter((t) => t.projectId === id && !t.deletedAt && !t.parentId);
  let order = nextOrder(data.tasks, INBOX_ID, null, null);
  const orders = new Map(moving.map((t) => [t.id, order++]));
  return {
    ...data,
    projects: data.projects.filter((p) => p.id !== id),
    sections: data.sections.filter((s) => s.projectId !== id),
    tasks: data.tasks.map((t) => (t.projectId === id ? { ...t, projectId: INBOX_ID, sectionId: null, order: orders.get(t.id) ?? t.order } : t)),
  };
}

export function addSection(data: AppData, projectId: string, name: string, id = uid("sec")): { data: AppData; id: string | null } {
  const trimmed = name.trim();
  if (!trimmed || projectId === INBOX_ID || !data.projects.some((p) => p.id === projectId)) return { data, id: null };
  const order = data.sections.filter((s) => s.projectId === projectId).reduce((max, s) => Math.max(max, s.order), -1) + 1;
  return { data: { ...data, sections: [...data.sections, { id, projectId, name: trimmed, order, collapsed: false }] }, id };
}

export function updateSection(data: AppData, id: string, patch: Partial<Section>): AppData {
  const { id: _i, projectId: _p, ...safe } = patch;
  void _i; void _p;
  if (typeof safe.name === "string") {
    safe.name = safe.name.trim();
    if (!safe.name) delete safe.name;
  }
  return { ...data, sections: data.sections.map((s) => (s.id === id ? { ...s, ...safe } : s)) };
}

export function moveSection(data: AppData, id: string, direction: -1 | 1): AppData {
  const section = data.sections.find((s) => s.id === id);
  if (!section) return data;
  const group = data.sections.filter((s) => s.projectId === section.projectId).sort((a, b) => a.order - b.order);
  const index = group.findIndex((s) => s.id === id);
  const swap = index + direction;
  if (swap < 0 || swap >= group.length) return data;
  [group[index], group[swap]] = [group[swap], group[index]];
  const orderOf = new Map(group.map((s, i) => [s.id, i]));
  return { ...data, sections: data.sections.map((s) => (orderOf.has(s.id) ? { ...s, order: orderOf.get(s.id)! } : s)) };
}

/** Deleting a section keeps its tasks, which fall back to "no section". */
export function deleteSection(data: AppData, id: string): AppData {
  return {
    ...data,
    sections: data.sections.filter((s) => s.id !== id),
    tasks: data.tasks.map((t) => (t.sectionId === id ? { ...t, sectionId: null } : t)),
  };
}

/* ---------- labels & filters ---------- */

export function addLabel(data: AppData, name: string, color = "amber", id = uid("lab")): { data: AppData; id: string } | { data: AppData; id: null } {
  const trimmed = name.trim();
  if (!trimmed) return { data, id: null };
  const existing = data.labels.find((l) => l.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return { data, id: existing.id };
  const label: Label = { id, name: trimmed, color };
  return { data: { ...data, labels: [...data.labels, label] }, id };
}

export function updateLabel(data: AppData, id: string, patch: Partial<Label>): AppData {
  const { id: _i, ...safe } = patch;
  void _i;
  return { ...data, labels: data.labels.map((l) => (l.id === id ? { ...l, ...safe } : l)) };
}

export function deleteLabel(data: AppData, id: string): AppData {
  return {
    ...data,
    labels: data.labels.filter((l) => l.id !== id),
    tasks: data.tasks.map((t) => (t.labelIds.includes(id) ? { ...t, labelIds: t.labelIds.filter((x) => x !== id) } : t)),
  };
}

export function addFilter(data: AppData, name: string, query: string, id = uid("fil")): { data: AppData; id: string } {
  const filter: SavedFilter = { id, name: name.trim() || "Filter", query: query.trim(), color: "slate" };
  return { data: { ...data, filters: [...data.filters, filter] }, id };
}

export function updateFilter(data: AppData, id: string, patch: Partial<SavedFilter>): AppData {
  const { id: _i, ...safe } = patch;
  void _i;
  return { ...data, filters: data.filters.map((f) => (f.id === id ? { ...f, ...safe } : f)) };
}

export function deleteFilter(data: AppData, id: string): AppData {
  return { ...data, filters: data.filters.filter((f) => f.id !== id) };
}

export function clearHistory(data: AppData): AppData {
  return { ...data, completions: [] };
}
