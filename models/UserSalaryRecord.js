// models\UserSalaryRecord.js
const mongoose = require("mongoose");

const userSalaryRecordSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  year: {
    type: Number,
    required: true,
  },
  holidayDays: {
    type: Number,
    default: 0,
  },
  nightShiftDays: {
    type: Number,
    default: 0,
  },
  holidayBonusRate: {
    type: Number,
    default: 0,
  },
  nightShiftBonusRate: {
    type: Number,
    default: 0,
  },
  totalSalary: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to ensure only one record per user per month/year
userSalaryRecordSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

const UserSalaryRecord = mongoose.model(
  "UserSalaryRecord",
  userSalaryRecordSchema
);

module.exports = UserSalaryRecord;
