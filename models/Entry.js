const mongoose = require("mongoose");

const entrySchema = new mongoose.Schema({
  description: String,
  unit: String,
  amount: Number,
  unitPrice: Number,
  totalPrice: Number,
  vat: Number,
  deliveryDate: Date,
  entryDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Entry", entrySchema);
