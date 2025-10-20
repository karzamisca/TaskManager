// models/FinanceCostCenterConstructionLog.js
const mongoose = require("mongoose");

const financeCostCenterConstructionLogSchema = new mongoose.Schema(
  {
    // User information
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
    },

    // Action details
    action: {
      type: String,
      required: true,
      enum: [
        // Construction actions
        "GET_CONSTRUCTION_ENTRIES",
        "ADD_CONSTRUCTION_ENTRY",
        "UPDATE_CONSTRUCTION_ENTRY",
        "DELETE_CONSTRUCTION_ENTRY",
        "GET_COST_CENTERS_CONSTRUCTION",
      ],
    },
    controller: {
      type: String,
      default: "financeCostCenterBankController",
    },

    // Target resource information
    costCenterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CostCenter",
    },
    entryId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    entryType: {
      type: String,
      enum: ["construction", null],
    },

    // Request and response data
    requestData: {
      type: mongoose.Schema.Types.Mixed,
    },
    responseStatus: {
      type: Number,
      required: true,
    },
    responseMessage: {
      type: String,
    },

    // Additional metadata
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },

    // Timestamps
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Static method to log actions
financeCostCenterConstructionLogSchema.statics.logAction = async function (
  logData
) {
  try {
    const logEntry = new this(logData);
    await logEntry.save();
    return logEntry;
  } catch (error) {
    console.error("Error logging action:", error);
    // Don't throw error to avoid breaking the main functionality
  }
};

module.exports = mongoose.model(
  "FinanceCostCenterConstructionLog",
  financeCostCenterConstructionLogSchema
);
