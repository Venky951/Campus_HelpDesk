const register = require("../models/register");
const bycrypt = require("bcryptjs");

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

  register
    .findOne({ username: username })
    .then((user) => {
      if (!user) {
        return res.status(401).render("auth/login", {
          title: "Login",
          currentPage: "login",
          isLoggedIn: false,
          errors: ["User does not exist "],
          oldInput: { username: username },
        });
      }
      return bycrypt.compare(password, user.password).then((isMatch) => {
        if (isMatch) {
          req.session.isLoggedIn = true;
          req.session.user = {
            _id: user._id.toString(),
            username: user.username,
            email: user.email,
            role: user.role,
          };
          return req.session.save((err) => {
            if (err) {
              console.log(err);
            }
            if (user.role === "admin") {
              return res.redirect("/admin");
            }
            if (user.role === "student") {
              return res.redirect("/student");
            }
          });
        }

        return res.status(401).render("auth/login", {
          title: "Login",
          currentPage: "login",
          isLoggedIn: false,
          errors: ["Invalid password"],
          oldInput: { username: username },
        });
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).render("auth/login", {
        title: "Login",
        currentPage: "login",
        isLoggedIn: false,
        errors: ["An error occurred. Please try again."],
        oldInput: { username: username },
      });
    });
};
