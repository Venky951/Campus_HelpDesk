module.exports = (req, res, next) => {
  if (!req.session || !req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  if (!req.session.user || req.session.user.role !== "student") {
    return res.redirect("/");
  }

  next();
};
