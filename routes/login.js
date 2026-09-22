const express = require("express");
const loginpage = express.Router();

const logincontroller = require("../controllers/login");
const { rateLimit } = require("express-rate-limit");
const { body } = require("express-validator");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: "Too many login attempts. Please try again later.",
});

loginpage.get("/login", logincontroller.getLogin);
loginpage.post(
  "/login",
  loginLimiter,
  body("username")
    .isString()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username is invalid"),
  body("password")
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password is invalid"),
  logincontroller.postLogin,
);
module.exports = loginpage;
