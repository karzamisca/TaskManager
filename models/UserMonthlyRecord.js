// models/UserMonthlyRecord.js
const mongoose = require("mongoose");

const monthlyUserRecordSchema = new mongoose.Schema(
  {
    // Reference to the original user
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Record metadata
    recordDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    recordMonth: {
      type: Number,
      required: true, // 1-12
    },
    recordYear: {
      type: Number,
      required: true,
    },

    // User data snapshot at time of record
    username: { type: String, required: true },
    realName: { type: String, required: true },
    role: { type: String },
    department: { type: String },
    email: { type: String },

    // Cost center and management
    costCenter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CostCenter",
    },
    assignedManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Salary information
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
    grossSalary: { type: Number, default: 0 },

    // Tax information
    tax: { type: Number, default: 0 },
    dependantCount: { type: Number, default: 0 },
    taxableIncome: { type: Number, default: 0 },

    // Travel expenses
    travelExpense: { type: Number, default: 0 },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Create compound index to ensure one record per user per month/year
monthlyUserRecordSchema.index(
  { userId: 1, recordMonth: 1, recordYear: 1 },
  { unique: true }
);

// Index for efficient querying by date
monthlyUserRecordSchema.index({ recordDate: -1 });
monthlyUserRecordSchema.index({ recordYear: -1, recordMonth: -1 });

module.exports = mongoose.model("UserMonthlyRecord", monthlyUserRecordSchema);
