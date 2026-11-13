import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exportBackup, normalizeData, parseBackup, sampleData, sanitizeView, tasksToCsv } from "../src/lib/data.ts";
import { INBOX_ID } from "../src/lib/types.ts";
import { NOW } from "./helpers.ts";

describe("normalizeData", () => {
  it("returns a valid empty workspace for garbage", () => {
    for (const junk of [null, 5, "x", [], {}]) {
      const d = normalizeData(junk);
      assert.equal(d.projects[0].id, INBOX_ID);
      assert.equal(d.tasks.length, 0);
    }
  });
  it("repairs dangling references and cycles", () => {
    const d = normalizeData({
      projects: [{ id: "inbox", name: "Inbox" }],
      sections: [{ id: "s", projectId: "ghost", name: "S" }],
      tasks: [
        { id: "a", content: "A", projectId: "ghost", sectionId: "s", labelIds: ["nope"], due: "2026-02-31", dueTime: "09:00", priority: 9 },
        { id: "b", content: "B", parentId: "c" },
        { id: "c", content: "C", parentId: "b" },
        { id: "d", content: "", },
        { id: "a", content: "dupe" },
      ],
    });
    assert.equal(d.tasks.length, 3);
    const a = d.tasks.find((t) => t.id === "a")!;
    assert.equal(a.projectId, INBOX_ID);
    assert.equal(a.due, null);
    assert.equal(a.dueTime, null);
    assert.equal(a.priority, 4);
    assert.deepEqual(a.labelIds, []);
    assert.equal(d.sections.length, 0);
    const b = d.tasks.find((t) => t.id === "b")!;
    const c = d.tasks.find((t) => t.id === "c")!;
    assert.ok(b.parentId === null || c.parentId === null, "cycle broken");
  });
  it("round-trips the sample data unchanged", () => {
    const sample = sampleData(NOW);
    assert.deepEqual(normalizeData(JSON.parse(JSON.stringify(sample))), sample);
  });
});

describe("backup", () => {
  it("exports and re-imports", () => {
    const sample = sampleData(NOW);
    const result = parseBackup(exportBackup(sample, NOW));
    assert.ok(result.ok);
    if (result.ok) assert.deepEqual(result.data, sample);
  });
  it("rejects bad files with a message", () => {
    assert.equal(parseBackup("not json").ok, false);
    assert.equal(parseBackup("[]").ok, false);
    assert.equal(parseBackup('{"format":"fieldnote-backup","version":99,"data":{"tasks":[]}}').ok, false);
  });
  it("exports CSV with quoting", () => {
    const d = sampleData(NOW);
    d.tasks[0].content = 'Say "hi", ok';
    assert.match(tasksToCsv(d), /"Say ""hi"", ok"/);
  });
});

describe("sanitizeView", () => {
  it("falls back when the target is gone", () => {
    const d = sampleData(NOW);
    assert.deepEqual(sanitizeView({ kind: "project", projectId: "proj_home" }, d), { kind: "project", projectId: "proj_home" });
    assert.deepEqual(sanitizeView({ kind: "project", projectId: "gone" }, d), { kind: "today" });
    assert.deepEqual(sanitizeView("nope", d), { kind: "today" });
  });
});
