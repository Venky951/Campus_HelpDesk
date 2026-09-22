const mongoose = require("mongoose");

const ticketHistorySchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RaiseTicket",
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorRole: {
      type: String,
      enum: ["student", "admin"],
      required: true,
    },
    action: {
      type: String,
      enum: ["CREATED", "STATUS_CHANGED", "PRIORITY_CHANGED", "COMMENT_ADDED"],
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: true },
);

ticketHistorySchema.index({ ticket: 1, createdAt: 1 });

module.exports = mongoose.model("TicketHistory", ticketHistorySchema);
