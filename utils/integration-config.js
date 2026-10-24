const { URL } = require("node:url");

const TEST_DATABASE_PATTERN = /^campus_helpdesk_test_[a-z0-9_-]+$/;

const getIntegrationMongoUri = (environment = process.env) => {
  const value = environment.INTEGRATION_MONGO_URI;
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("INTEGRATION_MONGO_URI must be a valid MongoDB URI");
  }

  if (!["mongodb:", "mongodb+srv:"].includes(parsed.protocol)) {
    throw new Error("INTEGRATION_MONGO_URI must use the MongoDB protocol");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!TEST_DATABASE_PATTERN.test(databaseName)) {
    throw new Error(
      "INTEGRATION_MONGO_URI database name must match campus_helpdesk_test_<name>",
    );
  }

  const regularUri = environment.MONGO_URI;
  if (typeof regularUri === "string" && regularUri.trim() !== "") {
    let regularDatabaseName = "";
    try {
      regularDatabaseName = decodeURIComponent(
        new URL(regularUri).pathname.replace(/^\/+/, ""),
      );
    } catch {
      regularDatabaseName = "";
    }

    if (value === regularUri || databaseName === regularDatabaseName) {
      throw new Error(
        "INTEGRATION_MONGO_URI must target a database different from MONGO_URI",
      );
    }
  }

  return { uri: value, databaseName };
};

module.exports = { TEST_DATABASE_PATTERN, getIntegrationMongoUri };
