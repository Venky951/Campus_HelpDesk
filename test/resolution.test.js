const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateResolutionDetails } = require("../utils/resolution");

const adminView = fs.readFileSync(
  path.join(__dirname, "..", "views", "admin", "admin.ejs"),
  "utf8",
);
const adminScript = fs.readFileSync(
  path.join(__dirname, "..", "public", "js", "admin-dashboard.js"),
  "utf8",
);

test("resolution requires trimmed details for a status transition", () => {
  assert.deepEqual(
    validateResolutionDetails("Resolved", "In Progress", "  Fixed the issue  "),
    { valid: true, details: "Fixed the issue" },
  );
  assert.equal(
    validateResolutionDetails("Resolved", "Open", "   ").valid,
    false,
  );
});

test("resolution validation permits an unchanged resolved status", () => {
  assert.deepEqual(
    validateResolutionDetails("Resolved", "Resolved", ""),
    { valid: true, details: "" },
  );
});

test("resolution validation rejects details over the maximum length", () => {
  assert.equal(
    validateResolutionDetails("Resolved", "Open", "x".repeat(2001)).valid,
    false,
  );
});

test("admin resolution UI intercepts Resolved without inline handlers", () => {
  assert.match(adminView, /data-ticket-status-select/);
  assert.match(adminView, /name="resolutionDetails"/);
  assert.match(adminView, /admin-dashboard\.js\?v=resolution-dialog-1/);
  assert.doesNotMatch(adminView, /onchange\s*=/);
  assert.match(adminScript, /value === "Resolved"/);
  assert.match(adminScript, /form\.requestSubmit\(\)/);
  assert.match(adminScript, /namedItem\("resolutionDetails"\)/);
});
