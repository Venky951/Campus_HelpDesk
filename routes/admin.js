const express = require("express");
const admindashboard = express.Router();
const adminDetails = require("../controllers/admin");
const ticketComments = require("../controllers/ticket-comments");
const isAuth = require("../middleware/is-auth");
const isAdmin = require("../middleware/is-admin");
const { body, param, query } = require("express-validator");
const { ticketStatuses, ticketPriorities } = require("../utils/validation");

admindashboard.get(
  "/admin",
  isAuth,
  isAdmin,
  query("status")
    .optional()
    .isString()
    .isIn(["All", ...ticketStatuses])
    .withMessage("Invalid status filter"),
  query("priority")
    .optional()
    .isString()
    .isIn(["All", ...ticketPriorities])
    .withMessage("Invalid priority filter"),
  query("search")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search text is too long"),
  query("page")
    .optional()
    .isString()
    .isInt({ min: 1, max: 10000 })
    .withMessage("Invalid page"),
  adminDetails.getadmin,
);
admindashboard.post("/admin-logout", isAuth, isAdmin, adminDetails.postLogout);
admindashboard.get(
  "/admin/ticket/:id",
  isAuth,
  isAdmin,
  param("id").isMongoId().withMessage("Invalid ticket ID"),
  ticketComments.getAdminTicket,
);
admindashboard.post(
  "/update-status/:id",
  isAuth,
  isAdmin,
  param("id").isMongoId().withMessage("Invalid ticket ID"),
  body("status")
    .isString()
    .isIn(ticketStatuses)
    .withMessage("Invalid ticket status"),
  adminDetails.updateStatus,
);
admindashboard.post(
  "/update-priority/:id",
  isAuth,
  isAdmin,
  param("id").isMongoId().withMessage("Invalid ticket ID"),
  body("priority")
    .isString()
    .trim()
    .isIn(ticketPriorities)
    .withMessage("Invalid ticket priority"),
  adminDetails.updatePriority,
);
admindashboard.post(
  "/admin/ticket/:id/comment",
  isAuth,
  isAdmin,
  param("id").isMongoId().withMessage("Invalid ticket ID"),
  body("message")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Comment cannot be empty")
    .isLength({ max: 2000 })
    .withMessage("Comment must be 2000 characters or fewer"),
  ticketComments.postAdminComment,
);

module.exports = admindashboard;
