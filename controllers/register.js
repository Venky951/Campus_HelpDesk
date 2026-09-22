const { check, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const registerdetails = require("../models/register");

exports.getRegister = (req, res, next) => {
  res.render("auth/register", {
    title: "Register",
    currentPage: "register",
    errorMessage: null,
    errors: [],
    oldInput: {
      username: "",
      email: "",
    },
  });
};

exports.postRegister = [
  check("username")
    .isString()
    .withMessage("Username must be text")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be between 3 and 50 characters")
    .custom(async (username) => {
      const existingUser = await registerdetails.findOne({
        username: username,
      });
      if (existingUser) {
        throw new Error("Username already in use");
      }
      return true;
    }),

  check("email")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage("Email is too long")
    .custom(async (email) => {
      const existingUser = await registerdetails.findOne({ email: email });
      if (existingUser) {
        throw new Error("Email already in use");
      }
      return true;
    }),

  check("password")
    .isString()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[@$!%*?&]/)
    .withMessage("Password must contain at least one special character"),

  check("confirmPassword")
    .isString()
    .notEmpty()
    .withMessage("Please confirm your password")
    .custom((confirmPassword, { req }) => {
      if (confirmPassword !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    })
    .isLength({ max: 128 })
    .withMessage("Confirmation password is too long"),

  async (req, res, next) => {
    const { username, email, password, confirmPassword } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("auth/register", {
        title: "Register",
        errors: errors.array(),
        oldInput: {
          username,
          email,
        },
      });
    }

    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 12);
      const user = new registerdetails({
        username,
        email,
        password: hashedPassword,
        role: "student",
      });
      await user.save();
      res.redirect("/login");
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).render("auth/register", {
          title: "Register",
          isLoggedIn: false,
          errors: [{ msg: "Username or email is already in use" }],
          oldInput: { username, email },
        });
      }

      return next(err);
    }
  },
];
