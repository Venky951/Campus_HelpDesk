const Notification = require("../models/notification");

const getNotificationSummary = async (recipient) => {
  try {
    const [unreadCount, recent] = await Promise.all([
      Notification.countDocuments({ recipient, isRead: false }),
      Notification.find({ recipient })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("ticket", "title")
        .lean(),
    ]);

    return { unreadCount, recent };
  } catch (error) {
    console.error(
      "Notification summary failed:",
      error.name || "Error",
      error.message,
    );
    return { unreadCount: 0, recent: [] };
  }
};

module.exports = { getNotificationSummary };
