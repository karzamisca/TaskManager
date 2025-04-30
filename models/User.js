// models/User.js
const mongoose = require("mongoose");

// Helper function to generate a random password
function generateRandomPassword(length = 15) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, default: "submitter" },
  department: { type: String, default: "In Training" },
  refreshToken: { type: String },
  costCenter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CostCenter",
  },
  assignedManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  baseSalary: { type: Number, default: 0 },
  holidayBonusPerDay: { type: Number, default: 0 },
  nightShiftBonusPerDay: { type: Number, default: 0 },
  socialInsurance: { type: Number, default: 0 },
  currentHolidayDays: { type: Number, default: 0 },
  currentNightShiftDays: { type: Number, default: 0 },
  currentSalary: { type: Number, default: 0 },
  email: { type: String },
  facebookUserId: { type: String },
});

// Pre-save hook to generate password if not provided
userSchema.pre("save", function (next) {
  if (!this.password) {
    this.password = generateRandomPassword();
  }

  // Calculate current salary whenever the user is saved
  this.currentSalary =
    this.baseSalary +
    this.holidayBonusPerDay * this.currentHolidayDays +
    this.nightShiftBonusPerDay * this.currentNightShiftDays -
    this.socialInsurance;

  next();
});

module.exports = mongoose.model("User", userSchema);
