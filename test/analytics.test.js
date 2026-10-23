const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { csvCell, getAnalyticsRange, toCsv } = require("../utils/analytics");
const Ticket = require("../models/raisetickect");
const TicketHistory = require("../models/ticket-history");
const analyticsController = require("../controllers/analytics");

const adminView = fs.readFileSync(
  path.join(__dirname, "..", "views", "admin", "analytics.ejs"),
  "utf8",
);
const adminRoutes = fs.readFileSync(
  path.join(__dirname, "..", "routes", "admin.js"),
  "utf8",
);

test("analytics ranges use UTC and reject invalid or oversized custom ranges", () => {
  const range = getAnalyticsRange(
    { range: "7" },
    new Date("2026-10-23T12:00:00.000Z"),
  );
  assert.equal(range.from, "2026-10-17");
  assert.equal(range.to, "2026-10-23");
  assert.equal(range.timezone, "UTC");
  assert.match(getAnalyticsRange({ range: "custom", from: "2026-02-30", to: "2026-03-01" }).error, /valid/);
  assert.match(getAnalyticsRange({ range: "custom", from: "2024-01-01", to: "2026-01-01" }).error, /366/);
});

test("CSV cells escape quotes and neutralize spreadsheet formulas", () => {
  assert.equal(csvCell('=HYPERLINK("https://evil.example")'), '"\'=HYPERLINK(""https://evil.example"")"');
  assert.equal(csvCell("normal"), '"normal"');
});

test("CSV conversion produces escaped rows and a trailing newline", () => {
  assert.equal(
    toCsv([
      ["Title", "Value"],
      ['=SUM(A1)', 'quoted "value"'],
    ]),
    '"Title","Value"\r\n"\'=SUM(A1)","quoted ""value"""\r\n',
  );
});

test("CSV export handler returns a downloadable department-scoped CSV", async () => {
  const originalFind = Ticket.find;
  Ticket.find = (filter) => {
    assert.equal(filter.category, "IT");
    assert.equal(filter.createdAt.$gte instanceof Date, true);
    return {
      select() {
        return this;
      },
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      lean: async () => [
        {
          title: "Printer issue",
          category: "IT",
          status: "Open",
          priority: "Medium",
          createdAt: new Date("2026-10-20T00:00:00.000Z"),
          assignedTo: null,
          reopenCount: 0,
          feedbackRating: null,
        },
      ],
    };
  };

  const controller = require("../controllers/analytics");
  let contentType;
  let disposition;
  let body;
  const response = {
    type(value) {
      contentType = value;
      return this;
    },
    set(name, value) {
      if (name === "Content-Disposition") disposition = value;
      return this;
    },
    send(value) {
      body = value;
    },
  };

  try {
    await controller.exportAnalytics(
      {
        query: { range: "7" },
        authenticatedUser: { department: "IT" },
      },
      response,
      (error) => {
        throw error;
      },
    );
  } finally {
    Ticket.find = originalFind;
  }

  assert.equal(contentType, "text/csv");
  assert.match(disposition, /attachment/);
  assert.match(body, /"Printer issue","IT","Open"/);
});

test("analytics routes remain admin-protected and UI has no inline script handlers", () => {
  assert.match(adminRoutes, /"\/admin\/analytics", isAuth, isAdmin/);
  assert.match(adminRoutes, /"\/admin\/analytics\/export"/);
  assert.doesNotMatch(adminView, /on(click|change|submit)\s*=/);
  assert.match(adminView, /Export CSV/);
  assert.match(adminView, /progress/);
});

test("analytics controller imports successfully and exposes both handlers", () => {
  assert.equal(typeof analyticsController.getAnalytics, "function");
  assert.equal(typeof analyticsController.exportAnalytics, "function");
});

test("history analytics has an action and timestamp index", () => {
  assert.ok(
    TicketHistory.schema.indexes().some(
      ([fields]) => fields.action === 1 && fields.createdAt === 1,
    ),
  );
});
