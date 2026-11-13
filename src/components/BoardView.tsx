import { useMemo, useState } from "react";
import * as ops from "../lib/ops.ts";
import { mutate, useStore } from "../lib/store.ts";
import { sortTasks } from "../lib/query.ts";
import { Icon } from "./Icon.tsx";
import { QuickAdd } from "./QuickAdd.tsx";
import { TaskRow } from "./TaskRow.tsx";

/** Kanban-style view of a project: one column per section, plus "No section". */
export function BoardView({ projectId, search }: { projectId: string; search: string }) {
  const tasks = useStore((s) => s.tasks);
  const sections = useStore((s) => s.sections);
  const showCompleted = useStore((s) => s.prefs.showCompleted);
  const [newColumn, setNewColumn] = useState("");

  const columns = useMemo(() => {
    const own = sections.filter((s) => s.projectId === projectId).sort((a, b) => a.order - b.order);
    const needle = search.trim().toLowerCase();
    const rows = tasks.filter(
      (t) =>
        !t.deletedAt && t.projectId === projectId && !t.parentId && (showCompleted || !t.completed) &&
        (!needle || `${t.content} ${t.description}`.toLowerCase().includes(needle)),
    );
    return [
      { id: null as string | null, name: "No section", tasks: sortTasks(rows.filter((t) => !t.sectionId || !own.some((s) => s.id === t.sectionId)), "manual") },
      ...own.map((s) => ({ id: s.id as string | null, name: s.name, tasks: sortTasks(rows.filter((t) => t.sectionId === s.id), "manual") })),
    ];
  }, [tasks, sections, projectId, search, showCompleted]);

  return (
    <div className="board" data-testid="board">
      {columns.map((col, index) => (
        <section key={col.id ?? "none"} className="column" aria-label={col.name}>
          <h2 className="group-title">
            {col.name} <span className="count">{col.tasks.length}</span>
          </h2>
          <div className="column-body">
            {col.tasks.map((t) => (
              <div key={t.id} className="card">
                <TaskRow task={t} />
                <div className="card-actions">
                  <button type="button" className="icon-btn" aria-label="Move to previous column" disabled={index === 0} onClick={() => mutate((d) => ops.moveTaskToSection(d, t.id, columns[index - 1].id))}>
                    <Icon name="left" size={15} />
                  </button>
                  <button type="button" className="icon-btn" aria-label="Move to next column" disabled={index === columns.length - 1} onClick={() => mutate((d) => ops.moveTaskToSection(d, t.id, columns[index + 1].id))}>
                    <Icon name="right" size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <QuickAdd projectId={projectId} sectionId={col.id} placeholder={`Add to ${col.name}`} />
        </section>
      ))}
      <form
        className="column column-new"
        onSubmit={(e) => {
          e.preventDefault();
          mutate((d) => ops.addSection(d, projectId, newColumn).data);
          setNewColumn("");
        }}
      >
        <input value={newColumn} onChange={(e) => setNewColumn(e.target.value)} placeholder="New column" aria-label="New column name" />
        <button type="submit" className="btn">
          Add column
        </button>
      </form>
    </div>
  );
}
