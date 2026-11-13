export type Priority = 1 | 2 | 3 | 4;

export type RecurrenceUnit = "day" | "week" | "month" | "year";

/** A repeat rule. `from` anchors the next date to the due date or to the completion day. */
export type Recurrence = {
  every: number;
  unit: RecurrenceUnit;
  /** 0 = Sunday … 6 = Saturday. When set, the task repeats on those weekdays. */
  weekdays?: number[];
  from: "due" | "complete";
};

export type ProjectLayout = "list" | "board";

export type Project = {
  id: string;
  name: string;
  color: string;
  favorite: boolean;
  archived: boolean;
  inbox: boolean;
  order: number;
  layout: ProjectLayout;
};

export type Section = {
  id: string;
  projectId: string;
  name: string;
  order: number;
  collapsed: boolean;
};

export type Label = { id: string; name: string; color: string };

export type SavedFilter = { id: string; name: string; query: string; color: string };

export type Task = {
  id: string;
  content: string;
  description: string;
  projectId: string;
  sectionId: string | null;
  parentId: string | null;
  priority: Priority;
  labelIds: string[];
  /** Local calendar date, YYYY-MM-DD. */
  due: string | null;
  /** Local time, HH:mm. Only meaningful with a due date. */
  dueTime: string | null;
  recurrence: Recurrence | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  order: number;
  deletedAt: string | null;
};

export type CompletionRecord = {
  id: string;
  taskId: string;
  content: string;
  projectId: string;
  completedOn: string;
  at: string;
};

export type Preferences = {
  weekStartsOn: 0 | 1;
  showCompleted: boolean;
  confirmDelete: boolean;
  theme: "light" | "dark" | "system";
  reminders: boolean;
  upcomingDays: number;
};

export type AppData = {
  tasks: Task[];
  projects: Project[];
  sections: Section[];
  labels: Label[];
  filters: SavedFilter[];
  completions: CompletionRecord[];
  prefs: Preferences;
};

export type View =
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "history" }
  | { kind: "project"; projectId: string }
  | { kind: "label"; labelId: string }
  | { kind: "filter"; filterId: string }
  | { kind: "search"; query: string };

export type SortMode = "manual" | "due" | "priority" | "alpha" | "added";

export const INBOX_ID = "inbox";

export const PROJECT_COLORS = [
  "terracotta",
  "ink",
  "moss",
  "amber",
  "slate",
  "clay",
  "pine",
  "wine",
] as const;
