// models/FinanceGasLog.js
const mongoose = require("mongoose");

const financeGasLogSchema = new mongoose.Schema(
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
        // Gas operations actions
        "GET_FINANCE_GAS_PAGE",
        "GET_ALL_CENTERS_GAS",
        "EXPORT_GAS_SUMMARY_EXCEL",
        "CREATE_CENTER_GAS",
        "ADD_MONTH_ENTRY_GAS",
        "DELETE_CENTER_GAS",
        "ADD_YEAR_GAS",
        "UPDATE_YEAR_GAS",
        "REORDER_YEARS_GAS",
        "DELETE_MONTH_ENTRY_GAS",
        "UPDATE_MONTH_ENTRY_GAS",
        "UPDATE_CENTER_GAS",
      ],
    },
    controller: {
      type: String,
      required: true,
      enum: ["financeGasController"],
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
      enum: ["gas", null],
    },

    // Additional gas-specific fields
    year: {
      type: Number,
    },
    monthName: {
      type: String,
    },
    entryIndex: {
      type: Number,
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

    // File export information
    exportInfo: {
      fileName: String,
      recordCount: Number,
      totalAmounts: mongoose.Schema.Types.Mixed,
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
financeGasLogSchema.statics.logAction = async function (logData) {
  try {
    const logEntry = new this(logData);
    await logEntry.save();
    return logEntry;
  } catch (error) {
    console.error("Error logging action:", error);
    // Don't throw error to avoid breaking the main functionality
  }
};

module.exports = mongoose.model("FinanceGasLog", financeGasLogSchema);
