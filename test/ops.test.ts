import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as ops from "../src/lib/ops.ts";
import { sortTasks, taskMatchesQuery } from "../src/lib/query.ts";
import { buildTree, visibleTasks } from "../src/lib/views.ts";
import { INBOX_ID } from "../src/lib/types.ts";
import { NOW, task, withTasks } from "./helpers.ts";

const find = (d: ReturnType<typeof withTasks>, id: string) => d.tasks.find((t) => t.id === id)!;

describe("tasks", () => {
  it("adds tasks, trims, ignores empties, falls back to the inbox", () => {
    const d0 = ops.emptyData();
    assert.equal(ops.addTask(d0, { content: "   " }).id, null);
    const r = ops.addTask(d0, { content: " Hi ", projectId: "missing" }, "a", NOW);
    assert.equal(find(r.data, "a").content, "Hi");
    assert.equal(find(r.data, "a").projectId, INBOX_ID);
  });
  it("drops time and repeat when there is no date", () => {
    const r = ops.addTask(ops.emptyData(), { content: "x", dueTime: "09:00", recurrence: { every: 1, unit: "day", from: "due" } }, "a");
    assert.equal(find(r.data, "a").dueTime, null);
    assert.equal(find(r.data, "a").recurrence, null);
    const d = ops.updateTask(withTasks(task({ id: "b", content: "y", due: "2026-11-14", dueTime: "09:00", recurrence: { every: 1, unit: "day", from: "due" } })), "b", { due: null });
    assert.equal(find(d, "b").recurrence, null);
    assert.equal(find(d, "b").dueTime, null);
  });
  it("completes a parent with its open subtasks and records history", () => {
    const d = ops.completeTask(withTasks(task({ id: "p", content: "P" }), task({ id: "c", content: "C", parentId: "p" })), "p", NOW);
    assert.equal(find(d, "p").completed, true);
    assert.equal(find(d, "c").completed, true);
    assert.equal(d.completions.length, 2);
  });
  it("reschedules a repeating task and resets its subtasks", () => {
    const base = withTasks(
      task({ id: "p", content: "P", due: "2026-11-13", recurrence: { every: 1, unit: "week", from: "due" } }),
      task({ id: "c", content: "C", parentId: "p", completed: true, completedAt: "x" }),
    );
    const d = ops.completeTask(base, "p", NOW);
    assert.equal(find(d, "p").completed, false);
    assert.equal(find(d, "p").due, "2026-11-20");
    assert.equal(find(d, "c").completed, false);
    assert.equal(d.completions.length, 1);
  });
  it("reopening a subtask reopens completed ancestors and drops the history entry", () => {
    let d = ops.completeTask(withTasks(task({ id: "p", content: "P" }), task({ id: "c", content: "C", parentId: "p" })), "p", NOW);
    d = ops.uncompleteTask(d, "c");
    assert.equal(find(d, "p").completed, false);
    assert.equal(find(d, "c").completed, false);
    assert.equal(d.completions.filter((x) => x.taskId === "c").length, 0);
  });
  it("soft-deletes with subtasks and restores them together", () => {
    let d = ops.deleteTask(withTasks(task({ id: "p", content: "P" }), task({ id: "c", content: "C", parentId: "p" })), "p", NOW);
    assert.ok(find(d, "c").deletedAt);
    d = ops.restoreTask(d, "p");
    assert.equal(find(d, "p").deletedAt, null);
    assert.equal(find(d, "c").deletedAt, null);
    d = ops.purgeDeleted(ops.deleteTask(d, "p", NOW));
    assert.equal(d.tasks.length, 0);
  });
  it("moves a task and its subtasks to another project", () => {
    let d = ops.addProject(ops.emptyData(), "Home", "moss", "home").data;
    d = { ...d, tasks: [task({ id: "p", content: "P" }), task({ id: "c", content: "C", parentId: "p" })] };
    d = ops.moveTaskToProject(d, "p", "home");
    assert.equal(find(d, "p").projectId, "home");
    assert.equal(find(d, "c").projectId, "home");
    assert.equal(find(d, "c").parentId, "p");
  });
  it("reorders siblings without leaving ties", () => {
    let d = withTasks(task({ id: "a", content: "a", order: 0 }), task({ id: "b", content: "b", order: 0 }), task({ id: "c", content: "c", order: 0 }));
    d = ops.moveTask(d, "c", -1);
    const order = sortTasks(d.tasks, "manual").map((t) => t.id);
    assert.deepEqual(new Set(order), new Set(["a", "b", "c"]));
    assert.deepEqual(new Set(d.tasks.map((t) => t.order)), new Set([0, 1, 2]));
  });
});

