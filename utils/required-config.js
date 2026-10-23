const REQUIRED_ENVIRONMENT_VARIABLES = ["MONGO_URI", "SESSION_SECRET"];

const validateRequiredEnvironment = (environment = process.env) => {
  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter(
    (name) =>
      typeof environment[name] !== "string" || environment[name].trim() === "",
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Set them before starting Campus HelpDesk.",
    );
  }
};

module.exports = {
  REQUIRED_ENVIRONMENT_VARIABLES,
  validateRequiredEnvironment,
};
