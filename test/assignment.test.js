const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const mongoose = require("mongoose");
const Ticket = require("../models/raisetickect");
const {
  buildAdminFilter,
} = require("../utils/admin-ticket-query");
const {
  notificationTypes,
  notifyUser,
} = require("../utils/notifications");

const adminTemplate = fs.readFileSync(
  require("node:path").join(__dirname, "..", "views", "admin", "admin.ejs"),
  "utf8",
);
const adminScript = fs.readFileSync(
  require("node:path").join(
    __dirname,
    "..",
    "public",
    "js",
    "admin-dashboard.js",
  ),
  "utf8",
);

test("assignment field is optional and defaults to null", () => {
  const path = Ticket.schema.path("assignedTo");
  assert.equal(path.options.ref, "User");
  assert.equal(path.options.default, null);
});

test("admin assignment filters support assigned-to-me and unassigned legacy tickets", async () => {
  const assigned = await buildAdminFilter({
    department: "IT",
    status: "All",
    priority: "All",
    assignment: "assigned",
    adminId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
    search: "",
  });
  assert.deepEqual(assigned.$and, [
    { assignedTo: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011") },
  ]);

  const unassigned = await buildAdminFilter({
    department: "IT",
    status: "All",
    priority: "All",
    assignment: "unassigned",
    adminId: "507f1f77bcf86cd799439011",
    search: "",
  });
  assert.deepEqual(unassigned.$and, [
    { $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] },
  ]);
});

test("assignment notifications are recipient-scoped and deduplicated by event key", async () => {
  const operations = [];
  await notifyUser({
    recipient: "admin-2",
    ticket: "ticket-1",
    type: notificationTypes.ASSIGNMENT_UPDATED,
    message: "Ticket assigned to you",
    eventKey: "assignment:history-1",
    NotificationModel: {
      bulkWrite: async (batch) => operations.push(...batch),
    },
  });

  test("admin dashboard loads the assignment-aware script and submits assignment changes", () => {
    assert.match(adminTemplate, /admin-dashboard\.js\?v=assignment-1/);
    assert.match(adminTemplate, /data-submit-assignment/);
    assert.match(adminScript, /querySelectorAll\("\[data-submit-assignment\]"\)/);
    assert.match(adminScript, /select\.form\.requestSubmit\(\)/);
  });

  const operation = operations[0].updateOne;
  assert.equal(operation.upsert, true);
  assert.deepEqual(operation.filter, {
    recipient: "admin-2",
    eventKey: "assignment:history-1:admin-2",
  });
});
