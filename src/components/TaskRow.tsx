import { describeRecurrence, formatLong, formatTime, todayISO } from "../lib/dates.ts";
import { completeTask, reopenTask } from "../lib/actions.ts";
import { selectTask } from "../lib/nav.ts";
import { useStore } from "../lib/store.ts";
import type { Task } from "../lib/types.ts";
import { Icon } from "./Icon.tsx";

export function TaskRow({ task, depth = 0, showProject = false }: { task: Task; depth?: number; showProject?: boolean }) {
  const projects = useStore((s) => s.projects);
  const labels = useStore((s) => s.labels);
  const tasks = useStore((s) => s.tasks);
  const selected = useStore((s) => s.selectedTaskId === task.id);
  const project = projects.find((p) => p.id === task.projectId);
  const taskLabels = task.labelIds.map((id) => labels.find((l) => l.id === id)).filter(Boolean);
  const subs = tasks.filter((t) => t.parentId === task.id && !t.deletedAt);
  const doneSubs = subs.filter((t) => t.completed).length;
  const overdue = !task.completed && !!task.due && task.due < todayISO();

  return (
    <div
      className={`task ${selected ? "task-selected" : ""} ${task.completed ? "task-done" : ""}`}
      style={{ marginLeft: depth * 24 }}
      data-testid="task"
    >
      <button
        type="button"
        className={`check pri-${task.priority} ${task.completed ? "is-done" : ""}`}
        aria-label={task.completed ? `Reopen ${task.content}` : `Complete ${task.content}`}
        aria-pressed={task.completed}
        onClick={() => (task.completed ? reopenTask(task.id) : completeTask(task.id))}
      >
        {task.completed && <Icon name="check" size={14} />}
      </button>
      <button type="button" className="task-body" onClick={() => selectTask(task.id)}>
        <span className="task-title">{task.content}</span>
        <span className="task-meta">
          {showProject && project && !project.inbox && (
            <span className="meta">
              <i className={`dot dot-${project.color}`} /> {project.name}
            </span>
          )}
          {task.due && (
            <span className={`meta ${overdue ? "meta-overdue" : ""}`}>
              {formatLong(task.due)}
              {task.dueTime ? ` ${formatTime(task.dueTime)}` : ""}
            </span>
          )}
          {task.recurrence && (
            <span className="meta" title={describeRecurrence(task.recurrence)}>
              <Icon name="repeat" size={12} /> {describeRecurrence(task.recurrence)}
            </span>
          )}
          {task.priority < 4 && <span className={`meta pri-${task.priority}`}>P{task.priority}</span>}
          {taskLabels.map((l) => (
            <span key={l!.id} className="meta">
              @{l!.name}
            </span>
          ))}
          {subs.length > 0 && (
            <span className="meta">
              {doneSubs}/{subs.length}
            </span>
          )}
          {task.description && <span className="meta">notes</span>}
        </span>
      </button>
    </div>
  );
}
