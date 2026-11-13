import { useMemo, useState } from "react";
import { formatLong, todayISO } from "../lib/dates.ts";
import * as ops from "../lib/ops.ts";
import { mutate, useStore } from "../lib/store.ts";
import { buildTree, countNodes, visibleTasks, type TaskNode } from "../lib/views.ts";
import { INBOX_ID, type View } from "../lib/types.ts";
import { Icon } from "./Icon.tsx";
import { QuickAdd } from "./QuickAdd.tsx";
import { TaskRow } from "./TaskRow.tsx";

type Group = { key: string; title: string; tone?: "overdue"; nodes: TaskNode[]; sectionId?: string | null };

function Tree({ nodes, depth = 0, showProject }: { nodes: TaskNode[]; depth?: number; showProject: boolean }) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.task.id}>
          <TaskRow task={node.task} depth={depth} showProject={showProject} />
          {node.children.length > 0 && <Tree nodes={node.children} depth={depth + 1} showProject={false} />}
        </div>
      ))}
    </>
  );
}

function AddInline({ projectId, sectionId }: { projectId: string; sectionId: string | null }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="add-inline" onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} /> Add task
      </button>
    );
  }
  return <QuickAdd projectId={projectId} sectionId={sectionId} autoFocus onDone={() => setOpen(false)} placeholder="Task name" />;
}

function SectionHeader({ section, count, first, last }: { section: { id: string; name: string; collapsed: boolean }; count: number; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  return (
    <div className="group-head">
      <button
        type="button"
        className="icon-btn"
        aria-label={section.collapsed ? "Expand section" : "Collapse section"}
        aria-expanded={!section.collapsed}
        onClick={() => mutate((d) => ops.updateSection(d, section.id, { collapsed: !section.collapsed }))}
      >
        <Icon name={section.collapsed ? "right" : "down"} size={16} />
      </button>
      {editing ? (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            mutate((d) => ops.updateSection(d, section.id, { name }));
            setEditing(false);
          }}
        >
          <input value={name} autoFocus onChange={(e) => setName(e.target.value)} onBlur={() => setEditing(false)} aria-label="Section name" />
        </form>
      ) : (
        <h2 className="group-title">
          {section.name} <span className="count">{count}</span>
        </h2>
      )}
      <span className="spacer" />
      <button type="button" className="icon-btn" aria-label="Rename section" onClick={() => { setName(section.name); setEditing(true); }}>
        <Icon name="edit" size={15} />
      </button>
      <button type="button" className="icon-btn" aria-label="Move section up" disabled={first} onClick={() => mutate((d) => ops.moveSection(d, section.id, -1))}>
        <Icon name="up" size={15} />
      </button>
      <button type="button" className="icon-btn" aria-label="Move section down" disabled={last} onClick={() => mutate((d) => ops.moveSection(d, section.id, 1))}>
        <Icon name="down" size={15} />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Delete section"
        onClick={() => {
          if (window.confirm(`Delete section “${section.name}”? Its tasks stay in the project.`)) mutate((d) => ops.deleteSection(d, section.id));
        }}
      >
        <Icon name="trash" size={15} />
      </button>
    </div>
  );
}

export function ListView({ view, search }: { view: View; search: string }) {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const sections = useStore((s) => s.sections);
  const labels = useStore((s) => s.labels);
  const filters = useStore((s) => s.filters);
  const completions = useStore((s) => s.completions);
  const prefs = useStore((s) => s.prefs);
  const sort = useStore((s) => s.sort);
  const today = todayISO();

  const { groups, total, projectSections } = useMemo(() => {
    const data = { tasks, projects, sections, labels, filters, completions, prefs };
    const rows = visibleTasks(data, view, today, search);
    const out: Group[] = [];
    const nodesOf = (list: typeof rows) => buildTree(list, sort);
    if (view.kind === "today" || view.kind === "upcoming") {
      const overdue = rows.filter((t) => t.due && t.due < today && !t.completed);
      const rest = rows.filter((t) => !overdue.includes(t));
      if (overdue.length) out.push({ key: "overdue", title: "Overdue", tone: "overdue", nodes: nodesOf(overdue) });
      if (view.kind === "today") {
        if (rest.length) out.push({ key: "today", title: "Today", nodes: nodesOf(rest) });
      } else {
        const days = [...new Set(rest.map((t) => t.due ?? ""))].sort();
        for (const day of days) out.push({ key: day, title: day ? formatLong(day) : "No date", nodes: nodesOf(rest.filter((t) => (t.due ?? "") === day)) });
      }
    } else if (view.kind === "project") {
      const own = sections.filter((s) => s.projectId === view.projectId).sort((a, b) => a.order - b.order);
      const loose = rows.filter((t) => !t.sectionId || !own.some((s) => s.id === t.sectionId));
      out.push({ key: "none", title: "", nodes: nodesOf(loose), sectionId: null });
      for (const s of own) out.push({ key: s.id, title: s.name, nodes: nodesOf(rows.filter((t) => t.sectionId === s.id)), sectionId: s.id });
    } else {
      out.push({ key: "all", title: "", nodes: nodesOf(rows) });
    }
    const sectionCount = view.kind === "project" ? sections.filter((s) => s.projectId === view.projectId).length : 0;
    return { groups: out, total: rows.length, projectSections: sectionCount };
  }, [tasks, projects, sections, labels, filters, completions, prefs, view, search, sort, today]);

  const isProject = view.kind === "project";
  const projectId = isProject ? view.projectId : INBOX_ID;
  const showProject = !isProject && view.kind !== "inbox";

  if (!isProject && total === 0) {
    return <EmptyState view={view} searching={!!search.trim()} />;
  }

  return (
    <div className="list">
      {groups.map((group) => {
        const section = isProject && group.sectionId ? sections.find((s) => s.id === group.sectionId) : undefined;
        const collapsed = !!section?.collapsed;
        const index = section ? sections.filter((s) => s.projectId === section.projectId).sort((a, b) => a.order - b.order).findIndex((s) => s.id === section.id) : -1;
        return (
          <section key={group.key} className="group">
            {section ? (
              <SectionHeader section={section} count={countNodes(group.nodes)} first={index === 0} last={index === projectSections - 1} />
            ) : (
              group.title && (
                <h2 className={`group-title ${group.tone === "overdue" ? "group-overdue" : ""}`}>
                  {group.title} <span className="count">{countNodes(group.nodes)}</span>
                </h2>
              )
            )}
            {!collapsed && <Tree nodes={group.nodes} showProject={showProject} />}
            {isProject && !collapsed && <AddInline projectId={projectId} sectionId={group.sectionId ?? null} />}
          </section>
        );
      })}
      {isProject && total === 0 && projectSections === 0 && <p className="empty">Nothing here yet. Add a task above or create a section.</p>}
    </div>
  );
}

function EmptyState({ view, searching }: { view: View; searching: boolean }) {
  let message = "Nothing here.";
  if (searching) message = "No tasks match your search.";
  else if (view.kind === "today") message = "Nothing due today. Enjoy it, or plan something in Upcoming.";
  else if (view.kind === "upcoming") message = "Nothing scheduled for the coming days.";
  else if (view.kind === "inbox") message = "Inbox is empty. Capture anything here and sort it later.";
  else if (view.kind === "filter") message = "No tasks match this filter.";
  else if (view.kind === "label") message = "No tasks carry this label.";
  return <p className="empty">{message}</p>;
}

