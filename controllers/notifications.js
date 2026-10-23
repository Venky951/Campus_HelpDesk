const { validationResult } = require("express-validator");
const Notification = require("../models/notification");
const { getNotificationSummary } = require("../utils/notification-summary");

const getTicketPath = (role, ticketId) =>
  `/${role}/ticket/${ticketId}`;

const renderNotifications = async (req, res, next, role) => {
  try {
    const notifications = await Notification.find({
      recipient: req.authenticatedUser._id,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("ticket", "title")
      .lean();
    const summary = await getNotificationSummary(req.authenticatedUser._id);

    res.render("notifications/index", {
      title: "Notifications",
      isLoggedIn: req.isLoggedIn,
      user: req.authenticatedUser,
      role,
      notifications,
      notificationSummary: summary,
      ticketPath: getTicketPath,
      errors: [],
    });
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next, role) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).send("Invalid notification ID");
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.authenticatedUser._id,
      },
      { $set: { isRead: true } },
      { new: true },
    );
    if (!notification) return res.status(404).send("Notification not found");

    res.redirect(getTicketPath(role, notification.ticket));
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).send("Notification not found");
    }
    next(error);
  }
};

exports.getStudentNotifications = (req, res, next) =>
  renderNotifications(req, res, next, "student");
exports.getAdminNotifications = (req, res, next) =>
  renderNotifications(req, res, next, "admin");
exports.markStudentRead = (req, res, next) =>
  markRead(req, res, next, "student");
exports.markAdminRead = (req, res, next) => markRead(req, res, next, "admin");
