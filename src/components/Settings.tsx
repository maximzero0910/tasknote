import { useRef, useState } from "react";
import { exportBackup, parseBackup, sampleData, tasksToCsv } from "../lib/data.ts";
import { saveTextFile } from "../lib/files.ts";
import * as ops from "../lib/ops.ts";
import { remindersSupported } from "../lib/reminders.ts";
import { replaceAll, mutate, useStore } from "../lib/store.ts";
import { snapshot } from "../lib/actions.ts";
import { toast } from "../lib/toast.ts";
import { emptyData } from "../lib/ops.ts";
import { todayISO } from "../lib/dates.ts";
import { Icon } from "./Icon.tsx";

function LabelRow({ id }: { id: string }) {
  const label = useStore((s) => s.labels.find((l) => l.id === id));
  const [name, setName] = useState(label?.name ?? "");
  if (!label) return null;
  return (
    <div className="row">
      <input
        value={name}
        aria-label={`Label ${label.name}`}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => (name.trim() ? mutate((d) => ops.updateLabel(d, id, { name: name.trim() })) : setName(label.name))}
      />
      <button type="button" className="icon-btn" aria-label={`Delete label ${label.name}`} onClick={() => mutate((d) => ops.deleteLabel(d, id))}>
        <Icon name="trash" size={16} />
      </button>
    </div>
  );
}

function FilterRow({ id }: { id: string }) {
  const filter = useStore((s) => s.filters.find((f) => f.id === id));
  const [name, setName] = useState(filter?.name ?? "");
  const [query, setQuery] = useState(filter?.query ?? "");
  if (!filter) return null;
  return (
    <div className="row">
      <input value={name} aria-label="Filter name" onChange={(e) => setName(e.target.value)} onBlur={() => mutate((d) => ops.updateFilter(d, id, { name: name.trim() || filter.name }))} />
      <input value={query} aria-label="Filter query" onChange={(e) => setQuery(e.target.value)} onBlur={() => mutate((d) => ops.updateFilter(d, id, { query }))} />
      <button type="button" className="icon-btn" aria-label={`Delete filter ${filter.name}`} onClick={() => mutate((d) => ops.deleteFilter(d, id))}>
        <Icon name="trash" size={16} />
      </button>
    </div>
  );
}

export function Settings({ onClose }: { onClose: () => void }) {
  const prefs = useStore((s) => s.prefs);
  const labels = useStore((s) => s.labels);
  const filters = useStore((s) => s.filters);
  const deleted = useStore((s) => s.tasks.filter((t) => t.deletedAt).length);
  const [fName, setFName] = useState("");
  const [fQuery, setFQuery] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const setPrefs = (p: Partial<typeof prefs>) => mutate((d) => ({ ...d, prefs: { ...d.prefs, ...p } }));

  async function enableReminders(on: boolean) {
    if (!on) return setPrefs({ reminders: false });
    if (!remindersSupported()) {
      toast("Notifications are not available in this app view.", { tone: "error" });
      return;
    }
    const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (result === "granted") setPrefs({ reminders: true });
    else toast("Notification permission was not granted.", { tone: "error" });
  }

  async function onImport(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    const result = parseBackup(await picked.text());
    if (!result.ok) return toast(result.error, { tone: "error" });
    if (!window.confirm(`Replace everything with the backup (${result.data.tasks.length} tasks)? Export first if you want to keep the current data.`)) return;
    replaceAll(result.data);
    toast("Backup restored");
    onClose();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>Settings</h2>
          <button type="button" className="icon-btn" aria-label="Close settings" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>

        <h3>General</h3>
        <label className="row">Theme
          <select value={prefs.theme} onChange={(e) => setPrefs({ theme: e.target.value as typeof prefs.theme })}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="row">Week starts on
          <select value={prefs.weekStartsOn} onChange={(e) => setPrefs({ weekStartsOn: Number(e.target.value) === 0 ? 0 : 1 })}>
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
          </select>
        </label>
        <label className="row">Upcoming shows
          <select value={prefs.upcomingDays} onChange={(e) => setPrefs({ upcomingDays: Number(e.target.value) })}>
            {[7, 14, 30].map((n) => <option key={n} value={n}>{n} days</option>)}
          </select>
        </label>
        <label className="row"><span>Show completed tasks in lists</span>
          <input type="checkbox" checked={prefs.showCompleted} onChange={(e) => setPrefs({ showCompleted: e.target.checked })} />
        </label>
        <label className="row"><span>Ask before deleting a task</span>
          <input type="checkbox" checked={prefs.confirmDelete} onChange={(e) => setPrefs({ confirmDelete: e.target.checked })} />
        </label>
        <label className="row"><span>Reminders at due time <small>(only while the app is open)</small></span>
          <input type="checkbox" checked={prefs.reminders} onChange={(e) => void enableReminders(e.target.checked)} />
        </label>

        <h3>Labels</h3>
        {labels.length === 0 && <p className="hint">Labels are created when you type @name.</p>}
        {labels.map((l) => <LabelRow key={l.id} id={l.id} />)}

        <h3>Filters</h3>
        <p className="hint">Words are AND. Use <code>|</code> for OR, <code>!</code> for NOT. Terms: <code>today overdue nodate recurring p1 #Project @label within:7</code></p>
        {filters.map((f) => <FilterRow key={f.id} id={f.id} />)}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!fQuery.trim()) return;
            mutate((d) => ops.addFilter(d, fName, fQuery).data);
            setFName("");
            setFQuery("");
          }}
        >
          <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Name" aria-label="New filter name" />
          <input value={fQuery} onChange={(e) => setFQuery(e.target.value)} placeholder="p1 | overdue" aria-label="New filter query" />
          <button type="submit" className="btn btn-small">Add</button>
        </form>

        <h3>Your data</h3>
        <p className="hint">Everything is stored on this device only. Export a backup now and then.</p>
        <div className="buttons">
          <button type="button" className="btn" onClick={() => void saveTextFile(`fieldnote-backup-${todayISO()}.json`, exportBackup(snapshot()), "application/json")}>
            <Icon name="download" size={15} /> Export backup
          </button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>
            <Icon name="upload" size={15} /> Import backup
          </button>
          <button type="button" className="btn" onClick={() => void saveTextFile(`fieldnote-tasks-${todayISO()}.csv`, tasksToCsv(snapshot()), "text/csv")}>
            Export CSV
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void onImport(e.target.files); e.target.value = ""; }} />
        </div>
        <div className="buttons">
          <button type="button" className="btn" disabled={deleted === 0} onClick={() => mutate(ops.purgeDeleted)}>
            Empty trash ({deleted})
          </button>
          <button type="button" className="btn" onClick={() => window.confirm("Replace your data with the sample data?") && (replaceAll(sampleData()), onClose())}>
            Load sample data
          </button>
          <button type="button" className="btn btn-danger" onClick={() => window.confirm("Erase all tasks, projects and settings on this device?") && (replaceAll(emptyData()), onClose())}>
            Erase everything
          </button>
        </div>

        <h3>About</h3>
        <p className="hint">Fieldnote is free software under the MIT license. It is not affiliated with Doist or Todoist.</p>
      </div>
    </div>
  );
}
