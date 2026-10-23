const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const mongoose = require("mongoose");

const Ticket = require("../models/raisetickect");
const TicketHistory = require("../models/ticket-history");
const Notification = require("../models/notification");
const { actions } = require("../utils/ticket-history");
const { notificationTypes } = require("../utils/notifications");

const studentRoutes = fs.readFileSync(
  path.join(__dirname, "..", "routes", "student.js"),
  "utf8",
);
const adminController = fs.readFileSync(
  path.join(__dirname, "..", "controllers", "admin.js"),
  "utf8",
);

test("ticket lifecycle fields have safe defaults and validation", () => {
  assert.equal(Ticket.schema.path("resolutionConfirmedAt").defaultValue, null);
  assert.equal(Ticket.schema.path("reopenCount").defaultValue, 0);
  assert.equal(Ticket.schema.path("lastReopenedAt").defaultValue, null);
  assert.equal(Ticket.schema.path("feedbackSubmittedAt").defaultValue, null);
  assert.equal(Ticket.schema.path("feedbackRating").options.min, 1);
  assert.equal(Ticket.schema.path("feedbackRating").options.max, 5);
  assert.equal(Ticket.schema.path("feedbackComment").options.maxlength, 2000);
});

test("history and notification models accept lifecycle events", () => {
  for (const action of [
    actions.REOPENED,
    actions.RESOLUTION_CONFIRMED,
    actions.FEEDBACK_SUBMITTED,
  ]) {
    assert.ok(TicketHistory.schema.path("action").enumValues.includes(action));
  }
  assert.ok(
    Notification.schema
      .path("type")
      .enumValues.includes(notificationTypes.TICKET_REOPENED),
  );
});

test("student lifecycle routes are CSRF-protected student-only POST routes", () => {
  assert.match(studentRoutes, /"\/ticket\/:id\/confirm-resolution"/);
  assert.match(studentRoutes, /"\/ticket\/:id\/reopen"/);
  assert.match(studentRoutes, /"\/ticket\/:id\/feedback"/);
  assert.match(studentRoutes, /isAuth,\s*isStudent/);
  assert.match(studentRoutes, /feedbackRating/);
});

test("admin cannot reopen a student-confirmed resolution through status updates", () => {
  assert.match(adminController, /Confirmed resolutions cannot be reopened by an admin/);
  assert.match(adminController, /resolutionConfirmedAt = null/);
});

test("lifecycle query identifiers remain valid MongoDB identifiers", () => {
  assert.equal(
    mongoose.isValidObjectId("507f1f77bcf86cd799439011"),
    true,
  );
});
