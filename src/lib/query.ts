import { addDays, todayISO } from "./dates.ts";
import type { Label, Priority, Project, SortMode, Task } from "./types.ts";

export type QueryContext = { today: string; projects: Project[]; labels: Label[] };

/**
 * Filter language. Space = AND, `|` or `or` = OR, leading `!` or `-` = NOT.
 *   today  tomorrow  overdue  nodate  recurring  p1..p4  #Project  @label
 *   within:N / next:N   and plain words matched against title and notes.
 * Quote names with spaces: #"Side project".
 */
export function taskMatchesQuery(task: Task, query: string, ctx: QueryContext): boolean {
  const groups = query
    .trim()
    .toLowerCase()
    .replace(/\bno date\b/g, "nodate")
    .split(/\s+(?:\||or)\s+/)
    .map((group) => group.match(/[!-]?[#@]?"[^"]+"|\S+/g) ?? [])
    .filter((tokens) => tokens.length > 0);
  if (groups.length === 0) return true;
  return groups.some((tokens) => tokens.every((raw) => matchToken(task, raw, ctx)));
}

function matchToken(task: Task, raw: string, ctx: QueryContext): boolean {
  let token = raw;
  let negate = false;
  if (token.length > 1 && (token[0] === "!" || token[0] === "-")) {
    negate = true;
    token = token.slice(1);
  }
  token = token.replace(/"/g, "");
  if (!token) return true;
  return matchPositive(task, token, ctx) !== negate;
}

function matchPositive(task: Task, token: string, ctx: QueryContext): boolean {
  if (token === "today") return task.due === ctx.today;
  if (token === "tomorrow") return task.due === addDays(ctx.today, 1);
  if (token === "overdue") return !!task.due && task.due < ctx.today && !task.completed;
  if (token === "nodate") return task.due === null;
  if (token === "recurring") return task.recurrence !== null;
  if (/^p[1-4]$/.test(token)) return task.priority === Number(token[1]);
  if (token.startsWith("#")) {
    const name = token.slice(1);
    const project = ctx.projects.find((p) => p.name.toLowerCase() === name);
    return !!project && task.projectId === project.id;
  }
  if (token.startsWith("@")) {
    const name = token.slice(1);
    const label = ctx.labels.find((l) => l.name.toLowerCase() === name);
    return !!label && task.labelIds.includes(label.id);
  }
  if (token.startsWith("next:") || token.startsWith("within:")) {
    const days = Number(token.split(":")[1]);
    if (!Number.isFinite(days) || !task.due) return false;
    return task.due >= ctx.today && task.due <= addDays(ctx.today, days);
  }
  return `${task.content} ${task.description}`.toLowerCase().includes(token);
}

export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  const byOrder = (a: Task, b: Task) => a.order - b.order || a.createdAt.localeCompare(b.createdAt);
  return [...tasks].sort((a, b) => {
    if (mode === "manual") return byOrder(a, b);
    if (mode === "alpha") return a.content.localeCompare(b.content) || byOrder(a, b);
    if (mode === "added") return b.createdAt.localeCompare(a.createdAt) || byOrder(a, b);
    if (mode === "priority") return a.priority - b.priority || byOrder(a, b);
    const ad = a.due ? `${a.due} ${a.dueTime ?? "99:99"}` : "9999-99-99";
    const bd = b.due ? `${b.due} ${b.dueTime ?? "99:99"}` : "9999-99-99";
    return ad.localeCompare(bd) || a.priority - b.priority || byOrder(a, b);
  });
}

export function isOverdue(task: Task, today = todayISO()): boolean {
  return !task.completed && !!task.due && task.due < today;
}

export function priorityLabel(priority: Priority): string {
  return priority === 4 ? "No priority" : `P${priority}`;
}
