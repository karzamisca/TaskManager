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
  realName: { type: String, default: "none" },
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
  beneficiaryBank: { type: String },
  bankAccountNumber: { type: String, default: "0" },
  citizenID: { type: String, default: "0" },
  baseSalary: { type: Number, default: 0 },
  hourlyWage: { type: Number, default: 0 },
  commissionBonus: { type: Number, default: 0 },
  responsibility: { type: Number, default: 0 },
  weekdayOvertimeHour: { type: Number, default: 0 },
  weekendOvertimeHour: { type: Number, default: 0 },
  holidayOvertimeHour: { type: Number, default: 0 },
  overtimePay: { type: Number, default: 0 },
  insurableSalary: { type: Number, default: 0 },
  mandatoryInsurance: { type: Number, default: 0 },
  currentSalary: { type: Number, default: 0 },
  email: { type: String },
  facebookUserId: { type: String },
  // For tax calculation
  tax: { type: Number, default: 0 },
  grossSalary: { type: Number, default: 0 },
  dependantCount: { type: Number, default: 0 },
  taxableIncome: { type: Number, default: 0 },
  // Travel Expense Fields
  travelExpense: { type: Number, default: 0 },
  // Permissions array
  permissions: [{ type: String }],
});

// Pre-save hook to generate password and calculate salary/tax
userSchema.pre("save", function (next) {
  // Generate random password if not provided
  if (!this.password) {
    this.password = generateRandomPassword();
  }

  // Calculate hourly wage according to Vietnamese law (baseSalary/26 working days/8 hours per day)
  this.hourlyWage = this.baseSalary / 26 / 8 || 0;

  // Calculate overtime pay according to Vietnamese labor law
  const weekdayOvertimePay = this.weekdayOvertimeHour * this.hourlyWage * 1.5; // 150% for weekday overtime
  const weekendOvertimePay = this.weekendOvertimeHour * this.hourlyWage * 2; // 200% for weekend overtime
  const holidayOvertimePay = this.holidayOvertimeHour * this.hourlyWage * 3; // 300% for holiday overtime
  this.overtimePay =
    weekdayOvertimePay + weekendOvertimePay + holidayOvertimePay;

  // Calculate gross salary (before deductions)
  this.grossSalary =
    this.baseSalary +
    this.commissionBonus +
    this.responsibility +
    this.overtimePay +
    this.travelExpense;

  // Calculate mandatory insurance according to Vietnamese law
  // Social Insurance (8%), Health Insurance (1.5%), Unemployment Insurance (1%)
  const totalInsuranceRate = 0.105; // 10.5% total for employee contribution

  // Vietnam has both minimum salary and regional minimum salary
  const minimumSalary = 2340000; // Basic minimum salary in VND
  const regionalMinSalary = 4960000; // Region I minimum salary in VND

  // For social insurance and health insurance, cap is based on 20x basic minimum salary
  // For unemployment insurance, cap is based on 20x regional minimum salary
  const siHiCap = 20 * minimumSalary * 0.095; // Social Insurance (8%) + Health Insurance (1.5%)
  const uiCap = 20 * regionalMinSalary * 0.01; // Unemployment Insurance (1%)

  // Calculate each component separately to respect their different caps
  const siHiContribution = Math.min(this.insurableSalary * 0.095, siHiCap);
  const uiContribution = Math.min(this.insurableSalary * 0.01, uiCap);

  this.mandatoryInsurance =
    this.insurableSalary > 0 ? siHiContribution + uiContribution : 0;

  // Calculate taxable income according to Vietnamese law
  const standardDeduction = 11000000; // 11 million VND/month
  const dependantDeduction = 4400000 * this.dependantCount; // 4.4 million per dependant

  this.taxableIncome = Math.max(
    0,
    this.grossSalary -
      this.mandatoryInsurance -
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

  this.currentSalary = this.grossSalary - this.mandatoryInsurance - this.tax;

  next();
});

module.exports = mongoose.model("User", userSchema);
