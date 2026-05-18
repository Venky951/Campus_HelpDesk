module.exports = (req, res, next) => {
  if (!req.session || !req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "admin") {
    return res.redirect("/");
  }

  next();
};
