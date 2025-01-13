// models/CostCenter.js
const mongoose = require("mongoose");

// Define the schema for the cost center
const costCenterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
});

const CostCenter = mongoose.model("CostCenter", costCenterSchema);

module.exports = CostCenter;
