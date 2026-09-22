const register = require("../models/register");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");

exports.getLogin = (req, res, next) => {
  res.render("auth/login", {
    title: "Login",
    currentPage: "login",
    isLoggedIn: false,
    errors: [],
    oldInput: { username: "" },
  });
};

exports.postLogin = async (req, res, next) => {
  const { username, password } = req.body;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("auth/login", {
      title: "Login",
      currentPage: "login",
      isLoggedIn: false,
      errors: [{ msg: "Enter a valid username and password" }],
      oldInput: { username: username || "" },
    });
  }

  try {
    const user = await register.findOne({ username });
    const isMatch = user && (await bcrypt.compare(password, user.password));

    if (!isMatch) {
      return res.status(401).render("auth/login", {
        title: "Login",
        currentPage: "login",
        isLoggedIn: false,
        errors: ["Invalid username or password"],
        oldInput: { username },
      });
    }

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        return next(regenerateError);
      }

      req.session.isLoggedIn = true;
      req.session.user = {
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
      };

      req.session.save((saveError) => {
        if (saveError) {
          return next(saveError);
        }

        return res.redirect(user.role === "admin" ? "/admin" : "/student");
      });
    });
  } catch (err) {
    next(err);
  }
};
