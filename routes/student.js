const express = require("express");
const studentdashboard = express.Router();

const studentdetails = require("../controllers/student");
const isAuth = require("../middleware/is-auth");

studentdashboard.get("/student", isAuth, studentdetails.getStudentDashboard);

studentdashboard.get("/raiseticket", isAuth, studentdetails.getRaiseTicket);
studentdashboard.post("/raiseticket", isAuth, studentdetails.postRaiseTicket);
studentdashboard.post("/logout", isAuth, studentdetails.postLogout);
module.exports = studentdashboard;
