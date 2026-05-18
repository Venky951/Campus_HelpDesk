const express = require("express");
const loginpage = express.Router();

const logincontroller = require("../controllers/login");

loginpage.get("/login", logincontroller.getLogin);
loginpage.post("/login", logincontroller.postLogin);
module.exports = loginpage;
