// controllers/Entry.js
const mongoose = require("mongoose");

const entrySchema = new mongoose.Schema({
  name: String,
  description: String,
  unit: String,
  amount: Number,
  unitPrice: Number,
  totalPrice: Number,
  vat: Number,
  totalPriceAfterVat: Number,
  deliveryDate: String,
  entryDate: String,
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Reference to User model
  approvalPayment: { type: Boolean, default: false },
  approvedPaymentBy: {
    username: String,
    department: String,
  },
  approvalPaymentDate: String,
});

module.exports = mongoose.model("Entry", entrySchema);
