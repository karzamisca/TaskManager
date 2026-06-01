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
  otherBonus: { type: Number, default: 0 },
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
  allowanceGeneral: { type: Number, default: 0 },
  // Day off (unpaid leave) - will be deducted from salary
  dayOff: { type: Number, default: 0 },
  // Permissions array
  permissions: [{ type: String }],
  // Salary Calculation Lock Feature
  userSalaryCalculationLocked: { type: Boolean, default: false },
});

// Pre-save hook to generate password and calculate salary/tax
userSchema.pre("save", function (next) {
  // Generate random password if not provided
  if (!this.password) {
    this.password = generateRandomPassword();
  }

  // Calculate daily wage for day-off deduction (baseSalary/26 working days per month)
  const dailyWage = this.baseSalary / 26 || 0;

  // Calculate day-off deduction
  const dayOffDeduction = dailyWage * (this.dayOff || 0);

  // Calculate hourly wage according to Vietnamese law (baseSalary/26 working days/8 hours per day)
  this.hourlyWage = this.baseSalary / 26 / 8 || 0;

  // Calculate overtime pay according to Vietnamese labor law
  const weekdayOvertimePay = this.weekdayOvertimeHour * this.hourlyWage * 1.5; // 150% for weekday overtime
  const weekendOvertimePay = this.weekendOvertimeHour * this.hourlyWage * 2; // 200% for weekend overtime
  const holidayOvertimePay = this.holidayOvertimeHour * this.hourlyWage * 3; // 300% for holiday overtime
  this.overtimePay =
    weekdayOvertimePay + weekendOvertimePay + holidayOvertimePay;

  // Calculate gross salary (before deductions) - SUBTRACT day off deduction
  this.grossSalary =
    this.baseSalary +
    this.commissionBonus +
    this.responsibility +
    this.otherBonus +
    this.overtimePay +
    this.travelExpense +
    this.allowanceGeneral -
    dayOffDeduction;

  // Ensure grossSalary doesn't go negative
  this.grossSalary = Math.max(0, this.grossSalary);

  // Calculate mandatory insurance according to Vietnamese law
  const minimumSalary = 2340000; // Basic minimum salary in VND
  const regionalMinSalary = 5310000; // Region I minimum salary in VND

  const siHiCap = 20 * minimumSalary * 0.095;
  const uiCap = 20 * regionalMinSalary * 0.01;

  const siHiContribution = Math.min(this.insurableSalary * 0.095, siHiCap);
  const uiContribution = Math.min(this.insurableSalary * 0.01, uiCap);

  this.mandatoryInsurance =
    this.insurableSalary > 0 ? siHiContribution + uiContribution : 0;

  // Calculate taxable income
  const standardDeduction = 15500000;
  const dependantDeduction = 6200000 * this.dependantCount;

  this.taxableIncome = Math.max(
    0,
    this.grossSalary -
      this.mandatoryInsurance -
      standardDeduction -
      dependantDeduction,
  );

  // Vietnamese progressive tax rates (2023)
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

  this.tax = Math.max(0, Math.round(tax));

  this.currentSalary = this.grossSalary - this.mandatoryInsurance - this.tax;

  next();
});

module.exports = mongoose.model("User", userSchema);
