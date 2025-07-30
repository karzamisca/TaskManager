//models/FinanceBank.js
const mongoose = require("mongoose");

const monthEntrySchema = new mongoose.Schema({
  inflows: {
    type: Number,
    default: 0,
    description: "Total incoming funds for the month",
  },
  outflows: {
    type: Number,
    default: 0,
    description: "Total outgoing funds for the month",
  },
  balance: {
    type: Number,
    default: 0,
    description: "Calculated balance (previous balance + inflows - outflows)",
  },
  treasurerNote: {
    type: String,
    default: "",
    description: "Notes from the treasurer about this month's transactions",
  },
  bankNote: {
    type: String,
    default: "",
    description: "Notes from bank statements or reconciliations",
  },
  generalNote: {
    type: String,
    default: "",
    description: "General notes about this month's financial activities",
  },
});

const monthSchema = new mongoose.Schema({
  name: { type: String, required: true },
  entries: [monthEntrySchema],
});

const yearSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  months: [monthSchema],
});

const centerSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  years: [yearSchema],
});

// Pre-save hook to calculate balance
monthEntrySchema.pre("save", function (next) {
  this.balance = this.inflows - this.outflows;
  next();
});

module.exports = mongoose.model("FinanceBank", centerSchema);
