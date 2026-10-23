const { ticketPriorities, ticketStatuses } = require("./validation");

const MAX_REPORT_DAYS = 366;
const UTC_LABEL = "UTC";

const startOfUtcDay = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const parseDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
};

const getAnalyticsRange = (query = {}, now = new Date()) => {
  const range = query.range || "30";
  if (!["7", "30", "90", "custom"].includes(range)) {
    return { error: "Select a valid reporting range" };
  }

  let start;
  let end;
  if (range === "custom") {
    start = parseDate(query.from);
    const endDay = parseDate(query.to);
    if (!start || !endDay || endDay < start) {
      return { error: "Enter a valid custom date range" };
    }
    end = new Date(endDay);
    end.setUTCDate(end.getUTCDate() + 1);
  } else {
    end = new Date(now);
    start = startOfUtcDay(end);
    start.setUTCDate(start.getUTCDate() - (Number(range) - 1));
    end = new Date(startOfUtcDay(end));
    end.setUTCDate(end.getUTCDate() + 1);
  }

  const days = Math.ceil((end - start) / 86400000);
  if (days > MAX_REPORT_DAYS) {
    return { error: `Reporting ranges cannot exceed ${MAX_REPORT_DAYS} days` };
  }

  return {
    range,
    start,
    end,
    from: start.toISOString().slice(0, 10),
    to: new Date(end.getTime() - 1).toISOString().slice(0, 10),
    timezone: UTC_LABEL,
  };
};

const buildTrendDates = (start, end) => {
  const dates = [];
  for (let date = new Date(start); date < end; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
};

const percentage = (value, total) => (total ? Math.round((value / total) * 1000) / 10 : 0);

const csvCell = (value) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (rows) => rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";

module.exports = {
  MAX_REPORT_DAYS,
  UTC_LABEL,
  buildTrendDates,
  csvCell,
  getAnalyticsRange,
  percentage,
  toCsv,
  ticketPriorities,
  ticketStatuses,
};
