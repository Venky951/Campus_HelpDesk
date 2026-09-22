const Ticket = require("../models/raisetickect");
const { actions, recordTicketHistory } = require("../utils/ticket-history");
const { validationResult } = require("express-validator");

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
    const { title, category, description, priority } = req.body;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).render("student/raiseticket", {
        title: "Raise Ticket",
        isLoggedIn: req.isLoggedIn,
        user: req.session.user,
        errors: errors.array(),
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

    try {
      await recordTicketHistory({
        ticket: ticket._id,
        actor: req.authenticatedUser._id,
        actorRole: "student",
        action: actions.CREATED,
      });
    } catch (historyError) {
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
