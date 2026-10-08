const assert = require("node:assert/strict");
const express = require("express");
const session = require("express-session");
const test = require("node:test");
const request = require("supertest");
const { csrfSync } = require("csrf-sync");

const createLoginHarness = () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.urlencoded({ extended: false }));
  app.use(
    session({
      secret: "login-csrf-test-secret",
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    }),
  );

  const { csrfSynchronisedProtection, generateToken } = csrfSync({
    getTokenFromRequest: (req) => req.body?._csrf,
  });

  app.get("/login", (req, res, next) => {
    generateToken(req);
    req.session.save((error) => {
      if (error) return next(error);
      res.status(200).send(req.session.csrfToken);
    });
    app.get("/state", (req, res) => res.send(req.session.csrfToken || ""));
  });
  app.post("/login", csrfSynchronisedProtection, (req, res) => {
    req.session.regenerate((error) => {
      if (error) return res.sendStatus(500);
      res.sendStatus(204);
    });
  });
  app.use((error, req, res, next) => {
    if (error.code === "EBADCSRFTOKEN") return res.sendStatus(403);
    next(error);
  });

  return app;
};

test("login CSRF token survives the Render proxy session", async () => {
  const app = createLoginHarness();
  const agent = request.agent(app);
  const loginPage = await agent.get("/login").set("X-Forwarded-Proto", "https");
  const csrfToken = loginPage.text;

  assert.equal(loginPage.status, 200);
  assert.match(loginPage.headers["set-cookie"].join(";"), /connect\.sid=/);

  const sessionCookie = loginPage.headers["set-cookie"]
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
  const state = await request(app).get("/state").set("Cookie", sessionCookie);
  assert.equal(state.text, csrfToken);
  const response = await request(app)
    .post("/login")
    .set("X-Forwarded-Proto", "https")
    .set("Cookie", sessionCookie)
    .type("form")
    .send({ _csrf: csrfToken });

  assert.equal(response.status, 204);
});

test("invalid login CSRF token is rejected before session regeneration", async () => {
  const agent = request.agent(createLoginHarness());
  await agent.get("/login").set("X-Forwarded-Proto", "https");

  const response = await agent
    .post("/login")
    .set("X-Forwarded-Proto", "https")
    .send({ _csrf: "invalid-token" });

  assert.equal(response.status, 403);
});
