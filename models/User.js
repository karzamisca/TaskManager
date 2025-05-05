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
  // For tax calculation
  tax: { type: Number, default: 0 },
  grossSalary: { type: Number, default: 0 },
  dependantCount: { type: Number, default: 0 },
  taxableIncome: { type: Number, default: 0 },
  socialInsuranceAmount: { type: Number, default: 0 }, // Calculated amount
});

// Pre-save hook to generate password and calculate salary/tax
userSchema.pre("save", function (next) {
  // Generate random password if not provided
  if (!this.password) {
    this.password = generateRandomPassword();
  }

  // Calculate gross salary (before deductions)
  this.grossSalary =
    this.baseSalary +
    this.holidayBonusPerDay * this.currentHolidayDays +
    this.nightShiftBonusPerDay * this.currentNightShiftDays;

  // Calculate social insurance as a percentage of gross salary
  this.socialInsuranceAmount = Math.round(
    this.grossSalary * (this.socialInsurance / 100)
  );

  // Calculate taxable income according to Vietnamese law
  const standardDeduction = 11000000; // 11 million VND/month
  const dependantDeduction = 4400000 * this.dependantCount; // 4.4 million per dependant
  this.taxableIncome = Math.max(
    0,
    this.grossSalary -
      this.socialInsuranceAmount -
      standardDeduction -
      dependantDeduction
  );

  // Vietnamese progressive tax rates (2023) - using official formula
  let tax = 0;
  const tn = this.taxableIncome;
  if (tn <= 5000000) {
    tax = tn * 0.05;
  } else if (tn <= 10000000) {
    tax = tn * 0.1 - 250000;
  } else if (tn <= 18000000) {
    tax = tn * 0.15 - 750000;
  } else if (tn <= 32000000) {
    tax = tn * 0.2 - 1650000;
  } else if (tn <= 52000000) {
    tax = tn * 0.25 - 3250000;
  } else if (tn <= 80000000) {
    tax = tn * 0.3 - 5850000;
  } else {
    tax = tn * 0.35 - 9850000;
  }

  // Ensure tax isn't negative (can happen with rounding errors)
  this.tax = Math.max(0, Math.round(tax));

  // Calculate net salary (after tax and social insurance)
  this.currentSalary = this.grossSalary - this.socialInsuranceAmount - this.tax;

  next();
});

module.exports = mongoose.model("User", userSchema);
