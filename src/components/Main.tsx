import { forwardRef, useEffect, useMemo, useState } from "react";
import { formatLong, todayISO } from "../lib/dates.ts";
import { setSort, setView } from "../lib/nav.ts";
import * as ops from "../lib/ops.ts";
import { mutate, useStore } from "../lib/store.ts";
import { visibleTasks } from "../lib/views.ts";
import { PROJECT_COLORS, INBOX_ID, type Project, type SortMode } from "../lib/types.ts";
import { BoardView } from "./BoardView.tsx";
import { HistoryView } from "./HistoryView.tsx";
import { Icon } from "./Icon.tsx";
import { ListView } from "./ListView.tsx";
import { QuickAdd } from "./QuickAdd.tsx";

const SORTS: { id: SortMode; label: string }[] = [
  { id: "manual", label: "Manual" },
  { id: "due", label: "Due date" },
  { id: "priority", label: "Priority" },
  { id: "alpha", label: "Name" },
  { id: "added", label: "Date added" },
];

function ProjectHeader({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  useEffect(() => setName(project.name), [project.name]);
  const [section, setSection] = useState("");
  return (
    <div className="project-tools">
      {editing ? (
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); mutate((d) => ops.updateProject(d, project.id, { name })); setEditing(false); }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setEditing(false)} aria-label="Project name" />
        </form>
      ) : (
        <button type="button" className="btn btn-small" onClick={() => setEditing(true)}><Icon name="edit" size={14} /> Rename</button>
      )}
      <button type="button" className="btn btn-small" aria-pressed={project.layout === "board"} onClick={() => mutate((d) => ops.updateProject(d, project.id, { layout: project.layout === "board" ? "list" : "board" }))}>
        <Icon name={project.layout === "board" ? "list" : "board"} size={14} /> {project.layout === "board" ? "List view" : "Board view"}
      </button>
      <button type="button" className="btn btn-small" aria-pressed={project.favorite} onClick={() => mutate((d) => ops.updateProject(d, project.id, { favorite: !project.favorite }))}>
        <Icon name="star" size={14} /> {project.favorite ? "Unfavorite" : "Favorite"}
      </button>
      <details className="menu">
        <summary className="btn btn-small"><Icon name="more" size={14} /> More</summary>
        <div className="menu-pop">
          <div className="swatches" role="group" aria-label="Project color">
            {PROJECT_COLORS.map((c) => (
              <button key={c} type="button" aria-label={c} aria-pressed={project.color === c} className={`swatch dot-${c} ${project.color === c ? "on" : ""}`} onClick={() => mutate((d) => ops.updateProject(d, project.id, { color: c }))} />
            ))}
          </div>
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); mutate((d) => ops.addSection(d, project.id, section).data); setSection(""); }}>
            <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="New section" aria-label="New section" />
          </form>
          <button type="button" className="btn btn-small" onClick={() => { mutate((d) => ops.updateProject(d, project.id, { archived: true })); setView({ kind: "today" }); }}>
            <Icon name="archive" size={14} /> Archive
          </button>
          <button
            type="button" className="btn btn-small btn-danger"
            onClick={() => {
              if (window.confirm(`Delete “${project.name}”? Its tasks move to the Inbox.`)) {
                mutate((d) => ops.deleteProject(d, project.id));
                setView({ kind: "inbox" });
              }
            }}
          >
            <Icon name="trash" size={14} /> Delete project
          </button>
        </div>
      </details>
    </div>
  );
}

export const Main = forwardRef<HTMLInputElement, { onMenu: () => void }>(function Main({ onMenu }, composerRef) {
  const view = useStore((s) => s.view);
  const sort = useStore((s) => s.sort);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const sections = useStore((s) => s.sections);
  const labels = useStore((s) => s.labels);
  const filters = useStore((s) => s.filters);
  const completions = useStore((s) => s.completions);
  const prefs = useStore((s) => s.prefs);
  const [search, setSearch] = useState("");
  const today = todayISO();
  useEffect(() => setSearch(""), [view]);

  const project = view.kind === "project" ? projects.find((p) => p.id === view.projectId) : undefined;
  const title =
    view.kind === "inbox" ? "Inbox" : view.kind === "today" ? "Today" : view.kind === "upcoming" ? "Upcoming" : view.kind === "history" ? "History"
    : view.kind === "project" ? (project?.name ?? "Project")
    : view.kind === "label" ? (labels.find((l) => l.id === view.labelId)?.name ?? "Label")
    : view.kind === "filter" ? (filters.find((f) => f.id === view.filterId)?.name ?? "Filter") : "Search";
  const open = useMemo(
    () => visibleTasks({ tasks, projects, sections, labels, filters, completions, prefs }, view, today, search).filter((t) => !t.completed).length,
    [tasks, projects, sections, labels, filters, completions, prefs, view, today, search],
  );
  const addProjectId = view.kind === "project" ? view.projectId : INBOX_ID;
  const board = project?.layout === "board";

  return (
    <main className="main">
      <header className="main-head">
        <button type="button" className="icon-btn menu-btn" aria-label="Open menu" onClick={onMenu}><Icon name="menu" /></button>
        <div className="titles">
          <h1>{title}</h1>
          <p className="sub">
            {view.kind === "history" ? `${completions.length} completed` : `${open} open`}
            {view.kind === "today" ? ` · ${formatLong(today)}` : ""}
          </p>
        </div>
        <span className="spacer" />
        {view.kind !== "history" && (
          <>
            <label className="search">
              <Icon name="search" size={16} />
              <input id="fieldnote-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search tasks" />
            </label>
            {!board && (
              <select className="sort" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            )}
          </>
        )}
      </header>
      {project && <ProjectHeader project={project} />}
      {view.kind !== "history" && !board && (
        <div className="composer">
          <QuickAdd ref={composerRef} projectId={addProjectId} hint />
        </div>
      )}
      <div className="content">
        {view.kind === "history" ? <HistoryView /> : board && project ? <BoardView projectId={project.id} search={search} /> : <ListView view={view} search={search} />}
      </div>
    </main>
  );
});
