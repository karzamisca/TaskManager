// models/Fund.js
const mongoose = require("mongoose");

const fundSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
});

module.exports = mongoose.model("Fund", fundSchema);
