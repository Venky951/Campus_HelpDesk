const mongoose = require("mongoose");

const raiseTicketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  status: {
    type: String,
    enum: ["open", "in progress", "closed"],
    default: "open",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model("RaiseTicket", raiseTicketSchema);
