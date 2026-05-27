const Ticket = require("../models/raisetickect");

exports.getadmin = async (req, res) => {
  try {
    const adminDepartment = req.session.user.department;
    //debug logs
    console.log("=== DEBUG ===");
    console.log("Admin department:", JSON.stringify(adminDepartment));
    const allTickets = await Ticket.find({});
    console.log("All tickets in DB:", JSON.stringify(allTickets, null, 2));

    // filters
    const statusFilter = req.query.status || "All";
    const search = req.query.search || "";

    // base filter
    let filter = {
      category: adminDepartment,
    };

    // status filter
    if (statusFilter !== "All") {
      filter.status = statusFilter;
    }

    // get tickets
    let tickets = await Ticket.find(filter).populate("student");

    // search by title or student
    if (search) {
      tickets = tickets.filter((ticket) => {
        const titleMatch = ticket.title
          ?.toLowerCase()
          .includes(search.toLowerCase());

        const studentMatch = ticket.student?.username
          ?.toLowerCase()
          .includes(search.toLowerCase());

        return titleMatch || studentMatch;
      });
    }

    // counts
    const totalTickets = await Ticket.countDocuments({
      category: adminDepartment,
    });

    const openTickets = await Ticket.countDocuments({
      category: adminDepartment,
      status: "Open",
    });

    const inProgressTickets = await Ticket.countDocuments({
      category: adminDepartment,
      status: "In Progress",
    });

    const resolvedTickets = await Ticket.countDocuments({
      category: adminDepartment,
      status: "Resolved",
    });

    res.render("admin/admin", {
      title: "Admin Dashboard",
      currentPage: "admin",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,

      tickets,
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,

      statusFilter,
      search,
    });
  } catch (err) {
    console.log(err);
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { status } = req.body;

    await Ticket.findByIdAndUpdate(ticketId, {
      status: status,
    });

    res.redirect("/admin");
  } catch (err) {
    console.log(err);
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
