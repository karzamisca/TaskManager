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
  approval: { type: Boolean, default: false }, // Approval status (false by default)
});

module.exports = mongoose.model("Entry", entrySchema);
