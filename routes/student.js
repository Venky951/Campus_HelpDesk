const express = require("express");
const studentdashboard = express.Router();

const studentdetails = require("../controllers/student");
const ticketComments = require("../controllers/ticket-comments");
const isAuth = require("../middleware/is-auth");
const isStudent = require("../middleware/is-student");
const { body, param } = require("express-validator");
const { departments, ticketPriorities } = require("../utils/validation");

studentdashboard.get(
  "/",
  isAuth,
  isStudent,
  studentdetails.getStudentDashboard,
);

studentdashboard.get(
  "/raiseticket",
  isAuth,
  isStudent,
  studentdetails.getRaiseTicket,
);
studentdashboard.get(
  "/ticket/:id",
  isAuth,
  isStudent,
  param("id").isMongoId().withMessage("Invalid ticket ID"),
  ticketComments.getStudentTicket,
);
studentdashboard.post(
  "/raiseticket",
  isAuth,
  isStudent,
  body("title")
    .isString()
    .trim()
    .isLength({ min: 3, max: 120 })
    .withMessage("Title must be between 3 and 120 characters"),
  body("category")
    .isString()
    .trim()
    .isIn(departments)
    .withMessage("Select a valid department"),
  body("description")
    .isString()
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage("Description must be between 10 and 5000 characters"),
  body("priority")
    .isString()
    .trim()
    .isIn(ticketPriorities)
    .withMessage("Select a valid priority"),
  studentdetails.postRaiseTicket,
);
studentdashboard.post(
  "/ticket/:id/comment",
  isAuth,
  isStudent,
  param("id").isMongoId().withMessage("Invalid ticket ID"),
  body("message")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Comment cannot be empty")
    .isLength({ max: 2000 })
    .withMessage("Comment must be 2000 characters or fewer"),
  ticketComments.postStudentComment,
);
studentdashboard.post("/logout", isAuth, isStudent, studentdetails.postLogout);
module.exports = studentdashboard;
