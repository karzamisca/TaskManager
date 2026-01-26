// models/FinanceCostCenterDailyLog.js
const mongoose = require("mongoose");

const financeCostCenterDailyLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    userRole: {
      type: String,
      required: true,
    },
    userDepartment: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "GET_COST_CENTERS",
        "GET_DAILY_ENTRIES",
        "ADD_DAILY_ENTRY",
        "UPDATE_DAILY_ENTRY",
        "DELETE_DAILY_ENTRY",
      ],
    },
    costCenterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CostCenter",
    },
    dailyEntryId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    requestData: {
      type: mongoose.Schema.Types.Mixed,
    },
    responseStatus: {
      type: Number,
    },
    responseMessage: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Static method to log actions
financeCostCenterDailyLogSchema.statics.logAction = async function (logData) {
  try {
    await this.create(logData);
  } catch (error) {
    console.error("Failed to log daily finance action:", error);
  }
};

const FinanceCostCenterDailyLog = mongoose.model(
  "FinanceCostCenterDailyLog",
  financeCostCenterDailyLogSchema,
);

module.exports = FinanceCostCenterDailyLog;
