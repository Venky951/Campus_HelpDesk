const User = require("../models/register");
const Notification = require("../models/notification");

const notificationTypes = Object.freeze({
  TICKET_CREATED: "TICKET_CREATED",
  STATUS_UPDATED: "STATUS_UPDATED",
  PRIORITY_UPDATED: "PRIORITY_UPDATED",
  ADMIN_COMMENT: "ADMIN_COMMENT",
  STUDENT_COMMENT: "STUDENT_COMMENT",
  ASSIGNMENT_UPDATED: "ASSIGNMENT_UPDATED",
  RESOLUTION_CONFIRMED: "RESOLUTION_CONFIRMED",
  TICKET_REOPENED: "TICKET_REOPENED",
  FEEDBACK_SUBMITTED: "FEEDBACK_SUBMITTED",
});

const createForRecipients = async ({
  recipients,
  ticket,
  type,
  message,
  eventKey,
  NotificationModel = Notification,
}) => {
  if (!recipients.length) return;

  await NotificationModel.bulkWrite(
    recipients.map((recipient) => {
      const recipientEventKey = `${eventKey}:${recipient}`;
      return {
        updateOne: {
          filter: { recipient, eventKey: recipientEventKey },
          update: {
            $setOnInsert: {
              recipient,
              ticket,
              type,
              message,
              eventKey: recipientEventKey,
              isRead: false,
            },
          },
          upsert: true,
        },
      };
    }),
  );
};

const notifyAdmins = async ({
  department,
  ticket,
  type,
  message,
  eventKey,
  exclude,
  UserModel = User,
  NotificationModel = Notification,
}) => {
  const admins = await UserModel.find({
    role: "admin",
    department,
    ...(exclude ? { _id: { $ne: exclude } } : {}),
  })
    .select("_id")
    .lean();

  await createForRecipients({
    recipients: admins.map((admin) => admin._id),
    ticket,
    type,
    message,
    eventKey,
    NotificationModel,
  });
};

const notifyStudent = async ({
  student,
  ticket,
  type,
  message,
  eventKey,
  NotificationModel = Notification,
}) =>
  createForRecipients({
    recipients: [student],
    ticket,
    type,
    message,
    eventKey,
    NotificationModel,
  });

const notifyUser = async ({
  recipient,
  ticket,
  type,
  message,
  eventKey,
  NotificationModel = Notification,
}) =>
  createForRecipients({
    recipients: [recipient],
    ticket,
    type,
    message,
    eventKey,
    NotificationModel,
  });

const safelyNotify = (notificationPromise) =>
  notificationPromise.catch((error) => {
    console.error(
      "Notification creation failed:",
      error.name || "Error",
      error.message,
    );
  });

module.exports = {
  notificationTypes,
  notifyAdmins,
  notifyStudent,
  notifyUser,
  safelyNotify,
};
