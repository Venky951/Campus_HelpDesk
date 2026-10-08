const assert = require("node:assert/strict");
const express = require("express");
const session = require("express-session");
const test = require("node:test");
const request = require("supertest");
const { csrfSync } = require("csrf-sync");
const attachmentUpload = require("../middleware/attachment-upload");
const {
  MAX_ATTACHMENT_SIZE,
  validateAttachment,
} = require("../utils/attachments");
const {
  adminAttachmentQuery,
  studentAttachmentQuery,
} = require("../utils/attachment-access");

const student = { id: "student-1", role: "student", department: "IT" };
const otherStudent = { id: "student-2", role: "student", department: "IT" };
const itAdmin = { id: "admin-1", role: "admin", department: "IT" };
const hostelAdmin = { id: "admin-2", role: "admin", department: "Hostel" };

const validPdf = Buffer.from("%PDF-1.7\nattachment");

const createHarness = () => {
  const app = express();
  const tickets = new Map();
  const gridfs = new Map();
  let nextTicketId = 1;
  const { csrfSynchronisedProtection, generateToken } = csrfSync({
    getTokenFromRequest: (req) => req.body?._csrf,
  });

  app.use(
    session({
      secret: "integration-test-secret",
      resave: false,
      saveUninitialized: true,
    }),
  );
  app.get("/form", (req, res) => {
    res.send(generateToken(req));
  });
  app.use((req, res, next) => {
    if (req.method === "POST" && req.path === "/student/raiseticket") {
      return attachmentUpload(req, res, next);
    }
    next();
  });
  app.use(csrfSynchronisedProtection);
  app.use((req, res, next) => {
    req.authenticatedUser = req.session.user;
    next();
  });

  app.post("/student/raiseticket", (req, res) => {
    if (!req.authenticatedUser || req.authenticatedUser.role !== "student") {
      return res.sendStatus(403);
    }
    if (!req.file || !validateAttachment(req.file).valid) {
      return res.sendStatus(422);
    }

    const id = String(nextTicketId++);
    const fileId = `gridfs-${id}`;
    gridfs.set(fileId, req.file.buffer);
    tickets.set(id, {
      id,
      student: req.authenticatedUser.id,
      category: req.body.category,
      attachment: { fileId, contentType: req.file.mimetype, size: req.file.size },
    });
    res.status(201).send(id);
  });

  const download = (role) => (req, res) => {
    const user = req.session.user;
    const query =
      role === "student"
        ? studentAttachmentQuery(req.params.id, user?.id)
        : adminAttachmentQuery(req.params.id, user?.department);
    const ticket = [...tickets.values()].find(
      (candidate) =>
        candidate.id === query._id &&
        candidate[role === "student" ? "student" : "category"] ===
          query[role === "student" ? "student" : "category"],
    );
    if (!ticket || !ticket.attachment || !gridfs.has(ticket.attachment.fileId)) {
      return res.sendStatus(404);
    }
    res.type(ticket.attachment.contentType).send(gridfs.get(ticket.attachment.fileId));
  };

  app.get("/student/ticket/:id/attachment", (req, res) =>
    download("student")(req, res),
  );
  app.get("/admin/ticket/:id/attachment", (req, res) =>
    download("admin")(req, res),
  );
  app.use((error, req, res, next) => {
    if (error.code === "EBADCSRFTOKEN") {
      return res.sendStatus(403);
    }
    next(error);
  });

  return { app, gridfs, tickets };
};

const loginAs = (agent, user) =>
  agent.get("/login-as").set("X-Test-User", JSON.stringify(user));

test("student creates a ticket with a valid attachment and CSRF token", async () => {
  const harness = createHarness();
  harness.app.get("/login-as", (req, res) => {
    req.session.user = JSON.parse(req.get("X-Test-User"));
    res.sendStatus(204);
  });
  const agent = request.agent(harness.app);
  await loginAs(agent, student);
  const csrf = await agent.get("/form");

  const response = await agent
    .post("/student/raiseticket")
    .field("_csrf", csrf.text)
    .field("category", "IT")
    .attach("attachment", validPdf, "report.pdf");

  assert.equal(response.status, 201);
  assert.equal(harness.tickets.size, 1);
  assert.equal(harness.gridfs.size, 1);
});

test("missing or invalid CSRF creates no ticket or GridFS file", async () => {
  const harness = createHarness();
  harness.app.get("/login-as", (req, res) => {
    req.session.user = student;
    res.sendStatus(204);
  });
  const agent = request.agent(harness.app);
  await agent.get("/login-as");

  for (const token of [undefined, "invalid-token"]) {
    const upload = agent
      .post("/student/raiseticket")
      .field("category", "IT")
      .attach("attachment", validPdf, "report.pdf");
    if (token) upload.field("_csrf", token);
    const response = await upload;
    assert.equal(response.status, 403);
  }
  assert.equal(harness.tickets.size, 0);
  assert.equal(harness.gridfs.size, 0);
});

test("only the owner or department admin can download an attachment", async () => {
  const harness = createHarness();
  harness.app.get("/login-as", (req, res) => {
    req.session.user = JSON.parse(req.get("X-Test-User"));
    res.sendStatus(204);
  });
  const agent = request.agent(harness.app);
  await loginAs(agent, student);
  const csrf = await agent.get("/form");
  const created = await agent
    .post("/student/raiseticket")
    .field("_csrf", csrf.text)
    .field("category", "IT")
    .attach("attachment", validPdf, "report.pdf");
  const ticketId = created.text;

  await loginAs(agent, student);
  assert.equal((await agent.get(`/student/ticket/${ticketId}/attachment`)).status, 200);
  await loginAs(agent, otherStudent);
  assert.equal((await agent.get(`/student/ticket/${ticketId}/attachment`)).status, 404);
  await loginAs(agent, itAdmin);
  assert.equal((await agent.get(`/admin/ticket/${ticketId}/attachment`)).status, 200);
  await loginAs(agent, hostelAdmin);
  assert.equal((await agent.get(`/admin/ticket/${ticketId}/attachment`)).status, 404);
});

test("oversized and unsupported uploads are rejected", async () => {
  const harness = createHarness();
  harness.app.get("/login-as", (req, res) => {
    req.session.user = student;
    res.sendStatus(204);
  });
  const agent = request.agent(harness.app);
  await agent.get("/login-as");
  const csrf = await agent.get("/form");

  const oversized = await agent
    .post("/student/raiseticket")
    .field("_csrf", csrf.text)
    .field("category", "IT")
    .attach("attachment", Buffer.alloc(MAX_ATTACHMENT_SIZE + 1), "large.pdf");
  assert.equal(oversized.status, 422);

  const unsupported = await agent
    .post("/student/raiseticket")
    .field("_csrf", csrf.text)
    .field("category", "IT")
    .attach("attachment", Buffer.from("MZ"), "program.exe");
  assert.equal(unsupported.status, 422);
  assert.equal(harness.tickets.size, 0);
  assert.equal(harness.gridfs.size, 0);
});

test("tickets without attachments remain downloadable as normal ticket records", () => {
  const harness = createHarness();
  harness.tickets.set("legacy-1", {
    id: "legacy-1",
    student: student.id,
    category: "IT",
  });
  assert.equal(harness.tickets.get("legacy-1").attachment, undefined);
});
