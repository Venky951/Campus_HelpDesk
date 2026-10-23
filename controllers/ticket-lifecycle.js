const Ticket = require("../models/raisetickect");
const { actions, recordTicketHistory } = require("../utils/ticket-history");
const { validationResult } = require("express-validator");
const {
  notificationTypes,
  notifyAdmins,
  safelyNotify,
} = require("../utils/notifications");

const MAX_REOPEN_REASON_LENGTH = 2000;
const MAX_FEEDBACK_COMMENT_LENGTH = 2000;

const studentTicketQuery = (ticketId, studentId) => ({
  _id: ticketId,
  student: studentId,
});

const redirectToTicket = (ticketId) => `/student/ticket/${ticketId}`;

const recordAndNotify = async ({
  ticket,
  actor,
  action,
  details,
  type,
  message,
  eventPrefix,
}) => {
  const history = await recordTicketHistory({
    ticket: ticket._id,
    actor,
    actorRole: "student",
    action,
    details,
  });
  await safelyNotify(
    notifyAdmins({
      department: ticket.category,
      ticket: ticket._id,
      type,
      message,
      eventKey: `${eventPrefix}:${history._id}`,
      exclude: actor,
    }),
  );
  return history;
};

exports.confirmResolution = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).send("Invalid confirmation");

    const confirmedAt = new Date();
    const ticket = await Ticket.findOneAndUpdate(
      {
        ...studentTicketQuery(req.params.id, req.authenticatedUser._id),
        status: "Resolved",
        resolutionConfirmedAt: null,
      },
      { $set: { resolutionConfirmedAt: confirmedAt } },
      { returnDocument: "after" },
    );

    if (!ticket) {
      const existing = await Ticket.findOne(
        studentTicketQuery(req.params.id, req.authenticatedUser._id),
      ).select("status resolutionConfirmedAt");
      if (!existing) return res.status(404).send("Ticket not found");
      if (existing.status !== "Resolved") {
        return res.status(422).send("Only resolved tickets can be confirmed");
      }
      return res.redirect(redirectToTicket(existing._id));
    }

    try {
      await recordAndNotify({
        ticket,
        actor: req.authenticatedUser._id,
        action: actions.RESOLUTION_CONFIRMED,
        details: { confirmedAt },
        type: notificationTypes.RESOLUTION_CONFIRMED,
        message: `Resolution confirmed by the student: ${ticket.title}`,
        eventPrefix: "resolution-confirmed",
      });
    } catch (error) {
      await Ticket.updateOne(
        {
          _id: ticket._id,
          resolutionConfirmedAt: confirmedAt,
        },
        { $set: { resolutionConfirmedAt: null } },
      );
      throw error;
    }

    res.redirect(redirectToTicket(ticket._id));
  } catch (error) {
    if (error.name === "CastError") return res.status(404).send("Ticket not found");
    next(error);
  }
};

exports.reopenTicket = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).send("Invalid reopening reason");

    const reason = req.body.reason.trim();
    const reopenedAt = new Date();
    const ticket = await Ticket.findOneAndUpdate(
      {
        ...studentTicketQuery(req.params.id, req.authenticatedUser._id),
        status: "Resolved",
        resolutionConfirmedAt: null,
      },
      {
        $set: {
          status: "Open",
          lastReopenedAt: reopenedAt,
        },
        $inc: { reopenCount: 1 },
      },
      { returnDocument: "after" },
    );

    if (!ticket) {
      const existing = await Ticket.findOne(
        studentTicketQuery(req.params.id, req.authenticatedUser._id),
      ).select("status resolutionConfirmedAt");
      if (!existing) return res.status(404).send("Ticket not found");
      if (existing.status !== "Resolved") {
        return res.status(422).send("Only resolved tickets can be reopened");
      }
      return res.status(422).send("Confirmed resolutions cannot be reopened");
    }

    try {
      await recordAndNotify({
        ticket,
        actor: req.authenticatedUser._id,
        action: actions.REOPENED,
        details: { from: "Resolved", to: "Open", reason },
        type: notificationTypes.TICKET_REOPENED,
        message: `Ticket reopened by the student: ${ticket.title}`,
        eventPrefix: "ticket-reopened",
      });
    } catch (error) {
      await Ticket.updateOne(
        {
          _id: ticket._id,
          status: "Open",
          lastReopenedAt: reopenedAt,
        },
        {
          $set: { status: "Resolved", lastReopenedAt: null },
          $inc: { reopenCount: -1 },
        },
      );
      throw error;
    }

    res.redirect(redirectToTicket(ticket._id));
  } catch (error) {
    if (error.name === "CastError") return res.status(404).send("Ticket not found");
    next(error);
  }
};

exports.submitFeedback = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).send("Invalid feedback");

    const feedbackComment = (req.body.feedbackComment || "").trim();
    const submittedAt = new Date();
    const ticket = await Ticket.findOneAndUpdate(
      {
        ...studentTicketQuery(req.params.id, req.authenticatedUser._id),
        status: "Resolved",
        resolutionConfirmedAt: { $ne: null },
        feedbackSubmittedAt: null,
      },
      {
        $set: {
          feedbackRating: Number(req.body.feedbackRating),
          feedbackComment,
          feedbackSubmittedAt: submittedAt,
        },
      },
      { returnDocument: "after" },
    );

    if (!ticket) {
      const existing = await Ticket.findOne(
        studentTicketQuery(req.params.id, req.authenticatedUser._id),
      ).select("status resolutionConfirmedAt feedbackSubmittedAt");
      if (!existing) return res.status(404).send("Ticket not found");
      if (existing.status !== "Resolved" || !existing.resolutionConfirmedAt) {
        return res.status(422).send("Confirm the resolution before leaving feedback");
      }
      return res.redirect(redirectToTicket(existing._id));
    }

    try {
      await recordAndNotify({
        ticket,
        actor: req.authenticatedUser._id,
        action: actions.FEEDBACK_SUBMITTED,
        details: {
          rating: ticket.feedbackRating,
          comment: ticket.feedbackComment,
          submittedAt,
        },
        type: notificationTypes.FEEDBACK_SUBMITTED,
        message: `Student feedback submitted: ${ticket.title}`,
        eventPrefix: "feedback-submitted",
      });
    } catch (error) {
      await Ticket.updateOne(
        {
          _id: ticket._id,
          feedbackSubmittedAt: submittedAt,
        },
        {
          $set: {
            feedbackRating: null,
            feedbackComment: null,
            feedbackSubmittedAt: null,
          },
        },
      );
      throw error;
    }

    res.redirect(redirectToTicket(ticket._id));
  } catch (error) {
    if (error.name === "CastError") return res.status(404).send("Ticket not found");
    next(error);
  }
};

module.exports = {
  ...module.exports,
  MAX_REOPEN_REASON_LENGTH,
  MAX_FEEDBACK_COMMENT_LENGTH,
};
