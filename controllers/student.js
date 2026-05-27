const path = require("path");

const Ticket = require("../models/raisetickect");

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
    console.log(err);
  }
};

exports.getRaiseTicket = (req, res, next) => {
  res.render("student/raiseticket", {
    title: "Raise Ticket",
    isLoggedIn: req.isLoggedIn,
    user: req.session.user,
  });
};
exports.postRaiseTicket = async (req, res, next) => {
  try {
    const { title, category, description } = req.body;

    // Validate BEFORE saving
    if (!title || !category || !description) {
      return res.redirect("/student/raiseticket");
    }

    const ticket = new Ticket({
      title: title,
      category: category,
      description: description,
      status: "Open",
      student: req.session.user._id,
    });

    await ticket.save();

    res.redirect("/student");
  } catch (err) {
    console.log(err);
    res.redirect("/student/raiseticket");
  }
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
      return res.redirect("/");
    }
    res.redirect("/");
  });
};
