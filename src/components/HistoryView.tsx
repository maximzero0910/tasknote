import { formatLong, formatTime } from "../lib/dates.ts";
import { reopenTask } from "../lib/actions.ts";
import * as ops from "../lib/ops.ts";
import { mutate, useStore } from "../lib/store.ts";

export function HistoryView() {
  const completions = useStore((s) => s.completions);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);

  if (completions.length === 0) return <p className="empty">Completed tasks will appear here.</p>;
  const days = [...new Set(completions.map((c) => c.completedOn))].sort().reverse();
  return (
    <div className="list">
      {days.map((day) => (
        <section key={day} className="group">
          <h2 className="group-title">
            {formatLong(day)} <span className="count">{completions.filter((c) => c.completedOn === day).length}</span>
          </h2>
          {completions
            .filter((c) => c.completedOn === day)
            .map((c) => {
              const task = tasks.find((t) => t.id === c.taskId && !t.deletedAt);
              const project = projects.find((p) => p.id === c.projectId);
              return (
                <div key={c.id} className="history-row">
                  <span className="check is-done" aria-hidden="true" />
                  <span className="task-title">{c.content}</span>
                  <span className="meta">{project && !project.inbox ? project.name : ""}</span>
                  <span className="meta">{formatTime(new Date(c.at).toTimeString().slice(0, 5))}</span>
                  {task?.completed && (
                    <button type="button" className="btn btn-small" onClick={() => reopenTask(task.id)}>
                      Reopen
                    </button>
                  )}
                </div>
              );
            })}
        </section>
      ))}
      <p>
        <button type="button" className="btn btn-small" onClick={() => window.confirm("Clear the completion history?") && mutate(ops.clearHistory)}>
          Clear history
        </button>
      </p>
    </div>
  );
}
