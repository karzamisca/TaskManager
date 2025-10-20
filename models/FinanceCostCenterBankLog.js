// models/FinanceCostCenterBankLog.js
const mongoose = require("mongoose");

const financeCostCenterBankLogSchema = new mongoose.Schema(
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
        "GET_BANK_ENTRIES",
        "ADD_BANK_ENTRY",
        "UPDATE_BANK_ENTRY",
        "DELETE_BANK_ENTRY",
        "GET_COST_CENTERS",
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
    bankEntryId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Request and response data
    requestData: {
      type: mongoose.Schema.Types.Mixed, // Stores the request body/params
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
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Static method to log actions
financeCostCenterBankLogSchema.statics.logAction = async function (logData) {
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
  "FinanceCostCenterBankLog",
  financeCostCenterBankLogSchema
);
