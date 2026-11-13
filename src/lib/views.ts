import { addDays } from "./dates.ts";
import { sortTasks, taskMatchesQuery } from "./query.ts";
import { INBOX_ID, type AppData, type SortMode, type Task, type View } from "./types.ts";

/** Tasks a view should list, before grouping. Subtasks are included; the UI nests them. */
export function visibleTasks(data: AppData, view: View, today: string, search = ""): Task[] {
  const archived = new Set(data.projects.filter((p) => p.archived).map((p) => p.id));
  const ctx = { today, projects: data.projects, labels: data.labels };
  let rows = data.tasks.filter((t) => !t.deletedAt);
  if (view.kind !== "project") rows = rows.filter((t) => !archived.has(t.projectId));
  const open = (t: Task) => !t.completed;
  switch (view.kind) {
    case "inbox":
      rows = rows.filter((t) => t.projectId === INBOX_ID);
      break;
    case "today":
      rows = rows.filter((t) => open(t) && t.due !== null && t.due <= today);
      break;
    case "upcoming": {
      const end = addDays(today, data.prefs.upcomingDays);
      rows = rows.filter((t) => open(t) && t.due !== null && t.due <= end);
      break;
    }
    case "project":
      rows = rows.filter((t) => t.projectId === view.projectId);
      break;
    case "label":
      rows = rows.filter((t) => t.labelIds.includes(view.labelId));
      break;
    case "filter": {
      const filter = data.filters.find((f) => f.id === view.filterId);
      rows = rows.filter((t) => (filter ? taskMatchesQuery(t, filter.query, ctx) : false));
      break;
    }
    case "search":
      rows = rows.filter((t) => taskMatchesQuery(t, view.query, ctx));
      break;
    case "history":
      return [];
  }
  if (!data.prefs.showCompleted && view.kind !== "search") rows = rows.filter(open);
  const needle = search.trim().toLowerCase();
  if (needle) rows = rows.filter((t) => `${t.content} ${t.description}`.toLowerCase().includes(needle));
  return rows;
}

export type TaskNode = { task: Task; children: TaskNode[] };

/** Nests subtasks under parents present in the list; orphans (parent not listed) become roots. */
export function buildTree(tasks: Task[], sort: SortMode): TaskNode[] {
  const ordered = sortTasks(tasks, sort);
  const ids = new Set(ordered.map((t) => t.id));
  const kids = new Map<string, Task[]>();
  const roots: Task[] = [];
  for (const t of ordered) {
    if (t.parentId && ids.has(t.parentId)) kids.set(t.parentId, [...(kids.get(t.parentId) ?? []), t]);
    else roots.push(t);
  }
  const make = (t: Task): TaskNode => ({
    task: t,
    children: sortTasks(kids.get(t.id) ?? [], sort === "manual" ? "manual" : sort).map(make),
  });
  return roots.map(make);
}

export function countNodes(nodes: TaskNode[]): number {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0);
}

export type SidebarCounts = { inbox: number; today: number; upcoming: number };

export function sidebarCounts(data: AppData, today: string): SidebarCounts {
  const live = data.tasks.filter((t) => !t.deletedAt && !t.completed);
  const archived = new Set(data.projects.filter((p) => p.archived).map((p) => p.id));
  const shown = live.filter((t) => !archived.has(t.projectId));
  return {
    inbox: live.filter((t) => t.projectId === INBOX_ID && !t.parentId).length,
    today: shown.filter((t) => t.due && t.due <= today).length,
    upcoming: shown.filter((t) => t.due && t.due > today && t.due <= addDays(today, data.prefs.upcomingDays)).length,
  };
}
