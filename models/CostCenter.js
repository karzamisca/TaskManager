// models/CostCenter.js
const mongoose = require("mongoose");

// Define the schema for the cost center
const costCenterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  allowedUsers: { type: [String], default: [] }, // Array of usernames
});

const CostCenter = mongoose.model("CostCenter", costCenterSchema);

module.exports = CostCenter;
