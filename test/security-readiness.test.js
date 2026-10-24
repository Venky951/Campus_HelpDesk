const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { getIntegrationMongoUri } = require("../utils/integration-config");
const {
  REQUIRED_ENVIRONMENT_VARIABLES,
  validateRequiredEnvironment,
} = require("../utils/required-config");

const appSource = fs.readFileSync(
  path.join(__dirname, "..", "app.js"),
  "utf8",
);
const readme = fs.readFileSync(
  path.join(__dirname, "..", "README.md"),
  "utf8",
);

test("startup configuration validation rejects missing required variables without exposing values", () => {
  assert.deepEqual(REQUIRED_ENVIRONMENT_VARIABLES, ["MONGO_URI", "SESSION_SECRET"]);
  assert.throws(
    () => validateRequiredEnvironment({ MONGO_URI: "", SESSION_SECRET: "" }),
    /MONGO_URI, SESSION_SECRET/,
  );
  assert.throws(
    () =>
      validateRequiredEnvironment({
        MONGO_URI: "mongodb://secret.example",
        SESSION_SECRET: "",
      }),
    (error) =>
      error.message.includes("SESSION_SECRET") &&
      !error.message.includes("mongodb://secret.example"),
  );
  assert.doesNotThrow(() =>
    validateRequiredEnvironment({
      MONGO_URI: "mongodb://example.test/helpdesk",
      SESSION_SECRET: "a-long-test-secret",
    }),
  );
});

test("GridFS orphan cleanup is not activated automatically", () => {
  assert.doesNotMatch(appSource, /cleanupOrphanedAttachments\s*\(/);
  assert.match(readme, /Orphan cleanup is intentionally not run automatically/);
  assert.match(readme, /upload grace period/);
});

test("integration database configuration fails closed for unsafe targets", () => {
  assert.throws(
    () =>
      getIntegrationMongoUri({
        INTEGRATION_MONGO_URI:
          "mongodb://127.0.0.1:27017/campus_helpdesk_test_local",
        MONGO_URI:
          "mongodb://127.0.0.1:27017/campus_helpdesk_test_local",
      }),
    /different from MONGO_URI/,
  );
  assert.throws(
    () =>
      getIntegrationMongoUri({
        INTEGRATION_MONGO_URI:
          "mongodb://127.0.0.1:27017/ordinary-development-db",
      }),
    /must match campus_helpdesk_test/,
  );
});

test("integration database configuration accepts only an explicit disposable target", () => {
  assert.equal(
    getIntegrationMongoUri({
      INTEGRATION_MONGO_URI:
        "mongodb://127.0.0.1:27017/campus_helpdesk_test_local",
    }).databaseName,
    "campus_helpdesk_test_local",
  );
  assert.equal(getIntegrationMongoUri({}), null);
});
