const Ticket = require("../models/raisetickect");
const User = require("../models/register");
const { validationResult } = require("express-validator");
const { actions, recordTicketHistory } = require("../utils/ticket-history");
const {
  PAGE_SIZE,
  buildAdminFilter,
  parsePage,
} = require("../utils/admin-ticket-query");
const {
  notificationTypes,
  notifyStudent,
  notifyUser,
  safelyNotify,
} = require("../utils/notifications");
const { getNotificationSummary } = require("../utils/notification-summary");
const { validateResolutionDetails } = require("../utils/resolution");

exports.getadmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).send("Invalid dashboard filters");
    }

    const adminDepartment = req.authenticatedUser.department;

    const statusFilter = req.query.status || "All";
    const priorityFilter = req.query.priority || "All";
    const assignmentFilter = req.query.assignment || "All";
    const search = req.query.search || "";
    const page = parsePage(req.query.page);
    const filter = await buildAdminFilter({
      department: adminDepartment,
      status: statusFilter,
      priority: priorityFilter,
      assignment: assignmentFilter,
      adminId: req.authenticatedUser._id,
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
        assignment: assignmentFilter,
        search,
        page: String(totalPages),
      });
      return res.redirect(`/admin?${params.toString()}`);
    }

    const tickets = await Ticket.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate("student", "username")
      .populate("assignedTo", "username");
    const eligibleAdmins = await User.find({
      role: "admin",
      department: adminDepartment,
    })
      .select("_id username")
      .sort({ username: 1 })
      .lean();
    const notificationSummary = await getNotificationSummary(
      req.authenticatedUser._id,
    );

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
      assignmentFilter,
      eligibleAdmins,
      search,
      page,
      pageSize: PAGE_SIZE,
      totalMatchingTickets: matchingTickets,
      totalPages,
      notificationSummary,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateAssignment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).send("Invalid assignee");
    }

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      category: req.authenticatedUser.department,
    }).select("title category assignedTo");

    if (!ticket) {
      return res.status(404).send("Ticket not found");
    }

    const requestedAssignee = req.body.assignedTo || null;
    const currentAssignee = ticket.assignedTo
      ? String(ticket.assignedTo)
      : null;
    if (currentAssignee === requestedAssignee) {
      return res.redirect("/admin");
    }

    if (requestedAssignee) {
      const assignee = await User.findOne({
        _id: requestedAssignee,
        role: "admin",
        department: ticket.category,
      }).select("_id username");
      if (!assignee) {
        return res.status(422).send("Assignee must be an admin in this department");
      }
    }

    const expectedAssignee = req.body.expectedAssignedTo || null;
    if (expectedAssignee !== currentAssignee) {
      return res
        .status(409)
        .send("Ticket assignment changed; refresh and try again");
    }

    const updatedTicket = await Ticket.findOneAndUpdate(
      {
        _id: ticket._id,
        category: ticket.category,
        assignedTo: currentAssignee,
      },
      { $set: { assignedTo: requestedAssignee } },
      { new: true },
    ).select("title category assignedTo");

    if (!updatedTicket) {
      return res
        .status(409)
        .send("Ticket assignment changed; refresh and try again");
    }

    const historyAction = requestedAssignee
      ? currentAssignee
        ? actions.REASSIGNED
        : actions.ASSIGNED
      : actions.UNASSIGNED;

    try {
      const history = await recordTicketHistory({
        ticket: updatedTicket._id,
        actor: req.authenticatedUser._id,
        actorRole: "admin",
        action: historyAction,
        details: {
          from: currentAssignee,
          to: requestedAssignee,
        },
      });

      if (requestedAssignee && requestedAssignee !== String(req.authenticatedUser._id)) {
        await safelyNotify(
          notifyUser({
            recipient: requestedAssignee,
            ticket: updatedTicket._id,
            type: notificationTypes.ASSIGNMENT_UPDATED,
            message: `Ticket assigned to you: ${updatedTicket.title}`,
            eventKey: `assignment:${history._id}`,
          }),
        );
      }
    } catch (historyError) {
      const rollback = await Ticket.updateOne(
        {
          _id: updatedTicket._id,
          assignedTo: requestedAssignee,
        },
        { $set: { assignedTo: currentAssignee } },
      );
      if (rollback.modifiedCount !== 1) {
        console.error(
          "Assignment rollback failed:",
          historyError.name || "Error",
          historyError.message,
        );
      }
      throw historyError;
    }

    res.redirect("/admin");
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).send("Ticket not found");
    }
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { status, resolutionDetails } = req.body;
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

    const resolution = validateResolutionDetails(
      status,
      previousStatus,
      resolutionDetails,
    );
    if (!resolution.valid) {
      return res.status(422).send(resolution.message);
    }

    ticket.status = status;
    await ticket.save();

    try {
      const history = await recordTicketHistory({
        ticket: ticket._id,
        actor: req.authenticatedUser._id,
        actorRole: "admin",
        action: actions.STATUS_CHANGED,
        details: {
          from: previousStatus,
          to: status,
          ...(status === "Resolved"
            ? { resolutionDetails: resolution.details }
            : {}),
        },
      });
      await safelyNotify(
        notifyStudent({
          student: ticket.student,
          ticket: ticket._id,
          type: notificationTypes.STATUS_UPDATED,
          message: `Ticket status updated: ${ticket.title}`,
          eventKey: `status-updated:${history._id}`,
        }),
      );
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
      const history = await recordTicketHistory({
        ticket: ticket._id,
        actor: req.authenticatedUser._id,
        actorRole: "admin",
        action: actions.PRIORITY_CHANGED,
        details: { from: previousPriority, to: priority },
      });
      await safelyNotify(
        notifyStudent({
          student: ticket.student,
          ticket: ticket._id,
          type: notificationTypes.PRIORITY_UPDATED,
          message: `Ticket priority updated: ${ticket.title}`,
          eventKey: `priority-updated:${history._id}`,
        }),
      );
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
