const Ticket = require("../models/raisetickect");
const User = require("../models/register");
const TicketHistory = require("../models/ticket-history");
const { getNotificationSummary } = require("../utils/notification-summary");
const {
  buildTrendDates,
  getAnalyticsRange,
  percentage,
  toCsv,
} = require("../utils/analytics");
const { ticketPriorities, ticketStatuses } = require("../utils/validation");

const departmentMatch = (department) => ({ category: department });

const historyTicketLookup = [
  {
    $lookup: {
      from: "raisetickets",
      localField: "ticket",
      foreignField: "_id",
      as: "ticketDoc",
    },
  },
  { $unwind: "$ticketDoc" },
];

const getAnalytics = async (department, range) => {
  const ticketRange = { ...departmentMatch(department), createdAt: { $gte: range.start, $lt: range.end } };
  const currentMatch = departmentMatch(department);
  const [
    overviewRows,
    statusRows,
    priorityRows,
    trendRows,
    resolutionRows,
    confirmedCount,
    reopenRows,
    feedbackRows,
    workloadRows,
    admins,
  ] = await Promise.all([
    Ticket.aggregate([
      { $match: currentMatch },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ["$status", "Open"] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } },
          unassigned: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$assignedTo", null] }, null] }, 1, 0] } },
          reopened: { $sum: { $cond: [{ $gt: [{ $ifNull: ["$reopenCount", 0] }, 0] }, 1, 0] } },
        },
      },
    ]),
    Ticket.aggregate([{ $match: currentMatch }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: currentMatch }, { $group: { _id: { $ifNull: ["$priority", "Medium"] }, count: { $sum: 1 } } }]),
    Ticket.aggregate([
      { $match: ticketRange },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    TicketHistory.aggregate([
      ...historyTicketLookup,
      { $match: { action: "STATUS_CHANGED", "details.to": "Resolved", createdAt: { $gte: range.start, $lt: range.end }, "ticketDoc.category": department } },
      { $project: { createdAt: 1, ticketCreatedAt: "$ticketDoc.createdAt" } },
      { $group: { _id: null, count: { $sum: 1 }, averageMs: { $avg: { $subtract: ["$createdAt", "$ticketCreatedAt"] } } } },
    ]),
    Ticket.countDocuments({ ...currentMatch, resolutionConfirmedAt: { $gte: range.start, $lt: range.end } }),
    TicketHistory.aggregate([
      ...historyTicketLookup,
      { $match: { action: "REOPENED", createdAt: { $gte: range.start, $lt: range.end }, "ticketDoc.category": department } },
      { $group: { _id: "$ticket", events: { $sum: 1 } } },
      { $group: { _id: null, tickets: { $sum: 1 }, events: { $sum: "$events" } } },
    ]),
    Ticket.aggregate([
      { $match: { ...currentMatch, feedbackSubmittedAt: { $gte: range.start, $lt: range.end }, feedbackRating: { $gte: 1, $lte: 5 } } },
      { $group: { _id: "$feedbackRating", count: { $sum: 1 }, average: { $avg: "$feedbackRating" } } },
    ]),
    Ticket.aggregate([
      { $match: currentMatch },
      { $group: { _id: "$assignedTo", total: { $sum: 1 }, open: { $sum: { $cond: [{ $eq: ["$status", "Open"] }, 1, 0] } }, inProgress: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } }, resolved: { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } } } },
    ]),
    User.find({ role: "admin", department }).select("_id username").sort({ username: 1 }).lean(),
  ]);

  const overview = overviewRows[0] || { total: 0, open: 0, inProgress: 0, resolved: 0, unassigned: 0, reopened: 0 };
  const byId = (rows) => new Map(rows.map((row) => [row._id, row.count]));
  const statusCounts = ticketStatuses.map((status) => byId(statusRows).get(status) || 0);
  const priorityCounts = ticketPriorities.map((priority) => byId(priorityRows).get(priority) || 0);
  const trendMap = new Map(trendRows.map((row) => [row._id, row.count]));
  const workloadMap = new Map(workloadRows.map((row) => [String(row._id), row]));
  const workload = admins.map((admin) => ({ username: admin.username, ...(workloadMap.get(String(admin._id)) || { total: 0, open: 0, inProgress: 0, resolved: 0 }) }));
  const unassigned = workloadMap.get("null") || { total: 0, open: 0, inProgress: 0, resolved: 0 };
  const feedbackCount = feedbackRows.reduce((sum, row) => sum + row.count, 0);
  const feedbackTotal = feedbackRows.reduce((sum, row) => sum + row.count * row._id, 0);
  const reopen = reopenRows[0] || { tickets: 0, events: 0 };
  const periodTicketTotal = trendRows.reduce((sum, row) => sum + row.count, 0);

  return {
    overview,
    statusCounts,
    priorityCounts,
    trends: buildTrendDates(range.start, range.end).map((date) => ({ date, count: trendMap.get(date) || 0 })),
    resolution: { count: resolutionRows[0]?.count || 0, averageHours: resolutionRows[0]?.averageMs ? Math.round((resolutionRows[0].averageMs / 3600000) * 10) / 10 : null, confirmed: confirmedCount },
    reopening: { tickets: reopen.tickets, events: reopen.events, percentage: percentage(reopen.tickets, periodTicketTotal), denominator: periodTicketTotal },
    feedback: { count: feedbackCount, average: feedbackCount ? Math.round((feedbackTotal / feedbackCount) * 10) / 10 : null, distribution: [1, 2, 3, 4, 5].map((rating) => byId(feedbackRows).get(rating) || 0) },
    workload: [...workload, { username: "Unassigned", ...unassigned }],
    statuses: ticketStatuses,
    priorities: ticketPriorities,
  };
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const range = getAnalyticsRange(req.query);
    if (range.error) return res.status(422).send(range.error);
    const data = await getAnalytics(req.authenticatedUser.department, range);
    res.render("admin/analytics", {
      title: "Admin Analytics",
      currentPage: "analytics",
      user: req.authenticatedUser,
      isLoggedIn: req.isLoggedIn,
      notificationSummary: await getNotificationSummary(req.authenticatedUser._id),
      range,
      data,
    });
  } catch (error) {
    next(error);
  }
};

exports.exportAnalytics = async (req, res, next) => {
  try {
    const range = getAnalyticsRange(req.query);
    if (range.error) return res.status(422).send(range.error);
    const tickets = await Ticket.find({ category: req.authenticatedUser.department, createdAt: { $gte: range.start, $lt: range.end } })
      .select("title category status priority createdAt assignedTo reopenCount feedbackRating")
      .populate("assignedTo", "username")
      .sort({ createdAt: 1 })
      .limit(10000)
      .lean();
    const rows = [["Title", "Department", "Status", "Priority", "Created (UTC)", "Assigned Administrator", "Reopen Count", "Feedback Rating"]];
    tickets.forEach((ticket) => rows.push([ticket.title, ticket.category, ticket.status, ticket.priority || "Medium", ticket.createdAt.toISOString(), ticket.assignedTo?.username || "Unassigned", ticket.reopenCount || 0, ticket.feedbackRating || ""]));
    res.type("text/csv").set("Content-Disposition", 'attachment; filename="campus-helpdesk-analytics.csv"').send(toCsv(rows));
  } catch (error) {
    next(error);
  }
};
