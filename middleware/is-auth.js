module.exports = (req, res, next) => {
  if (!req.session || !req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  next();
};
