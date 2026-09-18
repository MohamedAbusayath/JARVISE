import assert from "node:assert/strict";
import { parseCreateTask, parseUpdateTask, isUuid } from "../security/taskValidators";
import { getToolDefinitions } from "../agent/tool.registry";
import "../agent/task.tools";

const valid = parseCreateTask({
    title: "Study TypeScript",
    description: "Learn generics",
    priority: "HIGH",
    due_at: "2026-09-20T18:00:00Z"
});

assert.equal(valid.success, true);
if (valid.success) {
    assert.equal(valid.data.title, "Study TypeScript");
    assert.equal(valid.data.priority, "HIGH");
    assert.equal(valid.data.due_at, "2026-09-20T18:00:00.000Z");
}

assert.equal(parseCreateTask({ title: "" }).success, false);
assert.equal(parseCreateTask({ title: "x", priority: "URGENT" }).success, false);
assert.equal(parseCreateTask({ title: "x", due_at: "not-a-date" }).success, false);
assert.equal(parseCreateTask({ title: "x", user_id: "another-user" }).success, false);

const update = parseUpdateTask({ title: "Updated task", priority: "LOW" });
assert.equal(update.success, true);
if (update.success) {
    assert.deepEqual(update.data, { title: "Updated task", priority: "LOW" });
}

assert.equal(parseUpdateTask({ user_id: "another-user" }).success, false);
assert.equal(isUuid("00000000-0000-4000-8000-000000000000"), true);
assert.equal(isUuid("not-a-uuid"), false);

const taskTools = getToolDefinitions().filter((tool) => tool.name.startsWith("tasks."));
assert.deepEqual(
    taskTools.map((tool) => [tool.name, tool.permission]).sort(),
    [
        ["tasks.complete", "WRITE"],
        ["tasks.create", "WRITE"],
        ["tasks.delete", "DESTRUCTIVE"],
        ["tasks.get", "READ"],
        ["tasks.list", "READ"],
        ["tasks.reopen", "WRITE"],
        ["tasks.update", "WRITE"]
    ]
);

console.log("task validation tests passed");
