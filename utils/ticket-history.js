const TicketHistory = require("../models/ticket-history");

const actions = Object.freeze({
  CREATED: "CREATED",
  STATUS_CHANGED: "STATUS_CHANGED",
  PRIORITY_CHANGED: "PRIORITY_CHANGED",
  COMMENT_ADDED: "COMMENT_ADDED",
});

const recordTicketHistory = ({ ticket, actor, actorRole, action, details }) =>
  TicketHistory.create({
    ticket,
    actor,
    actorRole,
    action,
    details,
  });

module.exports = { actions, recordTicketHistory };
