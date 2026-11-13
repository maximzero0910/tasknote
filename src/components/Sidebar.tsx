import { useMemo, useState, type ReactNode } from "react";
import { todayISO } from "../lib/dates.ts";
import { setView } from "../lib/nav.ts";
import * as ops from "../lib/ops.ts";
import { mutate, useStore } from "../lib/store.ts";
import { sidebarCounts } from "../lib/views.ts";
import { PROJECT_COLORS, type View } from "../lib/types.ts";
import { Icon } from "./Icon.tsx";

function Nav({ active, onClick, icon, children, count }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode; count?: number }) {
  return (
    <button type="button" className={`nav ${active ? "nav-active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{children}</span>
      {!!count && <span className="count">{count}</span>}
    </button>
  );
}

export function Sidebar({ onNavigate, onSettings }: { onNavigate?: () => void; onSettings: () => void }) {
  const view = useStore((s) => s.view);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const labels = useStore((s) => s.labels);
  const filters = useStore((s) => s.filters);
  const prefs = useStore((s) => s.prefs);
  const [draft, setDraft] = useState("");
  const counts = useMemo(
    () => sidebarCounts({ tasks, projects, sections: [], labels, filters, completions: [], prefs }, todayISO()),
    [tasks, projects, labels, filters, prefs],
  );
  const go = (next: View) => {
    setView(next);
    onNavigate?.();
  };
  const is = (kind: View["kind"]) => view.kind === kind;
  const mine = projects.filter((p) => !p.inbox && !p.archived).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.order - b.order);
  const archived = projects.filter((p) => p.archived);

  return (
    <div className="sidebar-body">
      <div className="brand">
        <p className="brand-name">Fieldnote</p>
        <p className="brand-sub">Tasks that stay on this device</p>
      </div>
      <nav className="nav-group" aria-label="Views">
        <Nav active={is("inbox")} count={counts.inbox} onClick={() => go({ kind: "inbox" })} icon={<Icon name="inbox" />}>Inbox</Nav>
        <Nav active={is("today")} count={counts.today} onClick={() => go({ kind: "today" })} icon={<Icon name="sun" />}>Today</Nav>
        <Nav active={is("upcoming")} count={counts.upcoming} onClick={() => go({ kind: "upcoming" })} icon={<Icon name="calendar" />}>Upcoming</Nav>
        <Nav active={is("history")} onClick={() => go({ kind: "history" })} icon={<Icon name="history" />}>History</Nav>
      </nav>

      <div className="scroll">
        <p className="section-label">Projects</p>
        <nav className="nav-group" aria-label="Projects">
          {mine.map((p) => (
            <Nav key={p.id} active={view.kind === "project" && view.projectId === p.id} onClick={() => go({ kind: "project", projectId: p.id })} icon={<i className={`dot dot-${p.color}`} />}>
              {p.name}
              {p.favorite && <span className="fav" aria-label="favorite"> ★</span>}
            </Nav>
          ))}
        </nav>
        <form
          className="inline-form add-project"
          onSubmit={(e) => {
            e.preventDefault();
            let id: string | null = null;
            mutate((d) => {
              const r = ops.addProject(d, draft, PROJECT_COLORS[projects.length % PROJECT_COLORS.length]);
              id = r.id;
              return r.data;
            });
            if (id) {
              setDraft("");
              go({ kind: "project", projectId: id });
            }
          }}
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New project" aria-label="New project" />
          <button type="submit" className="btn btn-accent btn-square" aria-label="Add project"><Icon name="plus" /></button>
        </form>

        {labels.length > 0 && (
          <>
            <p className="section-label">Labels</p>
            <nav className="nav-group" aria-label="Labels">
              {labels.map((l) => (
                <Nav key={l.id} active={view.kind === "label" && view.labelId === l.id} onClick={() => go({ kind: "label", labelId: l.id })} icon={<i className={`dot dot-${l.color}`} />}>
                  {l.name}
                </Nav>
              ))}
            </nav>
          </>
        )}
        {filters.length > 0 && (
          <>
            <p className="section-label">Filters</p>
            <nav className="nav-group" aria-label="Filters">
              {filters.map((f) => (
                <Nav key={f.id} active={view.kind === "filter" && view.filterId === f.id} onClick={() => go({ kind: "filter", filterId: f.id })} icon={<i className={`dot dot-${f.color}`} />}>
                  {f.name}
                </Nav>
              ))}
            </nav>
          </>
        )}
        {archived.length > 0 && (
          <details className="archived">
            <summary className="section-label">Archived ({archived.length})</summary>
            {archived.map((p) => (
              <div key={p.id} className="row">
                <span className="nav-label">{p.name}</span>
                <button type="button" className="btn btn-small" onClick={() => mutate((d) => ops.updateProject(d, p.id, { archived: false }))}>Restore</button>
              </div>
            ))}
          </details>
        )}
      </div>

      <div className="sidebar-foot">
        <button type="button" className="nav" onClick={onSettings}>
          <span className="nav-icon"><Icon name="settings" /></span>
          <span className="nav-label">Settings</span>
        </button>
      </div>
    </div>
  );
}
