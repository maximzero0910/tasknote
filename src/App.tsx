import { useEffect, useRef, useState } from "react";
import { Detail } from "./components/Detail.tsx";
import { Icon } from "./components/Icon.tsx";
import { Main } from "./components/Main.tsx";
import { Settings } from "./components/Settings.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { Toasts } from "./components/Toasts.tsx";
import { selectTask, setView } from "./lib/nav.ts";
import { dueNow, showReminder } from "./lib/reminders.ts";
import { getState, useStore } from "./lib/store.ts";

export function App() {
  const theme = useStore((s) => s.prefs.theme);
  const reminders = useStore((s) => s.prefs.reminders);
  const view = useStore((s) => s.view);
  const selected = useStore((s) => s.tasks.find((t) => t.id === s.selectedTaskId && !t.deletedAt) ?? null);
  const [drawer, setDrawer] = useState(false);
  const [settings, setSettings] = useState(false);
  const composer = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    if (!reminders) return;
    const tick = () => dueNow(getState().tasks).forEach(showReminder);
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [reminders]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (event.key === "Escape") {
        if (settings) setSettings(false);
        else selectTask(null);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "q" || event.key === "n") {
        event.preventDefault();
        composer.current?.focus();
      } else if (event.key === "/") {
        event.preventDefault();
        document.getElementById("fieldnote-search")?.focus();
      } else if (event.key === "g") {
        // "g" then a letter jumps between views.
        const next = (e: KeyboardEvent) => {
          window.removeEventListener("keydown", next, true);
          const map: Record<string, () => void> = {
            i: () => setView({ kind: "inbox" }),
            t: () => setView({ kind: "today" }),
            u: () => setView({ kind: "upcoming" }),
            h: () => setView({ kind: "history" }),
          };
          if (map[e.key]) {
            e.preventDefault();
            map[e.key]();
          }
        };
        window.addEventListener("keydown", next, true);
        setTimeout(() => window.removeEventListener("keydown", next, true), 1200);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings]);

  const tab = (label: string, icon: "sun" | "calendar" | "inbox", kind: "today" | "upcoming" | "inbox") => (
    <button type="button" className={view.kind === kind ? "active" : ""} aria-current={view.kind === kind ? "page" : undefined} onClick={() => setView({ kind })}>
      <Icon name={icon} />
      {label}
    </button>
  );

  return (
    <div className={`app ${selected ? "has-detail" : ""}`}>
      <aside className="sidebar">
        <Sidebar onSettings={() => setSettings(true)} />
      </aside>
      {drawer && (
        <div className="drawer" onClick={() => setDrawer(false)}>
          <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={() => setDrawer(false)} onSettings={() => { setDrawer(false); setSettings(true); }} />
          </aside>
        </div>
      )}
      <Main ref={composer} onMenu={() => setDrawer(true)} />
      {selected && <Detail key={selected.id} task={selected} />}
      <nav className="tabbar" aria-label="Quick navigation">
        {tab("Today", "sun", "today")}
        {tab("Upcoming", "calendar", "upcoming")}
        {tab("Inbox", "inbox", "inbox")}
        <button type="button" onClick={() => setDrawer(true)}>
          <Icon name="menu" />
          Browse
        </button>
      </nav>
      {settings && <Settings onClose={() => setSettings(false)} />}
      <Toasts />
    </div>
  );
}
