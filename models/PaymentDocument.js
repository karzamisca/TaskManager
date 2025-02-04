// models/PaymentDocument.js
const mongoose = require("mongoose");

const paymentDocumentSchema = new mongoose.Schema({
  title: { type: String, default: "Payment Document", required: true },
  name: { type: String, required: true },
  content: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  amountOfMoney: { type: Number, required: true },
  paymentDeadline: { type: String, required: true },
  fileMetadata: {
    driveFileId: { type: String },
    name: { type: String },
    link: { type: String },
  },
  submissionDate: { type: String, required: true },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  approvers: [
    {
      approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: { type: String, required: true },
      subRole: { type: String, required: true },
    },
  ],
  appendedPurchasingDocuments: [
    {
      type: mongoose.Schema.Types.Mixed, // Stores full Purchasing Document details
    },
  ],
  approvedBy: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: { type: String, required: true },
      role: { type: String, required: true },
      approvalDate: { type: String, required: true },
    },
  ],
  approved: { type: Boolean, default: false },
  groupName: { type: String },
});

module.exports = mongoose.model("PaymentDocument", paymentDocumentSchema);
