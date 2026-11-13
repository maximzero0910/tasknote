import { emptyData } from "../src/lib/ops.ts";
import type { AppData, Task } from "../src/lib/types.ts";

/** Friday 13 November 2026, local time. */
export const NOW = new Date(2026, 10, 13, 10, 0, 0);

export function task(partial: Partial<Task> & Pick<Task, "id" | "content">): Task {
  return {
    description: "", projectId: "inbox", sectionId: null, parentId: null, priority: 4, labelIds: [], due: null,
    dueTime: null, recurrence: null, completed: false, completedAt: null, createdAt: "2026-11-01T00:00:00.000Z",
    order: 0, deletedAt: null, ...partial,
  };
}

export function withTasks(...tasks: Task[]): AppData {
  return { ...emptyData(), tasks };
}
