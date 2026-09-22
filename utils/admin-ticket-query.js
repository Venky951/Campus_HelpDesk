const User = require("../models/register");
const { ticketPriorities, ticketStatuses } = require("./validation");

const PAGE_SIZE = 10;
const MAX_PAGE = 10000;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePage = (value) => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return 1;
  }

  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
};

const buildAdminFilter = async ({ department, status, priority, search }) => {
  const filter = { category: department };
  const conditions = [];

  if (status !== "All") {
    conditions.push({ status });
  }

  if (priority !== "All") {
    conditions.push(
      priority === "Medium"
        ? { $or: [{ priority: "Medium" }, { priority: { $exists: false } }] }
        : { priority },
    );
  }

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    const matchingStudents = await User.find({ username: searchRegex }).select(
      "_id",
    );

    conditions.push({
      $or: [
        { title: searchRegex },
        { student: { $in: matchingStudents.map((student) => student._id) } },
      ],
    });
  }

  if (conditions.length > 0) {
    filter.$and = conditions;
  }

  return filter;
};

module.exports = {
  PAGE_SIZE,
  buildAdminFilter,
  parsePage,
  ticketPriorities,
  ticketStatuses,
};
