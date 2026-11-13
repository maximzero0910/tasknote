import { useSyncExternalStore } from "react";
import { normalizeData, sanitizeView } from "./data.ts";
import { emptyData } from "./ops.ts";
import { type AppData, type SortMode, type View } from "./types.ts";

export const STORAGE_KEY = "fieldnote-v2";
const LEGACY_KEY = "fieldnote-v1";

export type UiState = { view: View; sort: SortMode; selectedTaskId: string | null };
export type State = AppData & UiState;

type Listener = () => void;

function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function load(): State {
  const ui: UiState = { view: { kind: "today" }, sort: "manual", selectedTaskId: null };
  const current = readStorage(STORAGE_KEY);
  const legacy = current ? null : readStorage(LEGACY_KEY);
  const text = current ?? legacy;
  if (!text) return { ...emptyData(), ...ui };
  try {
    const parsed = JSON.parse(text);
    // v1 stored { state: {...}, version } from zustand; v2 stores the data at the top level.
    const body = legacy && parsed?.state ? parsed.state : parsed;
    const data = normalizeData(body);
    const view = sanitizeView(body?.view, data);
    const sort = ["manual", "due", "priority", "alpha", "added"].includes(body?.sort) ? (body.sort as SortMode) : "manual";
    return { ...data, view, sort, selectedTaskId: null };
  } catch {
    return { ...emptyData(), ...ui };
  }
}

let state: State = load();
const listeners = new Set<Listener>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function persistNow(): void {
  try {
    const { tasks, projects, sections, labels, filters, completions, prefs, view, sort } = state;
    const view2 = view.kind === "search" ? { kind: "today" } : view;
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ tasks, projects, sections, labels, filters, completions, prefs, view: view2, sort }));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

function schedulePersist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 150);
}

export function getState(): State {
  return state;
}

export function setState(update: Partial<State> | ((s: State) => Partial<State>)): void {
  const patch = typeof update === "function" ? update(state) : update;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  schedulePersist();
}

/** Applies a pure AppData transition from ops.ts. */
export function mutate(fn: (data: AppData) => AppData): void {
  setState((s) => {
    const next = fn(s);
    const { tasks, projects, sections, labels, filters, completions, prefs } = next;
    const patch: Partial<State> = { tasks, projects, sections, labels, filters, completions, prefs };
    if (s.selectedTaskId && !tasks.some((t) => t.id === s.selectedTaskId && !t.deletedAt)) patch.selectedTaskId = null;
    return patch;
  });
}

export function replaceAll(data: AppData): void {
  setState({ ...data, view: { kind: "today" }, selectedTaskId: null });
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (saveTimer) clearTimeout(saveTimer);
    persistNow();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (saveTimer) clearTimeout(saveTimer);
      persistNow();
    }
  });
  // Keep several open tabs in step.
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const body = JSON.parse(event.newValue);
      const data = normalizeData(body);
      state = { ...state, ...data, view: sanitizeView(state.view, data) };
      listeners.forEach((l) => l());
    } catch {
      /* ignore */
    }
  });
}

