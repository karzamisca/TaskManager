// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true }, // Add role field
  department: { type: String, required: true }, // Add department field
  refreshToken: { type: String },
  email: { type: String },
  facebookUserId: { type: String },
});

module.exports = mongoose.model("User", userSchema);
