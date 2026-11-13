import { getState, setState } from "./store.ts";
import type { SortMode, View } from "./types.ts";

export function setView(view: View): void {
  setState({ view, selectedTaskId: null });
}

export function selectTask(id: string | null): void {
  setState({ selectedTaskId: id });
}

export function setSort(sort: SortMode): void {
  setState({ sort });
}

export function currentView(): View {
  return getState().view;
}