describe("projects and sections", () => {
  it("renames, ignores empty names and never archives the inbox", () => {
    let d = ops.addProject(ops.emptyData(), "Home", "moss", "home").data;
    d = ops.updateProject(d, "home", { name: "  Cabin " });
    assert.equal(d.projects.find((p) => p.id === "home")!.name, "Cabin");
    d = ops.updateProject(d, "home", { name: "   " });
    assert.equal(d.projects.find((p) => p.id === "home")!.name, "Cabin");
    d = ops.updateProject(d, INBOX_ID, { archived: true });
    assert.equal(d.projects.find((p) => p.id === INBOX_ID)!.archived, false);
  });
  it("deleting a project keeps its tasks in the inbox", () => {
    let d = ops.addProject(ops.emptyData(), "Home", "moss", "home").data;
    d = ops.addSection(d, "home", "Repairs", "sec").data;
    d = { ...d, tasks: [task({ id: "a", content: "a", projectId: "home", sectionId: "sec" })] };
    d = ops.deleteProject(d, "home");
    assert.equal(find(d, "a").projectId, INBOX_ID);
    assert.equal(find(d, "a").sectionId, null);
    assert.equal(d.sections.length, 0);
  });
  it("reorders sections", () => {
    let d = ops.addProject(ops.emptyData(), "P", "moss", "p").data;
    d = ops.addSection(d, "p", "One", "s1").data;
    d = ops.addSection(d, "p", "Two", "s2").data;
    d = ops.moveSection(d, "s2", -1);
    const names = [...d.sections].sort((a, b) => a.order - b.order).map((s) => s.name);
    assert.deepEqual(names, ["Two", "One"]);
  });
  it("does not allow sections in the inbox", () => {
    assert.equal(ops.addSection(ops.emptyData(), INBOX_ID, "Nope").id, null);
  });
});

describe("filters and views", () => {
  const data = ops.emptyData();
  const ctx = { today: "2026-11-13", projects: data.projects, labels: [{ id: "l1", name: "errand", color: "amber" }] };
  const t = task({ id: "a", content: "Call glazier", priority: 1, due: "2026-11-13", labelIds: ["l1"] });
  it("supports AND, OR and NOT", () => {
    assert.equal(taskMatchesQuery(t, "p1 today", ctx), true);
    assert.equal(taskMatchesQuery(t, "p2 | @errand", ctx), true);
    assert.equal(taskMatchesQuery(t, "p1 !today", ctx), false);
    assert.equal(taskMatchesQuery(t, '#"Inbox" glazier', ctx), true);
    assert.equal(taskMatchesQuery(t, "within:3", ctx), true);
  });
  it("lists today including overdue and hides archived projects from aggregate views", () => {
    let d = ops.addProject(ops.emptyData(), "Old", "moss", "old").data;
    d = ops.updateProject(d, "old", { archived: true });
    d = { ...d, tasks: [
      task({ id: "a", content: "a", due: "2026-11-12" }),
      task({ id: "b", content: "b", due: "2026-11-13" }),
      task({ id: "c", content: "c", due: "2026-11-13", projectId: "old" }),
      task({ id: "d", content: "d", due: "2026-11-14" }),
    ] };
    assert.deepEqual(visibleTasks(d, { kind: "today" }, "2026-11-13").map((x) => x.id).sort(), ["a", "b"]);
    assert.deepEqual(visibleTasks(d, { kind: "project", projectId: "old" }, "2026-11-13").map((x) => x.id), ["c"]);
  });
  it("nests subtasks under visible parents and keeps orphans as roots", () => {
    const tree = buildTree([task({ id: "p", content: "p" }), task({ id: "c", content: "c", parentId: "p" }), task({ id: "o", content: "o", parentId: "gone" })], "manual");
    assert.equal(tree.length, 2);
    assert.equal(tree.find((n) => n.task.id === "p")!.children.length, 1);
  });
});
