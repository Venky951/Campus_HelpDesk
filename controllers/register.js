const { check, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
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
      role: "",
      department: "",
    },
  });
};

exports.postRegister = [
  check("username")
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3 })
    .withMessage("Username must be at least 3 characters long")
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
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email address")
    .custom(async (email) => {
      const existingUser = await registerdetails.findOne({ email: email });
      if (existingUser) {
        throw new Error("Email already in use");
      }
      return true;
    }),

  check("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[@$!%*?&]/)
    .withMessage("Password must contain at least one special character")
    .trim(),

  check("confirmPassword")
    .notEmpty()
    .withMessage("Please confirm your password")
    .custom((confirmPassword, { req }) => {
      if (confirmPassword !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    })
    .trim(),

  check("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["student", "admin"])
    .withMessage("Role must be either 'student' or 'admin'"),

  check("department").custom((value, { req }) => {
    if (req.body.role === "admin") {
      if (!value) {
        throw new Error("Department is required");
      }

      const validDepartments = [
        "IT",
        "Technical",
        "Academics",
        "Administrative",
        "Hostel",
        "Library",
      ];

      if (!validDepartments.includes(value)) {
        throw new Error("Invalid department selected");
      }
    }

    return true;
  }),

  async (req, res, next) => {
    const { username, email, password, confirmPassword, role, department } =
      req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("auth/register", {
        title: "Register",
        errors: errors.array(),
        oldInput: {
          username,
          email,

          role,
          department,
        },
      });
    }

    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 12);
      const user = new registerdetails({
        username,
        email,
        password: hashedPassword,
        role,
        department: req.body.department || undefined,
      });
      await user.save();
      res.redirect("/login");
    } catch (err) {
      console.error("Error during registration:", err);
      res.status(500).render("auth/register", {
        title: "Register",
        isLoggedIn: false,
        errors: [{ msg: err.message }],
        oldInput: {
          username,
          email,

          role,
          department,
        },
      });
    }
  },
];
