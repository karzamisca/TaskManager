// models/Entry.js
const mongoose = require("mongoose");

const entrySchema = new mongoose.Schema({
  tag: String,
  name: String,
  description: String,
  unit: String,
  amount: Number,
  unitPrice: Number,
  vat: Number,
  paid: Number,
  deliveryDate: String,
  note: String,
  entryDate: String,
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Reference to User model
  approvalPayment: { type: Boolean, default: false },
  approvedPaymentBy: {
    username: String,
    department: String,
  },
  approvalPaymentDate: String,
  approvalReceive: { type: Boolean, default: false },
  approvedReceiveBy: {
    username: String,
    department: String,
  },
  approvalReceiveDate: String,
});

module.exports = mongoose.model("Entry", entrySchema);
