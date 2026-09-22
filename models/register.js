const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    password: { type: String, required: true, minlength: 20 },
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
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
