exports.getadmin = (req, res) => {
  res.render("admin/admin", {
    title: "Admin Dashboard",
    currentPage: "admin",
    isLoggedIn: req.isLoggedIn,
    user: req.session.user,
  });
};
exports.postLogout = (req, res, next) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
};
