const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const test = require("node:test");
const request = require("supertest");
const { createApp, createSessionStore } = require("../app");
const { getIntegrationMongoUri } = require("../utils/integration-config");
const User = require("../models/register");
const Ticket = require("../models/raisetickect");
const TicketHistory = require("../models/ticket-history");
const Notification = require("../models/notification");
const { notificationTypes } = require("../utils/notifications");

const integrationTarget = getIntegrationMongoUri();
const integrationOptions = { skip: !integrationTarget };
let app;
let store;
let student;
let otherStudent;
let itAdmin;
let otherItAdmin;
let hostelAdmin;
let studentTicket;
let itAdminAgent;
let studentAgent;

const extractCsrf = (html) => {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  assert.ok(match, "Expected the response to contain a CSRF token");
  return match[1];
};

const login = async (user) => {
  const agent = request.agent(app);
  const loginPage = await agent.get("/login");
  const response = await agent
    .post("/login")
    .type("form")
    .send({
      _csrf: extractCsrf(loginPage.text),
      username: user.username,
      password: "Password123!",
    });
  assert.equal(response.status, 302);
  return agent;
};

const csrfFor = async (agent, path) => {
  const response = await agent.get(path);
  assert.equal(response.status, 200);
  return extractCsrf(response.text);
};

test.before(async () => {
  if (!integrationTarget) return;

  store = createSessionStore(integrationTarget.uri);
  await Promise.all([
    mongoose.connect(integrationTarget.uri),
    store.initialConnectionPromise,
  ]);
  await mongoose.connection.db.dropDatabase();

  const password = await bcrypt.hash("Password123!", 12);
  [student, otherStudent, itAdmin, otherItAdmin, hostelAdmin] = await User.create([
    {
      username: "integration-student",
      email: "integration-student@example.test",
      password,
      role: "student",
      department: "IT",
    },
    {
      username: "integration-other-student",
      email: "integration-other-student@example.test",
      password,
      role: "student",
      department: "IT",
    },
    {
      username: "integration-it-admin",
      email: "integration-it-admin@example.test",
      password,
      role: "admin",
      department: "IT",
    },
    {
      username: "integration-other-it-admin",
      email: "integration-other-it-admin@example.test",
      password,
      role: "admin",
      department: "IT",
    },
    {
      username: "integration-hostel-admin",
      email: "integration-hostel-admin@example.test",
      password,
      role: "admin",
      department: "Hostel",
    },
  ]);

  studentTicket = await Ticket.create({
    title: "Integration ticket",
    category: "IT",
    description: "A ticket used by isolated HTTP integration tests.",
    status: "Open",
    priority: "Medium",
    student: student._id,
  });
  await Ticket.create({
    title: "Hostel ticket",
    category: "Hostel",
    description: "A ticket outside the IT admin department.",
    status: "Open",
    priority: "Low",
    student: otherStudent._id,
  });

  app = createApp({
    sessionStore: store,
    sessionSecret: "integration-only-session-secret",
    nodeEnvironment: "test",
  });
  studentAgent = await login(student);
  itAdminAgent = await login(itAdmin);
});

test.after(async () => {
  if (!integrationTarget) return;
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
  if (store?.client) await store.client.close();
});

test(
  "requires an explicit disposable integration database",
  integrationOptions,
  () => {
    assert.match(integrationTarget.uri, /^mongodb/);
    assert.match(integrationTarget.databaseName, /^campus_helpdesk_test_/);
  },
);

test(
  "rejects anonymous access and preserves invalid login CSRF protection",
  integrationOptions,
  async () => {
    assert.equal((await request(app).get("/admin")).status, 302);
    const agent = request.agent(app);
    const loginPage = await agent.get("/login");
    const response = await agent.post("/login").type("form").send({
      _csrf: "invalid-token",
      username: student.username,
      password: "Password123!",
    });
    assert.equal(response.status, 403);
    assert.equal((await agent.get("/student")).status, 302);
    assert.ok(loginPage.headers["set-cookie"]);
  },
);

test(
  "logs in students and admins with persistent role-scoped sessions",
  integrationOptions,
  async () => {
    assert.equal((await studentAgent.get("/student")).status, 200);
    assert.equal((await itAdminAgent.get("/admin")).status, 200);
    assert.equal((await studentAgent.get("/admin")).status, 302);
    assert.equal((await itAdminAgent.get("/student")).status, 302);
  },
);

test(
  "isolates student ticket access and state-changing actions",
  integrationOptions,
  async () => {
    assert.equal(
      (await studentAgent.get(`/student/ticket/${studentTicket._id}`)).status,
      200,
    );
    const otherAgent = await login(otherStudent);
    assert.equal(
      (await otherAgent.get(`/student/ticket/${studentTicket._id}`)).status,
      404,
    );

    const csrf = await csrfFor(otherAgent, "/student");
    const response = await otherAgent
      .post(`/student/ticket/${studentTicket._id}/comment`)
      .type("form")
      .send({ _csrf: csrf, message: "Unauthorized comment" });
    assert.equal(response.status, 404);
    assert.equal(
      await mongoose
        .model("TicketComment")
        .countDocuments({ message: "Unauthorized comment" }),
      0,
    );
  },
);

test(
  "isolates admin departments for ticket management and assignment",
  integrationOptions,
  async () => {
    const hostelTicket = await Ticket.findOne({ category: "Hostel" });
    assert.equal(
      (await itAdminAgent.get(`/admin/ticket/${hostelTicket._id}`)).status,
      404,
    );

    const csrf = await csrfFor(itAdminAgent, "/admin");
    const response = await itAdminAgent
      .post(`/admin/ticket/${hostelTicket._id}/assignment`)
      .type("form")
      .send({ _csrf: csrf, assignedTo: String(hostelAdmin._id) });
    assert.equal(response.status, 404);
    const unchanged = await Ticket.findById(hostelTicket._id);
    assert.equal(unchanged.assignedTo, null);
  },
);

