const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["student", "admin"], required: true },
  department: {
    type: String,
    enum: [
      "IT",
      "Technical",
      "Academics",
      "Administrative",
      "Hostel",
      "Library",
    ],
  },
});

module.exports = mongoose.model("User", userSchema);
