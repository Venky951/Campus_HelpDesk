const Ticket = require("../models/raisetickect");
const TicketComment = require("../models/ticket-comment");
const TicketHistory = require("../models/ticket-history");
const { actions, recordTicketHistory } = require("../utils/ticket-history");
const { validationResult } = require("express-validator");
const { downloadAttachment } = require("../utils/attachments");
const {
  adminAttachmentQuery,
  studentAttachmentQuery,
} = require("../utils/attachment-access");

const loadComments = (ticketId) =>
  TicketComment.find({ ticket: ticketId })
    .populate("author", "username role")
    .sort({ createdAt: 1 });

const loadHistory = (ticketId) =>
  TicketHistory.find({ ticket: ticketId })
    .populate("actor", "username role")
    .sort({ createdAt: 1 });

const renderTicket = async (req, res, next, ticketQuery, view, backUrl) => {
  try {
    const ticket = await Ticket.findOne(ticketQuery).populate(
      "student",
      "username",
    );

    if (!ticket) {
      return res.status(404).send("Ticket not found");
    }

    const comments = await loadComments(ticket._id);
    const history = await loadHistory(ticket._id);
    res.render(view, {
      title: "Ticket Details",
      isLoggedIn: req.isLoggedIn,
      user: req.authenticatedUser,
      ticket,
      comments,
      history,
      backUrl,
      errors: [],
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).send("Ticket not found");
    }
    next(error);
  }
};

const addComment = async (req, res, next, ticketQuery, view, backUrl, role) => {
  try {
    const errors = validationResult(req);
    const ticket = await Ticket.findOne(ticketQuery).populate(
      "student",
      "username",
    );

    if (!ticket) {
      return res.status(404).send("Ticket not found");
    }

    if (!errors.isEmpty()) {
      const comments = await loadComments(ticket._id);
      const history = await loadHistory(ticket._id);
      return res.status(422).render(view, {
        title: "Ticket Details",
        isLoggedIn: req.isLoggedIn,
        user: req.authenticatedUser,
        ticket,
        comments,
        history,
        backUrl,
        errors: errors.array(),
      });
    }

    const comment = await TicketComment.create({
      ticket: ticket._id,
      author: req.authenticatedUser._id,
      authorRole: role,
      message: req.body.message.trim(),
    });

    try {
      await recordTicketHistory({
        ticket: ticket._id,
        actor: req.authenticatedUser._id,
        actorRole: role,
        action: actions.COMMENT_ADDED,
      });
    } catch (historyError) {
      await TicketComment.deleteOne({ _id: comment._id });
      throw historyError;
    }

    res.redirect(`${backUrl}/ticket/${ticket._id}`);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).send("Ticket not found");
    }
    next(error);
  }
};

exports.getStudentTicket = (req, res, next) =>
  renderTicket(
    req,
    res,
    next,
    { _id: req.params.id, student: req.authenticatedUser._id },
    "student/ticket",
    "/student",
  );

exports.postStudentComment = (req, res, next) =>
  addComment(
    req,
    res,
    next,
    { _id: req.params.id, student: req.authenticatedUser._id },
    "student/ticket",
    "/student",
    "student",
  );

exports.getAdminTicket = (req, res, next) =>
  renderTicket(
    req,
    res,
    next,
    { _id: req.params.id, category: req.authenticatedUser.department },
    "admin/ticket",
    "/admin",
  );

exports.postAdminComment = (req, res, next) =>
  addComment(
    req,
    res,
    next,
    { _id: req.params.id, category: req.authenticatedUser.department },
    "admin/ticket",
    "/admin",
    "admin",
  );

const sendAttachment = async (req, res, next, ticketQuery) => {
  try {
    const ticket = await Ticket.findOne(ticketQuery).select("attachment");
    if (!ticket || !ticket.attachment?.fileId) {
      return res.status(404).send("Attachment not found");
    }

    const stream = downloadAttachment(ticket.attachment.fileId);
    if (!stream) return res.status(404).send("Attachment not found");

    res.setHeader("Content-Type", ticket.attachment.contentType);
    res.setHeader("Content-Length", ticket.attachment.size);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${ticket.attachment.filename.replace(/["\r\n]/g, "_")}"`,
    );
    stream.once("error", (error) => {
      if (!res.headersSent) next(error);
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    if (error.name === "CastError") return res.status(404).send("Attachment not found");
    next(error);
  }
};

exports.downloadStudentAttachment = (req, res, next) =>
  sendAttachment(
    req,
    res,
    next,
    studentAttachmentQuery(req.params.id, req.authenticatedUser._id),
  );

exports.downloadAdminAttachment = (req, res, next) =>
  sendAttachment(
    req,
    res,
    next,
    adminAttachmentQuery(req.params.id, req.authenticatedUser.department),
  );
