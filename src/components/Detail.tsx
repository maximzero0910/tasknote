import { useState, type ReactNode } from "react";
import { addDays, describeRecurrence, todayISO } from "../lib/dates.ts";
import { duplicateTask, removeTask } from "../lib/actions.ts";
import { selectTask } from "../lib/nav.ts";
import * as ops from "../lib/ops.ts";
import { mutate, useStore } from "../lib/store.ts";
import { PROJECT_COLORS, type Priority, type Recurrence, type RecurrenceUnit, type Task } from "../lib/types.ts";
import { Icon } from "./Icon.tsx";
import { QuickAdd } from "./QuickAdd.tsx";
import { TaskRow } from "./TaskRow.tsx";

const PRESETS: { id: string; label: string; rule: Recurrence | null }[] = [
  { id: "none", label: "Does not repeat", rule: null },
  { id: "day", label: "Every day", rule: { every: 1, unit: "day", from: "due" } },
  { id: "weekday", label: "Every weekday", rule: { every: 1, unit: "week", weekdays: [1, 2, 3, 4, 5], from: "due" } },
  { id: "week", label: "Every week", rule: { every: 1, unit: "week", from: "due" } },
  { id: "month", label: "Every month", rule: { every: 1, unit: "month", from: "due" } },
  { id: "year", label: "Every year", rule: { every: 1, unit: "year", from: "due" } },
];
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function presetOf(rule: Recurrence | null): string {
  if (!rule) return "none";
  const key = rule.weekdays?.length ? [...rule.weekdays].sort().join(",") : "";
  if (rule.every === 1 && key === "1,2,3,4,5") return "weekday";
  if (rule.every === 1 && !key) return rule.unit;
  return "custom";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

export function Detail({ task }: { task: Task }) {
  const projects = useStore((s) => s.projects);
  const sections = useStore((s) => s.sections);
  const labels = useStore((s) => s.labels);
  const tasks = useStore((s) => s.tasks);
  const [content, setContent] = useState(task.content);
  const [notes, setNotes] = useState(task.description);
  const [newLabel, setNewLabel] = useState("");
  const patch = (p: Partial<Task>) => mutate((d) => ops.updateTask(d, task.id, p));
  const subs = tasks.filter((t) => t.parentId === task.id && !t.deletedAt).sort((a, b) => a.order - b.order);
  const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) : null;
  const projectSections = sections.filter((s) => s.projectId === task.projectId).sort((a, b) => a.order - b.order);
  const today = todayISO();
  const rule = task.recurrence;
  const setRule = (next: Recurrence | null) => {
    if (next && !task.due) mutate((d) => ops.updateTask(ops.updateTask(d, task.id, { due: today }), task.id, { recurrence: next }));
    else patch({ recurrence: next });
  };

  return (
    <aside className="detail" aria-label="Task details">
      <div className="detail-head">
        <button type="button" className="icon-btn" aria-label="Close details" onClick={() => selectTask(null)}>
          <Icon name="x" />
        </button>
        <span className="spacer" />
        <button type="button" className="icon-btn" aria-label="Duplicate task" onClick={() => { const id = duplicateTask(task.id); if (id) selectTask(id); }}>
          <Icon name="copy" />
        </button>
        <button type="button" className="icon-btn" aria-label="Delete task" onClick={() => removeTask(task.id)}>
          <Icon name="trash" />
        </button>
      </div>
      {parent && (
        <button type="button" className="crumb" onClick={() => selectTask(parent.id)}>
          ↑ {parent.content}
        </button>
      )}
      <input
        className="detail-title"
        value={content}
        aria-label="Task title"
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => (content.trim() ? patch({ content: content.trim() }) : setContent(task.content))}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <textarea
        className="detail-notes"
        value={notes}
        placeholder="Notes"
        aria-label="Notes"
        rows={3}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => patch({ description: notes })}
      />

      {!task.parentId && (
        <Field label="Project">
          <div className="two">
            <select
              aria-label="Project"
              value={task.projectId}
              onChange={(e) => mutate((d) => ops.moveTaskToProject(d, task.id, e.target.value))}
            >
              {projects.filter((p) => !p.archived || p.id === task.projectId).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {projectSections.length > 0 && (
              <select
                aria-label="Section"
                value={task.sectionId ?? ""}
                onChange={(e) => mutate((d) => ops.moveTaskToSection(d, task.id, e.target.value || null))}
              >
                <option value="">No section</option>
                {projectSections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        </Field>
      )}

      <Field label="Priority">
        <div className="seg" role="group" aria-label="Priority">
          {([1, 2, 3, 4] as Priority[]).map((p) => (
            <button key={p} type="button" aria-pressed={task.priority === p} className={task.priority === p ? "on" : ""} onClick={() => patch({ priority: p })}>
              <span className={`pri-${p}`}>{p === 4 ? "None" : `P${p}`}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Due">
        <div className="two">
          <input type="date" aria-label="Due date" value={task.due ?? ""} onChange={(e) => patch({ due: e.target.value || null })} />
          <input type="time" aria-label="Due time" value={task.dueTime ?? ""} disabled={!task.due} onChange={(e) => patch({ dueTime: e.target.value || null })} />
        </div>
        <div className="quick-dates">
          <button type="button" className="btn btn-small" onClick={() => patch({ due: today })}>Today</button>
          <button type="button" className="btn btn-small" onClick={() => patch({ due: addDays(today, 1) })}>Tomorrow</button>
          <button type="button" className="btn btn-small" onClick={() => patch({ due: addDays(today, 7) })}>Next week</button>
          <button type="button" className="btn btn-small" onClick={() => patch({ due: null })}>No date</button>
        </div>
      </Field>

      <Field label="Repeat">
        <select
          aria-label="Repeat"
          value={presetOf(rule)}
          onChange={(e) => setRule(PRESETS.find((p) => p.id === e.target.value)?.rule ?? rule)}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
          {presetOf(rule) === "custom" && <option value="custom">{rule ? describeRecurrence(rule) : "Custom"}</option>}
        </select>
        {rule && (
          <div className="repeat-edit">
            <div className="two">
              <label className="inline">
                Every
                <input
                  type="number" min={1} max={999} value={rule.every} aria-label="Repeat interval"
                  onChange={(e) => setRule({ ...rule, every: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })}
                />
              </label>
              <select
                aria-label="Repeat unit"
                value={rule.unit}
                onChange={(e) => {
                  const unit = e.target.value as RecurrenceUnit;
                  const next: Recurrence = { ...rule, unit };
                  if (unit !== "week") delete next.weekdays;
                  setRule(next);
                }}
              >
                <option value="day">day(s)</option>
                <option value="week">week(s)</option>
                <option value="month">month(s)</option>
                <option value="year">year(s)</option>
              </select>
            </div>
            {rule.unit === "week" && (
              <div className="seg days" role="group" aria-label="Repeat on weekdays">
                {DAY_LETTERS.map((letter, day) => {
                  const on = !!rule.weekdays?.includes(day);
                  return (
                    <button
                      key={day} type="button" aria-pressed={on} aria-label={DAY_NAMES[day]} className={on ? "on" : ""}
                      onClick={() => {
                        const set = new Set(rule.weekdays ?? []);
                        if (on) set.delete(day); else set.add(day);
                        const next: Recurrence = { ...rule };
                        if (set.size) next.weekdays = [...set].sort((a, b) => a - b); else delete next.weekdays;
                        setRule(next);
                      }}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            )}
            <label className="inline">
              <input type="checkbox" checked={rule.from === "complete"} onChange={(e) => setRule({ ...rule, from: e.target.checked ? "complete" : "due" })} />
              Count from the completion date
            </label>
          </div>
        )}
      </Field>

      <Field label="Labels">
        <div className="chips">
          {labels.map((l) => {
            const on = task.labelIds.includes(l.id);
            return (
              <button
                key={l.id} type="button" aria-pressed={on} className={`chip chip-btn ${on ? "chip-on" : ""}`}
                onClick={() => patch({ labelIds: on ? task.labelIds.filter((x) => x !== l.id) : [...task.labelIds, l.id] })}
              >
                @{l.name}
              </button>
            );
          })}
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            mutate((d) => {
              const r = ops.addLabel(d, newLabel, PROJECT_COLORS[(d.labels.length + 1) % PROJECT_COLORS.length]);
              return r.id ? ops.updateTask(r.data, task.id, { labelIds: [...new Set([...task.labelIds, r.id])] }) : d;
            });
            setNewLabel("");
          }}
        >
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New label" aria-label="New label" />
        </form>
      </Field>

      <Field label={`Subtasks${subs.length ? ` (${subs.filter((s) => s.completed).length}/${subs.length})` : ""}`}>
        {subs.map((s) => (
          <TaskRow key={s.id} task={s} />
        ))}
        <QuickAdd projectId={task.projectId} parentId={task.id} placeholder="Add a subtask" />
      </Field>
    </aside>
  );
}
