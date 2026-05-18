const path = require("path");

const Ticket = require("../models/raisetickect");

exports.getStudentDashboard = (req, res, next) => {
  res.render("student/student", {
    title: "Student Dashboard",
    isLoggedIn: req.isLoggedIn,
  });
};

exports.getRaiseTicket = (req, res, next) => {
  res.render("student/raiseticket", {
    title: "Raise Ticket",
    isLoggedIn: req.isLoggedIn,
  });
};
exports.postRaiseTicket = (req, res, next) => {
  const { title, category, description } = req.body;
  // Validate BEFORE saving
  if (!title || !category || !description) {
    return res.redirect("/raiseticket");
  }
  const ticket = new Ticket(
    Date.now().toString(),
    title,
    category,
    description,
    "Open",
  );
  // Save with callback to ensure completion before redirect
  ticket.save((err) => {
    if (err) {
      console.log(err);
      return res.redirect("/raiseticket");
    }
    res.redirect("/student");
  });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
};
