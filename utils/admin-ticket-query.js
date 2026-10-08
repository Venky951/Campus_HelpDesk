const User = require("../models/register");
const { ticketPriorities, ticketStatuses } = require("./validation");

const PAGE_SIZE = 10;
const MAX_PAGE = 10000;
const ALL_FILTER = "All";

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
  const validStatuses = new Set(ticketStatuses);
  const validPriorities = new Set(ticketPriorities);
  const normalizedStatus = validStatuses.has(status) ? status : ALL_FILTER;
  const normalizedPriority = validPriorities.has(priority)
    ? priority
    : ALL_FILTER;
  const normalizedSearch =
    typeof search === "string" ? search.trim().slice(0, 100) : "";

  if (normalizedStatus !== ALL_FILTER) {
    conditions.push({ status: normalizedStatus });
  }

  if (normalizedPriority !== ALL_FILTER) {
    conditions.push(
      normalizedPriority === "Medium"
        ? { $or: [{ priority: "Medium" }, { priority: null }] }
        : { priority: normalizedPriority },
    );
  }

  if (normalizedSearch) {
    const searchRegex = new RegExp(escapeRegex(normalizedSearch), "i");
    const matchingStudents = await User.find({ username: searchRegex })
      .select("_id")
      .lean();

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
