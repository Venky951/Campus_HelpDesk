const Ticket = require("../models/raisetickect");
const { actions, recordTicketHistory } = require("../utils/ticket-history");
const { validationResult } = require("express-validator");
const {
  deleteAttachment,
  uploadAttachment,
  validateAttachment,
} = require("../utils/attachments");

exports.getStudentDashboard = async (req, res, next) => {
  try {
    const studentId = req.session.user._id;

    // Get all tickets of logged-in student
    const tickets = await Ticket.find({
      student: studentId,
    }).sort({ createdAt: -1 });

    // Counts
    const totalTickets = tickets.length;

    const openTickets = tickets.filter(
      (ticket) => ticket.status === "Open",
    ).length;

    const resolvedTickets = tickets.filter(
      (ticket) => ticket.status === "Resolved",
    ).length;

    res.render("student/student", {
      title: "Student Dashboard",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,

      tickets: tickets,
      totalTickets: totalTickets,
      openTickets: openTickets,
      resolvedTickets: resolvedTickets,
    });
  } catch (err) {
    next(err);
  }
};

exports.getRaiseTicket = (req, res, next) => {
  res.render("student/raiseticket", {
    title: "Raise Ticket",
    isLoggedIn: req.isLoggedIn,
    user: req.session.user,
    errors: [],
  });
};
exports.postRaiseTicket = async (req, res, next) => {
  try {
    const { title, category, description, priority } = req.body || {};
    const errors = validationResult(req);

    const attachmentResult = req.attachmentUploadError
      ? { valid: false, message: "Attachment upload failed or exceeded the 5 MB limit" }
      : req.file
        ? validateAttachment(req.file)
        : { valid: true };

    if (!errors.isEmpty() || !attachmentResult.valid) {
      const requestErrors = errors.array();
      if (!attachmentResult.valid) requestErrors.push({ msg: attachmentResult.message });
      return res.status(422).render("student/raiseticket", {
        title: "Raise Ticket",
        isLoggedIn: req.isLoggedIn,
        user: req.session.user,
        errors: requestErrors,
      });
    }

    const ticket = new Ticket({
      title: title,
      category: category,
      description: description,
      status: "Open",
      priority: priority,
      student: req.session.user._id,
    });

    await ticket.save();

    let attachment;
    try {
      if (req.file) {
        attachment = await uploadAttachment(req.file, ticket._id);
        ticket.attachment = attachment;
        await ticket.save();
      }

      await recordTicketHistory({
        ticket: ticket._id,
        actor: req.authenticatedUser._id,
        actorRole: "student",
        action: actions.CREATED,
      });
    } catch (historyError) {
      await deleteAttachment(attachment?.fileId).catch(() => {});
      await Ticket.deleteOne({ _id: ticket._id });
      throw historyError;
    }

    res.redirect("/student");
  } catch (err) {
    next(err);
  }
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
};
