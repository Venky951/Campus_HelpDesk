const express = require("express");
const register = express.Router();
const registerddetails = require("../controllers/register");

register.get("/register", registerddetails.getRegister);
register.post("/register", registerddetails.postRegister);

module.exports = register;
