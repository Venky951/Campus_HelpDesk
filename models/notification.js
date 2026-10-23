const mongoose = require("mongoose");

const notificationTypes = [
  "TICKET_CREATED",
  "STATUS_UPDATED",
  "PRIORITY_UPDATED",
  "ADMIN_COMMENT",
  "STUDENT_COMMENT",
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RaiseTicket",
      required: true,
    },
    type: { type: String, enum: notificationTypes, required: true },
    message: { type: String, required: true, trim: true, maxlength: 240 },
    eventKey: { type: String, required: true, maxlength: 180 },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, eventKey: 1 }, { unique: true });

module.exports = mongoose.model("Notification", notificationSchema);
