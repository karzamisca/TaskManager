// models/ItemStock.js
const mongoose = require("mongoose");

const stockHistorySchema = new mongoose.Schema({
  oldInStorage: {
    type: Number,
    default: null,
  },
  newInStorage: {
    type: Number,
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  note: {
    type: String,
    default: "",
  },
});

const itemStockSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true,
  },
  costCenterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CostCenter",
    required: true,
  },
  inStorage: {
    type: Number,
    default: 0,
    min: 0,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  stockHistory: {
    type: [stockHistorySchema],
    default: [],
  },
});

// One record per item+costCenter combination
itemStockSchema.index({ itemId: 1, costCenterId: 1 }, { unique: true });

module.exports = mongoose.model("ItemStock", itemStockSchema);
