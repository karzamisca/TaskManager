// models/CostCenterGroup.js
const mongoose = require("mongoose");

const CostCenterGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  costCenters: {
    type: [String],
    required: true,
  },
});

module.exports = mongoose.model("CostCenterGroup", CostCenterGroupSchema);