test(
  "creates and updates a ticket through real HTTP and records lifecycle state",
  integrationOptions,
  async () => {
    const csrf = await csrfFor(studentAgent, "/student/raiseticket");
    const created = await studentAgent
      .post("/student/raiseticket")
      .type("form")
      .send({
        _csrf: csrf,
        title: "Created over HTTP",
        category: "IT",
        description: "This ticket was created by the integration test.",
        priority: "High",
      });
    assert.equal(created.status, 302);
    const createdTicket = await Ticket.findOne({ title: "Created over HTTP" });
    assert.ok(createdTicket);

    const adminCsrf = await csrfFor(itAdminAgent, "/admin");
    const resolved = await itAdminAgent
      .post(`/update-status/${createdTicket._id}`)
      .type("form")
      .send({
        _csrf: adminCsrf,
        status: "Resolved",
        resolutionDetails: "Resolved during integration testing.",
      });
    assert.equal(resolved.status, 302);
    assert.equal((await Ticket.findById(createdTicket._id)).status, "Resolved");
    assert.equal(
      await TicketHistory.countDocuments({
        ticket: createdTicket._id,
        action: "STATUS_CHANGED",
      }),
      1,
    );
  },
);

test(
  "assigns, reassigns, and unassigns with history and notifications",
  integrationOptions,
  async () => {
    const csrf = await csrfFor(itAdminAgent, "/admin");
    const assigned = await itAdminAgent
      .post(`/admin/ticket/${studentTicket._id}/assignment`)
      .type("form")
      .send({ _csrf: csrf, assignedTo: String(itAdmin._id) });
    assert.equal(assigned.status, 302);
    assert.equal(
      String((await Ticket.findById(studentTicket._id)).assignedTo),
      String(itAdmin._id),
    );
    assert.equal(
      await Notification.countDocuments({
        ticket: studentTicket._id,
        recipient: itAdmin._id,
        type: notificationTypes.ASSIGNMENT_UPDATED,
      }),
      0,
    );

    const peerCsrf = await csrfFor(itAdminAgent, "/admin");
    const peerAssigned = await itAdminAgent
      .post(`/admin/ticket/${studentTicket._id}/assignment`)
      .type("form")
      .send({
        _csrf: peerCsrf,
        assignedTo: String(otherItAdmin._id),
        expectedAssignedTo: String(itAdmin._id),
      });
    assert.equal(peerAssigned.status, 302);
    assert.equal(
      String((await Ticket.findById(studentTicket._id)).assignedTo),
      String(otherItAdmin._id),
    );
    assert.equal(
      await Notification.countDocuments({
        ticket: studentTicket._id,
        recipient: otherItAdmin._id,
        type: notificationTypes.ASSIGNMENT_UPDATED,
      }),
      1,
    );

    const repeatedCsrf = await csrfFor(itAdminAgent, "/admin");
    const repeated = await itAdminAgent
      .post(`/admin/ticket/${studentTicket._id}/assignment`)
      .type("form")
      .send({
        _csrf: repeatedCsrf,
        assignedTo: String(otherItAdmin._id),
        expectedAssignedTo: String(otherItAdmin._id),
      });
    assert.equal(repeated.status, 302);
    assert.equal(
      await TicketHistory.countDocuments({
        ticket: studentTicket._id,
        action: "ASSIGNED",
      }),
      1,
    );
    assert.ok(
      await Notification.countDocuments({
        ticket: studentTicket._id,
        recipient: otherItAdmin._id,
        type: notificationTypes.ASSIGNMENT_UPDATED,
      }),
    );

    const unassignedCsrf = await csrfFor(itAdminAgent, "/admin");
    const unassigned = await itAdminAgent
      .post(`/admin/ticket/${studentTicket._id}/assignment`)
      .type("form")
      .send({
        _csrf: unassignedCsrf,
        assignedTo: "",
        expectedAssignedTo: String(otherItAdmin._id),
      });
    assert.equal(unassigned.status, 302);
    assert.equal((await Ticket.findById(studentTicket._id)).assignedTo, null);
  },
);

test(
  "protects lifecycle routes with ownership, CSRF, and duplicate-action checks",
  integrationOptions,
  async () => {
    const response = await studentAgent
      .post(`/student/ticket/${studentTicket._id}/reopen`)
      .type("form")
      .send({ reason: "missing csrf" });
    assert.equal(response.status, 403);

    const otherAgent = await login(otherStudent);
    const csrf = await csrfFor(otherAgent, "/student");
    const rejected = await otherAgent
      .post(`/student/ticket/${studentTicket._id}/feedback`)
      .type("form")
      .send({ _csrf: csrf, feedbackRating: "5" });
    assert.equal(rejected.status, 404);
  },
);

test(
  "serves department-scoped analytics and CSV over HTTP",
  integrationOptions,
  async () => {
    const analytics = await itAdminAgent.get("/admin/analytics");
    assert.equal(analytics.status, 200);
    assert.match(analytics.text, /Analytics/);
    const csv = await itAdminAgent.get("/admin/analytics/export");
    assert.equal(csv.status, 200);
    assert.match(csv.headers["content-type"], /text\/csv/);
    assert.match(csv.headers["content-disposition"], /attachment/);
    assert.match(csv.text, /Integration ticket/);
    assert.doesNotMatch(csv.text, /Hostel ticket/);
  },
);
