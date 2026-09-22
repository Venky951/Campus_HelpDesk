const Ticket = require("../models/raisetickect");
const { validationResult } = require("express-validator");
const { actions, recordTicketHistory } = require("../utils/ticket-history");
const {
  PAGE_SIZE,
  buildAdminFilter,
  parsePage,
} = require("../utils/admin-ticket-query");

exports.getadmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).send("Invalid dashboard filters");
    }

    const adminDepartment = req.authenticatedUser.department;

    const statusFilter = req.query.status || "All";
    const priorityFilter = req.query.priority || "All";
    const search = req.query.search || "";
    const page = parsePage(req.query.page);
    const filter = await buildAdminFilter({
      department: adminDepartment,
      status: statusFilter,
      priority: priorityFilter,
      search,
    });

    const [
      matchingTickets,
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
    ] = await Promise.all([
      Ticket.countDocuments(filter),
      Ticket.countDocuments({ category: adminDepartment }),
      Ticket.countDocuments({ category: adminDepartment, status: "Open" }),
      Ticket.countDocuments({
        category: adminDepartment,
        status: "In Progress",
      }),
      Ticket.countDocuments({
        category: adminDepartment,
        status: "Resolved",
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(matchingTickets / PAGE_SIZE));
    if (page > totalPages) {
      const params = new URLSearchParams({
        status: statusFilter,
        priority: priorityFilter,
        search,
        page: String(totalPages),
      });
      return res.redirect(`/admin?${params.toString()}`);
    }

    const tickets = await Ticket.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate("student", "username");

    res.render("admin/admin", {
      title: "Admin Dashboard",
      currentPage: "admin",
      isLoggedIn: req.isLoggedIn,
      user: req.authenticatedUser,

      tickets,
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,

      statusFilter,
      priorityFilter,
      search,
      page,
      pageSize: PAGE_SIZE,
      totalMatchingTickets: matchingTickets,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { status } = req.body;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).send("Invalid ticket status");
    }

    const ticket = await Ticket.findOne({
      _id: ticketId,
      category: req.authenticatedUser.department,
    });

    if (!ticket) {
      return res.status(404).send("Ticket not found");
    }

    const previousStatus = ticket.status;
    if (previousStatus === status) {
      return res.redirect("/admin");
    }

    ticket.status = status;
    await ticket.save();

    try {
      await recordTicketHistory({
        ticket: ticket._id,
        actor: req.authenticatedUser._id,
        actorRole: "admin",
        action: actions.STATUS_CHANGED,
        details: { from: previousStatus, to: status },
      });
    } catch (historyError) {
      ticket.status = previousStatus;
      await ticket.save();
      throw historyError;
    }

    res.redirect("/admin");
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).send("Ticket not found");
    }

    next(err);
  }
};

exports.updatePriority = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { priority } = req.body;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).send("Invalid ticket priority");
    }

    const ticket = await Ticket.findOne({
      _id: ticketId,
      category: req.authenticatedUser.department,
    });

    if (!ticket) {
      return res.status(404).send("Ticket not found");
    }

    const previousPriority = ticket.priority || "Medium";
    if (previousPriority === priority) {
      return res.redirect("/admin");
    }

    ticket.priority = priority;
    await ticket.save();

    try {
      await recordTicketHistory({
        ticket: ticket._id,
        actor: req.authenticatedUser._id,
        actorRole: "admin",
        action: actions.PRIORITY_CHANGED,
        details: { from: previousPriority, to: priority },
      });
    } catch (historyError) {
      ticket.priority = previousPriority;
      await ticket.save();
      throw historyError;
    }

    res.redirect("/admin");
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).send("Ticket not found");
    }

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
