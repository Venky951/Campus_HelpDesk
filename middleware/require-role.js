const User = require("../models/register");

module.exports = (role) => async (req, res, next) => {
  if (!req.session || !req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  try {
    const userId = req.session.user?._id;
    const user = userId
      ? await User.findById(userId).select("_id username email role department")
      : null;

    if (!user || user.role !== role) {
      return res.redirect("/");
    }

    req.authenticatedUser = user;
    next();
  } catch (error) {
    next(error);
  }
};
