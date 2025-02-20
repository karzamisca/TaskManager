// models/PaymentDocument.js
const mongoose = require("mongoose");

const paymentDocumentSchema = new mongoose.Schema({
  title: { type: String, default: "Payment Document", required: true },
  name: { type: String, required: true },
  content: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  totalPayment: { type: Number, required: true },
  advancePayment: { type: Number, default: 0 },
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
  status: {
    type: String,
    enum: ["Pending", "Approved", "Suspended"], // Possible states
    default: "Pending",
  },
  suspendReason: { type: String, default: "" },
  declaration: { type: String, default: "" },
  groupName: { type: String },
});

module.exports = mongoose.model("PaymentDocument", paymentDocumentSchema);
