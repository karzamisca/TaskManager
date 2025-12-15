// models/Item.js
const mongoose = require("mongoose");

const auditHistorySchema = new mongoose.Schema({
  oldName: String,
  newName: String,
  oldCode: String,
  newCode: String,
  oldUnitPrice: Number,
  newUnitPrice: Number,
  editedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  editedAt: {
    type: Date,
    default: Date.now,
  },
  action: {
    type: String,
    enum: ["create", "update", "delete"],
    required: true,
  },
});

const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  auditHistory: [auditHistorySchema],
});

// Update timestamp before saving
itemSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Item = mongoose.model("Item", itemSchema);
module.exports = Item;
