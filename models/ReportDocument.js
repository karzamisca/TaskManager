// models/ReportDocument.js
const mongoose = require("mongoose");

const reportDocumentSchema = new mongoose.Schema({
  title: { type: String, default: "Report Document", required: true },
  tags: { type: String, required: true },
  postPurchasingReport: { type: String, required: true },
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
});

module.exports = mongoose.model("ReportDocument", reportDocumentSchema);
