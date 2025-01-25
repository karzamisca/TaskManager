// models/ProjectPaymentDocument.js
const mongoose = require("mongoose");

const projectPaymentDocumentSchema = new mongoose.Schema({
  title: { type: String, default: "Payment Document", required: true },
  name: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  amountOfMoney: { type: Number, required: true },
  paid: { type: Number, required: true },
  paymentDeadline: { type: String, required: true },
  submissionDate: { type: String, required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model(
  "ProjectPaymentDocument",
  projectPaymentDocumentSchema
);
