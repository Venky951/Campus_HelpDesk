const assert = require("node:assert/strict");
const test = require("node:test");
const {
  notificationTypes,
  notifyAdmins,
  notifyStudent,
} = require("../utils/notifications");

const createFakes = () => {
  const operations = [];
  return {
    operations,
    UserModel: {
      find() {
        return {
          select() {
            return {
              lean: async () => [{ _id: "admin-1" }, { _id: "admin-2" }],
            };
          },
        };
      },
    },
    NotificationModel: {
      bulkWrite: async (batch) => operations.push(...batch),
    },
  };
};

test("ticket creation notifies every admin in the department", async () => {
  const fakes = createFakes();
  await notifyAdmins({
    department: "IT",
    ticket: "ticket-1",
    type: notificationTypes.TICKET_CREATED,
    message: "New ticket",
    eventKey: "ticket-created:history-1",
    UserModel: fakes.UserModel,
    NotificationModel: fakes.NotificationModel,
  });

  assert.equal(fakes.operations.length, 2);
  assert.deepEqual(
    fakes.operations.map((operation) => operation.updateOne.filter.recipient),
    ["admin-1", "admin-2"],
  );
});

test("notification upserts use recipient-scoped event keys for deduplication", async () => {
  const fakes = createFakes();
  await notifyStudent({
    student: "student-1",
    ticket: "ticket-1",
    type: notificationTypes.STATUS_UPDATED,
    message: "Status updated",
    eventKey: "status-updated:history-1",
    NotificationModel: fakes.NotificationModel,
  });

  const operation = fakes.operations[0].updateOne;
  assert.equal(operation.upsert, true);
  assert.deepEqual(operation.filter, {
    recipient: "student-1",
    eventKey: "status-updated:history-1:student-1",
  });
});
