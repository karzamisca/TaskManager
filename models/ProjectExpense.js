// models\ProjectExpense.js
const mongoose = require("mongoose");

const projectExpenseSchema = new mongoose.Schema({
  tag: String,
  name: String,
  description: String,
  package: String,
  unit: String,
  amount: Number,
  unitPrice: Number,
  vat: Number,
  paid: { type: Number, default: 0 },
  deliveryDate: String,
  note: String,
  entryDate: String,
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Reference to User model
  approvalReceive: { type: Boolean, default: false },
  approvedReceiveBy: {
    username: String,
    department: String,
  },
  approvalReceiveDate: String,
});

module.exports = mongoose.model("ProjectExpense", projectExpenseSchema);
