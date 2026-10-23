const Ticket = require("../models/raisetickect");
const { actions, recordTicketHistory } = require("../utils/ticket-history");
const { validationResult } = require("express-validator");
const {
  deleteAttachment,
  uploadAttachment,
  validateAttachment,
} = require("../utils/attachments");
const {
  notificationTypes,
  notifyAdmins,
  safelyNotify,
} = require("../utils/notifications");
const { getNotificationSummary } = require("../utils/notification-summary");

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
    const notificationSummary = await getNotificationSummary(
      req.authenticatedUser._id,
    );

    res.render("student/student", {
      title: "Student Dashboard",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,

      tickets: tickets,
      totalTickets: totalTickets,
      openTickets: openTickets,
      resolvedTickets: resolvedTickets,
      notificationSummary,
    });
  } catch (err) {
    next(err);
  }
};

exports.getRaiseTicket = async (req, res, next) => {
  try {
    const notificationSummary = await getNotificationSummary(
      req.authenticatedUser._id,
    );
    res.render("student/raiseticket", {
      title: "Raise Ticket",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
      errors: [],
      notificationSummary,
    });
  } catch (error) {
    next(error);
  }
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

      const history = await recordTicketHistory({
        ticket: ticket._id,
        actor: req.authenticatedUser._id,
        actorRole: "student",
        action: actions.CREATED,
      });
      await safelyNotify(
        notifyAdmins({
          department: ticket.category,
          ticket: ticket._id,
          type: notificationTypes.TICKET_CREATED,
          message: `New ticket submitted: ${ticket.title}`,
          eventKey: `ticket-created:${history._id}`,
        }),
      );
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
