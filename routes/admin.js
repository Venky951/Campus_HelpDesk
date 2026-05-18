const express = require("express");
const admindashboard = express.Router();
const adminDetails = require("../controllers/admin");
const isAuth = require("../middleware/is-auth");
const isAdmin = require("../middleware/is-admin");

admindashboard.get("/admin", isAdmin, adminDetails.getadmin);
admindashboard.post("/admin-logout", isAuth, adminDetails.postLogout);

module.exports = admindashboard;
