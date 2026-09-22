const mongoose = require("mongoose");
const {
  departments,
  ticketStatuses,
  ticketPriorities,
} = require("../utils/validation");

const raiseTicketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    category: { type: String, required: true, enum: departments, trim: true },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: ticketStatuses,
      default: "Open",
    },
    priority: {
      type: String,
      enum: ticketPriorities,
      default: "Medium",
      trim: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

raiseTicketSchema.index({ category: 1, createdAt: -1 });
raiseTicketSchema.index({ category: 1, status: 1, priority: 1, createdAt: -1 });

module.exports = mongoose.model("RaiseTicket", raiseTicketSchema);
