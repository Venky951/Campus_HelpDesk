const express = require("express");
const indexrouter = express.Router();

const indexcontroller = require("../controllers/index");

indexrouter.get("/", indexcontroller.getIndex);
module.exports = indexrouter;
